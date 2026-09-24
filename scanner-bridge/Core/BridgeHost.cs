using System.Net;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace TradingDocks.ScannerBridge;

public sealed record BridgeOptions(X509Certificate2 Certificate, string[] Origins, int Port = Protocol.Port);
public static class BridgeHost
{
    public static WebApplication Create(BridgeOptions options, Trust trust, Captures captures, IWindowsScannerBackend backend, string workstationId, ScannerInbox? inbox = null)
    {
        if (!options.Certificate.HasPrivateKey) throw new InvalidOperationException("TLS certificate required.");
        var allowed = options.Origins.ToHashSet(StringComparer.Ordinal);
        if (allowed.Count == 0 || allowed.Any(o => !Uri.TryCreate(o, UriKind.Absolute, out var u) || u.GetLeftPart(UriPartial.Authority) != o || u.Scheme != "https" && !(u.Scheme == "http" && u.IsLoopback))) throw new InvalidOperationException("Exact HTTPS origins (or explicit development loopback origins) required.");
        // No URL/bind-address configuration is accepted from command line, environment or HTTP.
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions { Args = [], EnvironmentName = "Production" });
        builder.Configuration.Sources.Clear();
        builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(server =>
        {
            server.Limits.MaxRequestBodySize = 16 * 1024;
            server.Limits.MaxConcurrentConnections = 24;
            server.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(5);
            server.Listen(IPAddress.Loopback, options.Port, listener => listener.UseHttps(options.Certificate));
        });
        var app = builder.Build();
        var rates = new Dictionary<string, Queue<DateTimeOffset>>();
        var rateGate = new object();
        var expiry = new Timer(_ => captures.Expire(), null, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(30));
        app.Lifetime.ApplicationStopped.Register(() => { expiry.Dispose(); captures.Dispose(); });
        app.Use(async (context, next) =>
        {
            try
            {
                if (!IPAddress.IsLoopback(context.Connection.RemoteIpAddress ?? IPAddress.None) || context.Request.Host.Host != "127.0.0.1") throw new BridgeException("LOOPBACK_REQUIRED", 403);
                var origin = context.Request.Headers.Origin.ToString();
                if (!allowed.Contains(origin)) throw new BridgeException("ORIGIN_REJECTED", 403);
                context.Response.Headers.AccessControlAllowOrigin = origin;
                context.Response.Headers.Vary = "Origin";
                context.Response.Headers.CacheControl = "no-store";
                context.Response.Headers["X-Content-Type-Options"] = "nosniff";
                lock (rateGate)
                {
                    var bucket = origin + (context.Request.Path.StartsWithSegments("/v1/pair") ? ":pair" : context.Request.Path == "/v1/capture" ? ":capture" : ":all");
                    if (!rates.TryGetValue(bucket, out var queue)) rates[bucket] = queue = new();
                    while (queue.TryPeek(out var timestamp) && timestamp < DateTimeOffset.UtcNow.AddMinutes(-1)) queue.Dequeue();
                    if (queue.Count >= (bucket.EndsWith(":pair") ? 12 : bucket.EndsWith(":capture") ? 240 : 1200)) throw new BridgeException("RATE_LIMITED", 429);
                    queue.Enqueue(DateTimeOffset.UtcNow);
                }
                if (context.Request.Method == "OPTIONS")
                {
                    context.Response.Headers.AccessControlAllowMethods = "GET,POST,OPTIONS";
                    context.Response.Headers.AccessControlAllowHeaders = "Content-Type,X-TD-Credential,X-TD-Timestamp,X-TD-Nonce,X-TD-Proof";
                    context.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
                    context.Response.StatusCode = 204; return;
                }
                if (context.Request.QueryString.HasValue) throw new BridgeException("QUERY_NOT_SUPPORTED");
                using var reader = new StreamReader(context.Request.Body, Encoding.UTF8);
                var body = await reader.ReadToEndAsync(context.RequestAborted);
                if (Encoding.UTF8.GetByteCount(body) > 16 * 1024) throw new BridgeException("REQUEST_TOO_LARGE", 413);
                context.Items["body"] = body;
                var path = context.Request.Path.Value ?? "";
                var publicRequest = context.Request.Method == "GET" && path == "/v1/health" || context.Request.Method == "POST" && path is "/v1/pair/start" or "/v1/pair/finish";
                if (!publicRequest)
                    context.Items["owner"] = trust.Verify(origin, context.Request.Headers["X-TD-Credential"].ToString(), context.Request.Method, path, context.Request.Headers["X-TD-Timestamp"].ToString(), context.Request.Headers["X-TD-Nonce"].ToString(), context.Request.Headers["X-TD-Proof"].ToString(), body);
                await next(context);
            }
            catch (BridgeException error) { context.Response.StatusCode = error.Status; await context.Response.WriteAsJsonAsync(new { error = error.Message }); }
            catch (Exception) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { error = "INVALID_REQUEST" }); }
        });
        app.MapGet("/v1/health", () => new { running = true, protocolVersion = Protocol.Version, bridgeVersion = Protocol.VersionString, automaticInbox = inbox is not null });
        app.MapPost("/v1/pair/start", async (HttpContext c) => new { id = await trust.Begin(c.Request.Headers.Origin.ToString(), Body<PairStart>(c)) });
        app.MapPost("/v1/pair/finish", (HttpContext c) => { var r = trust.Finish(c.Request.Headers.Origin.ToString(), Body<PairFinish>(c)); return new { credentialId = r.Id, expires = r.Expires, workstationId }; });
        app.MapGet("/v1/status", () => new { workstationId, protocolVersion = Protocol.Version, bridgeVersion = Protocol.VersionString, paired = true });
        app.MapGet("/v1/devices", async (HttpContext c) => new { devices = await backend.Devices(c.RequestAborted) });
        if (inbox is not null)
        {
            app.MapPost("/v2/session", async (HttpContext c) => {
                var session = Body<LiveInboxSession>(c);
                if (session.WorkstationId != workstationId || !(await backend.Devices(c.RequestAborted)).Any(d => d.Id == session.DeviceId && d.Backend == "SCANSNAP")) throw new BridgeException("DEVICE_OFFLINE");
                inbox.Start(Owner(c), session); return inbox.Status(Owner(c), session.Id);
            });
            app.MapGet("/v2/session/{id}", (HttpContext c, string id) => inbox.Status(Owner(c), id));
            app.MapPost("/v2/session/{id}/pause", (HttpContext c, string id) => { inbox.Pause(Owner(c), id); return new { ok = true }; });
        }
        app.MapPost("/v1/unpair", (HttpContext c) => { trust.Revoke(Owner(c)); captures.RevokeAll(); inbox?.Revoke(); return new { ok = true }; });
        app.MapPost("/v1/capture", (HttpContext c) => captures.Begin(Owner(c), Body<CaptureRequest>(c)));
        app.MapGet("/v1/capture/{id}", (HttpContext c, string id) => captures.Read(Owner(c), id));
        app.MapPost("/v1/capture/{id}/ack", (HttpContext c, string id) => { captures.Ack(Owner(c), id); return new { ok = true }; });
        app.MapPost("/v1/capture/{id}/cancel", (HttpContext c, string id) => { captures.Cancel(Owner(c), id); return new { ok = true }; });
        return app;
    }
    private static string Owner(HttpContext c) => (string)c.Items["owner"]!;
    private static T Body<T>(HttpContext c) => JsonSerializer.Deserialize<T>((string)c.Items["body"]!, new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? throw new BridgeException("INVALID_REQUEST");
}
