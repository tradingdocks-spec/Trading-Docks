using System.Security.Cryptography;

namespace TradingDocks.ScannerBridge;

public record LiveInboxSession(string Id, string WorkspaceId, string BatchId, string DestinationId, string WorkstationId, string DeviceId, int Limit = 100);

// Polling reconciles filesystem notifications: repeated/omitted events cannot create cards.
// Only this fixed application-owned directory is enumerated, never browser-supplied paths.
public sealed class ScannerInbox(string root, IScanSnapPlatform platform, int pollMilliseconds = 250)
{
    private readonly object gate = new();
    private LiveInboxSession? session;
    private string? owner;
    private DateTimeOffset expires;
    private HashSet<string> baseline = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Entry> requests = new();
    private readonly HashSet<string> claimed = new(StringComparer.OrdinalIgnoreCase);
    private sealed record Entry(string Path, string Fingerprint, byte[] Bytes, int Width, int Height);
    private int accepted;
    private bool paused;
    public string Root => root;
    public void Prepare() { lock (gate) EnsureRoot(); }
    public void Expire()
    {
        lock (gate) if (session is not null && expires <= DateTimeOffset.UtcNow)
        {
            foreach (var entry in requests.Values) CryptographicOperations.ZeroMemory(entry.Bytes);
            requests.Clear(); paused = true;
            // Unacknowledged source files remain local for explicit owner recovery.
            // Never move them into a subsequent batch after expiry or restart.
        }
    }
    private static string Fingerprint(string path) { var f = new FileInfo(path); return $"{f.Name}|{f.Length}|{f.CreationTimeUtc.Ticks}|{f.LastWriteTimeUtc.Ticks}"; }
    private void EnsureRoot()
    {
        var ancestor = Path.GetFullPath(root);
        while (!Directory.Exists(ancestor)) ancestor = Path.GetDirectoryName(ancestor) ?? throw new BridgeException("UNSAFE_CAPTURE_PATH");
        ScanSnapBackend.NoLinks(ancestor); Directory.CreateDirectory(root); ScanSnapBackend.NoLinks(root);
    }
    public void Start(string credential, LiveInboxSession value)
    {
        if (!Guid.TryParse(value.Id, out _) || !Guid.TryParse(value.WorkspaceId, out _) || !Guid.TryParse(value.BatchId, out _) || string.IsNullOrWhiteSpace(value.DestinationId) || value.DestinationId.Length > 200 || value.Limit != 100 || value.DeviceId.Length > 128 || string.IsNullOrEmpty(value.WorkstationId)) throw new BridgeException("INVALID_SESSION");
        lock (gate)
        {
            EnsureRoot();
            if (session == value && owner == credential && expires > DateTimeOffset.UtcNow) { paused = false; expires = DateTimeOffset.UtcNow.AddMinutes(30); return; }
            if (session?.Id == value.Id) throw new BridgeException("SESSION_CONFLICT", 409);
            if (requests.Count > 0) throw new BridgeException("PENDING_CAPTURE_REQUIRES_RECOVERY", 409);
            // Files present before activation (including overflow #101) are preserved and excluded.
            baseline = Directory.EnumerateFiles(root).ToHashSet(StringComparer.OrdinalIgnoreCase);
            session = value; owner = credential; accepted = 0; claimed.Clear(); paused = false; expires = DateTimeOffset.UtcNow.AddMinutes(30);
        }
    }
    private void Authorize(string credential, string id)
    {
        if (owner != credential || session?.Id != id || expires <= DateTimeOffset.UtcNow) throw new BridgeException("SESSION_EXPIRED_OR_INVALID", 403);
    }
    public void Pause(string credential, string id) { lock (gate) { Authorize(credential, id); paused = true; } }
    public void ValidateDevice(string credential, string id, string deviceId) { lock (gate) { Authorize(credential, id); if (session!.DeviceId != deviceId) throw new BridgeException("SESSION_DEVICE_MISMATCH", 403); } }
    public void Revoke() { lock (gate) { foreach (var entry in requests.Values) CryptographicOperations.ZeroMemory(entry.Bytes); requests.Clear(); paused = true; owner = null; } }
    public object Status(string credential, string id)
    {
        lock (gate) { Authorize(credential, id); return new { sessionId = id, batchId = session!.BatchId, accepted, paused, full = accepted >= 100, pending = requests.Count }; }
    }
    public async Task<CapturedImage> Capture(string credential, string id, string requestId, CancellationToken cancellation)
    {
        Dictionary<string, (string Fingerprint, int Count)> stable = new(StringComparer.OrdinalIgnoreCase);
        while (true)
        {
            cancellation.ThrowIfCancellationRequested();
            lock (gate)
            {
                Authorize(credential, id);
                if (requests.TryGetValue(requestId, out var pending)) return Image(pending);
                if (accepted >= 100) throw new BridgeException("BATCH_FULL", 409);
                if (paused) throw new BridgeException("SESSION_PAUSED", 409);
                if (!platform.SoftwareInstalled || platform.ConnectedDevices().Length == 0) throw new BridgeException("DEVICE_OFFLINE");
                EnsureRoot();
                foreach (var path in Directory.EnumerateFiles(root).OrderBy(File.GetCreationTimeUtc))
                {
                    ScanSnapBackend.NoLinks(path);
                    var fingerprint = Fingerprint(path);
                    if (baseline.Contains(path) || claimed.Contains(path)) continue;
                    if (!new[] { ".jpg", ".jpeg" }.Contains(Path.GetExtension(path).ToLowerInvariant())) continue;
                    var previous = stable.GetValueOrDefault(path);
                    var count = previous.Fingerprint == fingerprint ? previous.Count + 1 : 0;
                    stable[path] = (fingerprint, count);
                    if (count < 3 || new FileInfo(path).Length == 0) continue;
                    CapturedImage decoded;
                    try { decoded = platform.DecodeImage(path); }
                    catch (IOException) { continue; }
                    catch (BridgeException) { baseline.Add(path); throw; } // Bad file remains local, never silently uploaded.
                    using (decoded)
                    {
                        var entry = new Entry(path, fingerprint, decoded.Bytes.ToArray(), decoded.Width, decoded.Height);
                        requests.Add(requestId, entry); claimed.Add(path); accepted++;
                        if (accepted == 100) paused = true;
                        return Image(entry);
                    }
                }
            }
            await Task.Delay(pollMilliseconds, cancellation);
        }
    }
    private static CapturedImage Image(Entry entry) => new(entry.Bytes.ToArray(), "image/jpeg", entry.Width, entry.Height);
    public void Ack(string credential, string id, string requestId)
    {
        lock (gate)
        {
            Authorize(credential, id);
            if (!requests.TryGetValue(requestId, out var entry)) return;
            // Never delete a replaced file. Keep pending on sharing violations for retry.
            if (File.Exists(entry.Path)) { ScanSnapBackend.NoLinks(entry.Path); if (Fingerprint(entry.Path) == entry.Fingerprint) File.Delete(entry.Path); }
            CryptographicOperations.ZeroMemory(entry.Bytes); requests.Remove(requestId);
        }
    }
}
