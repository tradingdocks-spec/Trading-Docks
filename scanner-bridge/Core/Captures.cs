namespace TradingDocks.ScannerBridge;

public sealed class Captures(IWindowsScannerBackend backend, ScannerInbox? inbox = null) : IDisposable
{
    private readonly object gate = new();
    private readonly Dictionary<string, Job> jobs = new();
    private bool hardwareBusy;
    private sealed class Job(string owner, CaptureRequest request)
    {
        public readonly string Owner = owner;
        public readonly CaptureRequest Request = request;
        public readonly string Id = Guid.NewGuid().ToString();
        public readonly CancellationTokenSource Cancellation = new(TimeSpan.FromSeconds(90));
        public readonly DateTimeOffset Created = DateTimeOffset.UtcNow;
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
            foreach (var job in jobs.Values.Where(j => j.Created < DateTimeOffset.UtcNow.AddMinutes(j.Request.SessionId is null ? -2 : -30))) { job.Cancellation.Cancel(); job.Image?.Dispose(); job.Image = null; if (job.State is "ready" or "capturing") job.State = "expired"; }
            foreach (var key in jobs.Where(j => j.Value.Created < DateTimeOffset.UtcNow.AddMinutes(-35) && j.Value.Finished).Select(j => j.Key).ToArray()) { jobs[key].Cancellation.Dispose(); jobs.Remove(key); }
        }
    }
    public object Begin(string owner, CaptureRequest request)
    {
        if (!Guid.TryParse(request.RequestId, out _) || request.DeviceId.Length > 128) throw new BridgeException("INVALID_CAPTURE");
        lock (gate)
        {
            Expire();
            if (jobs.TryGetValue(request.RequestId, out var previous)) { if (previous.Owner != owner || previous.Request != request) throw new BridgeException("CAPTURE_CONFLICT", 409); return new { captureId = previous.Id }; }
            if (Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - (double)request.RequestedAt) > 120_000) throw new BridgeException("CAPTURE_REQUEST_EXPIRED", 409);
            if (hardwareBusy || jobs.Values.Any(j => j.State == "ready")) throw new BridgeException("DEVICE_BUSY", 409);
            if (jobs.Count >= 256) throw new BridgeException("RATE_LIMITED", 429);
            var job = new Job(owner, request); jobs[request.RequestId] = job; hardwareBusy = true;
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
            var image = job.Request.SessionId is { } sessionId
                ? await (inbox ?? throw new BridgeException("UPDATE_REQUIRED")).Capture(job.Owner, sessionId, job.Request.RequestId, job.Cancellation.Token)
                : await backend.Capture(device.Id, job.Request.Settings, new CaptureContext(job.Request.RequestId, job.Id), job.Cancellation.Token);
            if (image.Bytes.Length > Protocol.MaxImageBytes || image.Width > 3000 || image.Height > 3000 || image.Width < 1 || image.Height < 1 || image.MimeType is not ("image/jpeg" or "image/png")) { image.Dispose(); throw new BridgeException("IMAGE_LIMIT_EXCEEDED"); }
            lock (gate) { if (!job.Cancellation.IsCancellationRequested || job.Request.SessionId is not null) { job.Image = image; job.State = "ready"; } else { image.Dispose(); job.State = "cancelled"; } }
        }
        catch (Exception error) { lock (gate) { job.State = job.Cancellation.IsCancellationRequested ? "cancelled" : "failed"; job.Error = error is BridgeException ? error.Message : "CAPTURE_FAILED"; } }
        finally { lock (gate) { hardwareBusy = false; job.Finished = true; } }
    }
    public object Read(string owner, string id)
    {
        lock (gate) { Expire(); var job = Find(owner, id); return new { captureId = job.Id, status = job.State, error = job.Error, mimeType = job.Image?.MimeType, width = job.Image?.Width, height = job.Image?.Height, image = job.Image is null ? null : Convert.ToBase64String(job.Image.Bytes) }; }
    }
    public void Ack(string owner, string id) { lock (gate) { var job = Find(owner, id); if (job.State is not ("ready" or "acknowledged")) throw new BridgeException("CAPTURE_NOT_READY", 409); if (job.Request.SessionId is { } sessionId) inbox!.Ack(owner, sessionId, job.Request.RequestId); job.Image?.Dispose(); job.Image = null; job.State = "acknowledged"; } }
    public void Cancel(string owner, string id) { lock (gate) { var job = Find(owner, id); if (job.Request.SessionId is not null && job.State == "ready") return; job.Cancellation.Cancel(); job.Image?.Dispose(); job.Image = null; job.State = "cancelled"; } }
    public void RevokeAll() { lock (gate) foreach (var job in jobs.Values) { job.Cancellation.Cancel(); job.Image?.Dispose(); job.Image = null; job.State = "cancelled"; } }
    private Job Find(string owner, string id) => jobs.Values.FirstOrDefault(j => j.Id == id && j.Owner == owner) ?? throw new BridgeException("CAPTURE_NOT_FOUND", 404);
    public void Dispose() { RevokeAll(); }
}
