using System.Text.Json;
namespace TradingDocks.ScannerBridge;

public sealed class Captures(IWindowsScannerBackend backend, ScannerInbox? inbox = null, IRecoveryStore? recovery = null) : IDisposable
{
    private readonly object gate = new();
    private readonly Dictionary<string, Job> jobs = new();
    private bool hardwareBusy;
    private bool loaded;
    public string? RecoveryError { get; private set; }
    public void Maintain() { try { Expire(); } catch { RecoveryError = "RECOVERY_STORAGE_FAILED"; } }
    private sealed record Saved(string Owner, CaptureRequest Request, string Id, string State, string? Error, DateTimeOffset Created, byte[]? Bytes, string? Mime, int Width, int Height);
    private void Load()
    {
        if (RecoveryError is not null) throw new BridgeException(RecoveryError, 409);
        if (loaded) return;
        var bytes = recovery?.Read("captures");
        if (bytes is not null)
        {
            try
            {
                var saved = JsonSerializer.Deserialize<Saved[]>(bytes) ?? throw new InvalidDataException("Invalid recovery record");
                if (saved.Length > 4096) throw new InvalidDataException("Recovery capacity exceeded");
                foreach (var s in saved)
                {
                    var job = new Job(s.Owner, s.Request) { Id = s.Id, Created = s.Created, State = s.State == "capturing" ? "interrupted" : s.State, Error = s.State == "capturing" ? "CAPTURE_INTERRUPTED" : s.Error, Finished = true };
                    if (s.Bytes is not null) job.Image = new(s.Bytes, s.Mime!, s.Width, s.Height);
                    if (s.State == "capturing" && s.Request.SessionId is { } sessionId && inbox?.Recover(s.Owner, sessionId, s.Request.RequestId) is { } recovered) { job.Image = recovered; job.State = "ready"; job.Error = null; }
                    jobs.Add(s.Request.RequestId, job);
                }
            }
            finally { System.Security.Cryptography.CryptographicOperations.ZeroMemory(bytes); }
        }
        loaded = true;
    }
    private void Save()
    {
        if (recovery is null) return;
        var bytes = JsonSerializer.SerializeToUtf8Bytes(jobs.Values.Select(j => new Saved(j.Owner, j.Request, j.Id, j.State, j.Error, j.Created, j.State is "acknowledged" or "cancelled" ? null : j.Image?.Bytes, j.Image?.MimeType, j.Image?.Width ?? 0, j.Image?.Height ?? 0)).ToArray());
        try { recovery.Write("captures", bytes); }
        finally { System.Security.Cryptography.CryptographicOperations.ZeroMemory(bytes); }
    }
    private sealed class Job(string owner, CaptureRequest request)
    {
        public readonly string Owner = owner;
        public readonly CaptureRequest Request = request;
        public string Id = Guid.NewGuid().ToString();
        public readonly CancellationTokenSource Cancellation = new(TimeSpan.FromSeconds(90));
        public DateTimeOffset Created = DateTimeOffset.UtcNow;
        public string State = "capturing";
        public string? Error;
        public CapturedImage? Image;
        public bool Finished;
    }
    // Called by HTTP status/result and a host timer; image buffers are never archived.
    public void Expire()
    {
        inbox?.Expire();
        lock (gate)
        {
            Load();
            // Durable images never expire merely because a browser/network is offline.
            // A bounded queue applies backpressure until acknowledgement or discard.
            if (recovery is not null) return;
            foreach (var job in jobs.Values.Where(j => j.Created < DateTimeOffset.UtcNow.AddMinutes(j.Request.SessionId is null ? -2 : -30))) { job.Cancellation.Cancel(); job.Image?.Dispose(); job.Image = null; if (job.State is "ready" or "capturing") job.State = "expired"; }
            foreach (var key in jobs.Where(j => j.Value.Created < DateTimeOffset.UtcNow.AddMinutes(-35) && j.Value.Finished).Select(j => j.Key).ToArray()) { jobs[key].Cancellation.Dispose(); jobs.Remove(key); }
        }
    }
    public object Begin(string owner, CaptureRequest request)
    {
        request = request with { Authorization = null }; // Never persist expiring authorization tokens.
        if (!Guid.TryParse(request.RequestId, out _) || request.DeviceId.Length > 128) throw new BridgeException("INVALID_CAPTURE");
        lock (gate)
        {
            Expire();
            if (jobs.TryGetValue(request.RequestId, out var previous)) { if (previous.Owner != owner || previous.Request != request) throw new BridgeException("CAPTURE_CONFLICT", 409); return new { captureId = previous.Id }; }
            if (Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - (double)request.RequestedAt) > 120_000) throw new BridgeException("CAPTURE_REQUEST_EXPIRED", 409);
            if (hardwareBusy || jobs.Values.Any(j => j.State is "ready" or "interrupted")) throw new BridgeException("DEVICE_BUSY", 409);
            foreach (var key in jobs.Where(j => j.Value.Finished && (j.Value.State is "acknowledged" or "cancelled" or "failed") && j.Value.Created < DateTimeOffset.UtcNow.AddMinutes(-5)).Select(j => j.Key).ToArray()) jobs.Remove(key);
            if (jobs.Count >= 4096) throw new BridgeException("RATE_LIMITED", 429);
            var job = new Job(owner, request); if (request.Binding is not null) job.Id = request.RequestId; jobs[request.RequestId] = job;
            try { Save(); } catch { jobs.Remove(request.RequestId); throw; }
            hardwareBusy = true;
            _ = Run(job); return new { captureId = job.Id };
        }
    }
    private async Task Run(Job job)
    {
        try
        {
            var devices = await backend.Devices(job.Cancellation.Token);
            var device = devices.FirstOrDefault(d => d.Id == job.Request.DeviceId) ?? throw new BridgeException("DEVICE_OFFLINE", 404);
            Protocol.Validate(job.Request.Settings, device.Capabilities);
            if (job.Request.SessionId is { } scope) (inbox ?? throw new BridgeException("UPDATE_REQUIRED")).ValidateDevice(job.Owner, scope, job.Request.DeviceId);
            if (device.Backend == "SCANSNAP" && job.Request.SessionId is null && inbox is not null) throw new BridgeException("LIVE_SESSION_REQUIRED", 409);
            var image = device.Backend == "SCANSNAP" && job.Request.SessionId is { } sessionId
                ? await (inbox ?? throw new BridgeException("UPDATE_REQUIRED")).Capture(job.Owner, sessionId, job.Request.RequestId, job.Cancellation.Token)
                : await backend.Capture(device.Id, job.Request.Settings, new CaptureContext(job.Request.RequestId, job.Id), job.Cancellation.Token);
            if (image.Bytes.Length > Protocol.MaxImageBytes || image.Width > 3000 || image.Height > 3000 || image.Width < 1 || image.Height < 1 || image.MimeType is not ("image/jpeg" or "image/png")) { image.Dispose(); throw new BridgeException("IMAGE_LIMIT_EXCEEDED"); }
            lock (gate) { if (!job.Cancellation.IsCancellationRequested || job.Request.SessionId is not null || job.Request.Binding is not null) { job.Image = image; job.State = "ready"; Save(); } else { image.Dispose(); job.State = "cancelled"; Save(); } }
        }
        catch (Exception error) { lock (gate) { job.State = job.Image is not null ? "interrupted" : job.Cancellation.IsCancellationRequested ? job.Request.Binding is not null ? "interrupted" : "cancelled" : "failed"; job.Error = job.State == "interrupted" ? "CAPTURE_INTERRUPTED" : error is BridgeException ? error.Message : "CAPTURE_FAILED"; try { Save(); } catch { job.Error = "RECOVERY_STORAGE_FAILED"; } } }
        finally { lock (gate) { hardwareBusy = false; job.Finished = true; } }
    }
    public object Read(string owner, string id)
    {
        lock (gate) { Expire(); var job = Find(owner, id); return new { captureId = job.Id, status = job.State, error = job.Error, mimeType = job.Image?.MimeType, width = job.Image?.Width, height = job.Image?.Height, image = job.Image is null ? null : Convert.ToBase64String(job.Image.Bytes) }; }
    }
    public void Ack(string owner, string id) { lock (gate) { Load(); var job = Find(owner, id); if (job.State is not ("ready" or "acknowledged")) throw new BridgeException("CAPTURE_NOT_READY", 409); var previous = job.State; job.State = "acknowledged"; try { Save(); } catch { job.State = previous; throw; } if (job.Request.SessionId is { } sessionId) inbox?.Ack(owner, sessionId, job.Request.RequestId); job.Image?.Dispose(); job.Image = null; Save(); } }
    public void Cancel(string owner, string id) { lock (gate) { Load(); var job = Find(owner, id); if (job.State is "acknowledged" or "cancelled" or "failed") return; if ((job.Request.SessionId is not null || job.Request.Binding is not null) && job.State == "ready") return; job.Cancellation.Cancel(); job.Image?.Dispose(); job.Image = null; job.State = job.Request.Binding is not null ? "interrupted" : "cancelled"; job.Error = job.State == "interrupted" ? "CAPTURE_INTERRUPTED" : null; Save(); } }
    public object Pending(string owner) { lock (gate) { Load(); return jobs.Values.Where(j => j.Owner == owner && j.State is "ready" or "interrupted" or "capturing").Select(j => new { captureId = j.Id, request = j.Request, status = j.State }).ToArray(); } }
    public void Discard(string owner, string id) { lock (gate) { Load(); var job = Find(owner, id); if (!job.Finished) throw new BridgeException("DEVICE_BUSY", 409); job.State = "cancelled"; Save(); if (job.Request.SessionId is { } sessionId) inbox?.DiscardAttempt(owner, sessionId, job.Request.RequestId); job.Image?.Dispose(); job.Image = null; Save(); } }
    public void RevokeAll() { lock (gate) { Load(); foreach (var job in jobs.Values) { job.Cancellation.Cancel(); } } } // Revocation never destroys unacknowledged images.
    private Job Find(string owner, string id) => jobs.Values.FirstOrDefault(j => j.Id == id && j.Owner == owner) ?? throw new BridgeException("CAPTURE_NOT_FOUND", 404);
    public CaptureRequest Request(string owner, string id) { lock (gate) { Load(); return Find(owner, id).Request; } }
    public void Dispose() { RevokeAll(); } // Restart preserves durable records; OS releases in-memory buffers.
}
