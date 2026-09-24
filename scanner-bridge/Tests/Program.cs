using System.Net;
using System.Net.Http.Json;
using System.Net.Security;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using TradingDocks.ScannerBridge;

const string origin = "https://www.tradingdocks.com";
var count = 0;
void Check(bool value, string name) { if (!value) throw new Exception("FAIL: " + name); Console.WriteLine("PASS: " + name); count++; }
void Reject(Action action, string code) { try { action(); throw new Exception("Expected " + code); } catch (BridgeException e) { Check(e.Message == code, code); } }
var clock = new Clock();
var store = new Store();
string code = "";
var trust = new Trust(store, p => { code = p.Code; return Task.FromResult(true); }, clock);
using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
string Random() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
var challenge = Random();
var start = new PairStart(challenge, Convert.ToBase64String(key.ExportSubjectPublicKeyInfo()));
var pair = await trust.Begin(origin, start);
Reject(() => trust.Finish("https://evil.invalid", new(pair, challenge, code)), "PAIR_EXPIRED_OR_INVALID");
var credential = trust.Finish(origin, new(pair, challenge, code));
Reject(() => trust.Finish(origin, new(pair, challenge, code)), "PAIR_EXPIRED_OR_INVALID");
try { await trust.Begin(origin, start); throw new Exception("replay accepted"); } catch (BridgeException e) { Check(e.Message == "PAIR_REJECTED", "pair replay denied"); }
var expChallenge = Random(); var expId = await trust.Begin(origin, start with { Challenge = expChallenge });
clock.Advance(TimeSpan.FromMinutes(3));
Reject(() => trust.Finish(origin, new(expId, expChallenge, code)), "PAIR_EXPIRED_OR_INVALID");
clock.Advance(TimeSpan.FromMinutes(-3));

var backend = new Backend();
using var captures = new Captures(backend);
using var rsa = RSA.Create(2048);
var certRequest = new CertificateRequest("CN=Scanner Bridge test", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
certRequest.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
var san = new SubjectAlternativeNameBuilder(); san.AddIpAddress(IPAddress.Loopback); certRequest.CertificateExtensions.Add(san.Build());
using var generated = certRequest.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddHours(1));
using var cert = X509CertificateLoader.LoadPkcs12(generated.Export(X509ContentType.Pfx), null, X509KeyStorageFlags.UserKeySet);
// Even hostile hosting environment must not add a second listener.
Environment.SetEnvironmentVariable("Kestrel__Endpoints__Injected__Url", "http://0.0.0.0:47393");
Environment.SetEnvironmentVariable("ASPNETCORE_URLS", "http://0.0.0.0:47394");
await using var app = BridgeHost.Create(new(cert, [origin], 47392), trust, captures, backend, "test-workstation");
await app.StartAsync();
try
{
    Check(app.Urls.Count == 1 && app.Urls.Single() == "https://127.0.0.1:47392", "only HTTPS loopback listener despite environment");
    using var handler = new HttpClientHandler();
    handler.ServerCertificateCustomValidationCallback = (_, remote, _, errors) =>
    {
        if (remote is null || (errors & SslPolicyErrors.RemoteCertificateNameMismatch) != 0) return false;
        using var chain = new X509Chain(); chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;
        chain.ChainPolicy.CustomTrustStore.Add(cert); chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
        return chain.Build(remote);
    };
    using var client = new HttpClient(handler) { BaseAddress = new("https://127.0.0.1:47392") };
    HttpRequestMessage Request(string method, string path, string body = "", string? nonce = null, bool signed = true, string requestOrigin = origin)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), path); request.Headers.Add("Origin", requestOrigin);
        if (body != "") request.Content = new StringContent(body, Encoding.UTF8, "application/json");
        if (signed)
        {
            var timestamp = clock.GetUtcNow().ToUnixTimeMilliseconds().ToString(); nonce ??= Random();
            var digest = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(body))).ToLowerInvariant();
            var proof = key.SignData(Encoding.UTF8.GetBytes($"{method}\n{path}\n{timestamp}\n{nonce}\n{digest}"), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
            request.Headers.Add("X-TD-Credential", credential.Id); request.Headers.Add("X-TD-Timestamp", timestamp);
            request.Headers.Add("X-TD-Nonce", nonce); request.Headers.Add("X-TD-Proof", Convert.ToBase64String(proof));
        }
        return request;
    }
    async Task<JsonElement> Ok(HttpRequestMessage request) { using var response = await client.SendAsync(request); var text = await response.Content.ReadAsStringAsync(); Check(response.IsSuccessStatusCode, request.RequestUri + " " + response.StatusCode); return JsonSerializer.Deserialize<JsonElement>(text); }
    async Task Denied(HttpRequestMessage request, int status, string name) { using var response = await client.SendAsync(request); Check((int)response.StatusCode == status, name + " (" + response.StatusCode + ")"); }
    await Ok(Request("GET", "/v1/health", signed: false));
    await Denied(Request("GET", "/v1/devices", signed: false), 401, "unpaired device enumeration");
    await Denied(Request("GET", "/v1/devices", requestOrigin: "https://evil.invalid"), 403, "wrong origin");
    var badHost = Request("GET", "/v1/health", signed: false); badHost.Headers.Host = "evil.invalid";
    try { await Denied(badHost, 403, "DNS rebinding host"); } catch (HttpRequestException e) when (e.InnerException is System.Security.Authentication.AuthenticationException) { Check(true, "TLS rejects DNS rebinding hostname"); }
    var invalid = Request("GET", "/v1/devices"); invalid.Headers.Remove("X-TD-Credential"); invalid.Headers.Add("X-TD-Credential", "invalid"); await Denied(invalid, 401, "invalid credential");
    var proofBad = Request("GET", "/v1/devices"); proofBad.Headers.Remove("X-TD-Proof"); proofBad.Headers.Add("X-TD-Proof", "AAAA"); await Denied(proofBad, 401, "invalid proof");
    var nonce = Random(); await Ok(Request("GET", "/v1/devices", nonce: nonce)); await Denied(Request("GET", "/v1/devices", nonce: nonce), 409, "signed request replay");
    foreach (var path in new[] { "/v1/files", "/v1/exec", "/v1/proxy", "/v1/upload" }) await Denied(Request("POST", path, "{}"), 404, "no arbitrary capability " + path);
    await Denied(Request("GET", "/v1/devices?path=C:/Windows"), 400, "no arbitrary path query");
    var captureRequest = new CaptureRequest(Guid.NewGuid().ToString(), "scanner", new(), DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    var body = JsonSerializer.Serialize(captureRequest);
    var result = await Ok(Request("POST", "/v1/capture", body)); var id = result.GetProperty("captureId").GetString()!;
    var duplicate = await Ok(Request("POST", "/v1/capture", body)); Check(duplicate.GetProperty("captureId").GetString() == id && backend.Calls == 1, "capture initiation idempotency");
    var image = await Ok(Request("GET", "/v1/capture/" + id)); Check(image.GetProperty("status").GetString() == "ready", "capture ready");
    Reject(() => captures.Read("other-browser", id), "CAPTURE_NOT_FOUND");
    await Denied(Request("POST", "/v1/capture", JsonSerializer.Serialize(captureRequest with { RequestId = Guid.NewGuid().ToString() })), 409, "unacknowledged capture backpressure");
    await Ok(Request("POST", $"/v1/capture/{id}/ack", "{}")); await Ok(Request("POST", $"/v1/capture/{id}/ack", "{}"));
    var ack = await Ok(Request("GET", "/v1/capture/" + id)); Check(ack.GetProperty("image").ValueKind == JsonValueKind.Null, "ack releases image memory");
    Check(backend.Released == 1, "duplicate acknowledgement releases capture resource exactly once");
    Reject(() => captures.Begin(credential.Id, captureRequest with { RequestId = Guid.NewGuid().ToString(), RequestedAt = 0 }), "CAPTURE_REQUEST_EXPIRED");
    backend.Oversize = true;
    var oversized = JsonSerializer.SerializeToElement(captures.Begin(credential.Id, captureRequest with { RequestId = Guid.NewGuid().ToString() })).GetProperty("captureId").GetString()!;
    Check(JsonSerializer.SerializeToElement(captures.Read(credential.Id, oversized)).GetProperty("error").GetString() == "IMAGE_LIMIT_EXCEEDED", "image size bound");
    backend.Oversize = false;
    var unsupported = JsonSerializer.SerializeToElement(captures.Begin(credential.Id, captureRequest with { RequestId = Guid.NewGuid().ToString(), Settings = new(Duplex: true) })).GetProperty("captureId").GetString()!;
    Check(JsonSerializer.SerializeToElement(captures.Read(credential.Id, unsupported)).GetProperty("error").GetString() == "UNSUPPORTED_SETTING", "capability validation");
    backend.Wait = true;
    var pending = JsonSerializer.SerializeToElement(captures.Begin(credential.Id, captureRequest with { RequestId = Guid.NewGuid().ToString() })).GetProperty("captureId").GetString()!;
    captures.Cancel(credential.Id, pending); await Task.Delay(50);
    Check(JsonSerializer.SerializeToElement(captures.Read(credential.Id, pending)).GetProperty("status").GetString() == "cancelled", "cancel suppresses delivery");
    clock.Advance(TimeSpan.FromDays(31)); await Denied(Request("GET", "/v1/devices"), 401, "expired trust denied");
    clock.Advance(TimeSpan.FromDays(-31)); trust.Revoke(); await Denied(Request("GET", "/v1/devices"), 401, "revoked trust denied");
    for (var i = 0; i < 12; i++) await client.SendAsync(Request("OPTIONS", "/v1/pair/start", signed: false));
    await Denied(Request("OPTIONS", "/v1/pair/start", signed: false), 429, "pair rate bound");
}
finally { await app.StopAsync(); Environment.SetEnvironmentVariable("Kestrel__Endpoints__Injected__Url", null); Environment.SetEnvironmentVariable("ASPNETCORE_URLS", null); }
await ScanSnapTests.Run(Check);
await InboxTests.Run(Check);
Console.WriteLine($"{count} security/contract assertions passed; no OS trust store changed.");

sealed class Store : ITrustStore { private TrustRecord[] records = []; public TrustRecord[] Load() => records; public void Save(TrustRecord[] value) => records = value; }
sealed class Clock : TimeProvider { private DateTimeOffset now = DateTimeOffset.UtcNow; public override DateTimeOffset GetUtcNow() => now; public void Advance(TimeSpan value) => now += value; }
sealed class Backend : IWindowsScannerBackend
{
    public int Calls; public int Released; public bool Oversize; public bool Wait;
    public Task<ScannerDevice[]> Devices(CancellationToken c) => Task.FromResult<ScannerDevice[]>([new("scanner", "Fixture WIA", "Fixture", "Mock", "USB", "WIA", new([300, 600], ["color"], ["flatbed"]))]);
    public async Task<CapturedImage> Capture(string id, ScanSettings settings, CancellationToken c) { Calls++; if (Wait) await Task.Delay(Timeout.Infinite, c); return new(new byte[Oversize ? Protocol.MaxImageBytes + 1 : 8], "image/png", 600, 800, () => Released++); }
}
