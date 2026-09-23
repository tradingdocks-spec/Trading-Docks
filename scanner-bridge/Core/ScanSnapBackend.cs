using System.Security.Cryptography;
using System.Text;

namespace TradingDocks.ScannerBridge;

public interface IScanSnapPlatform
{
    bool SoftwareInstalled { get; }
    string[] ConnectedDevices();
    // Local UI only: the browser never chooses or receives filesystem paths.
    IDisposable ShowCaptureDestination(string path, CancellationToken cancellation);
    CapturedImage DecodeImage(string path);
}

public sealed class ScanSnapBackend : IWindowsScannerBackend, IDisposable
{
    private readonly IScanSnapPlatform platform;
    private readonly string outputRoot;
    private readonly byte[] salt;
    private readonly Timer retention;
    public ScanSnapBackend(IScanSnapPlatform platform, string outputRoot, byte[] salt)
    {
        this.platform = platform; this.outputRoot = outputRoot; this.salt = salt;
        retention = new Timer(_ => CleanupExpired(), null, TimeSpan.Zero, TimeSpan.FromMinutes(1));
    }
    private void CleanupExpired()
    {
        try
        {
            if (!Directory.Exists(outputRoot)) return;
            NoLinks(outputRoot);
            foreach (var directory in Directory.EnumerateDirectories(outputRoot))
            {
                var parts = Path.GetFileName(directory).Split('-');
                if (parts.Length != 3 || parts.Any(p => !Guid.TryParseExact(p, "N", out _))) continue;
                NoLinks(directory);
                if (Directory.GetCreationTimeUtc(directory) > DateTime.UtcNow.AddMinutes(-3)) continue;
                var file = Path.Combine(directory, "capture.jpg");
                if (File.Exists(file)) { NoLinks(file); File.Delete(file); }
                if (!Directory.EnumerateFileSystemEntries(directory).Any()) Directory.Delete(directory, false);
            }
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or BridgeException) { /* Fail closed; no traversal or recursive deletion. */ }
    }
    public void Dispose() => retention.Dispose();
    private string DeviceId(string nativeId) => "scansnap-" + Convert.ToHexString(HMACSHA256.HashData(salt, Encoding.UTF8.GetBytes(nativeId))).ToLowerInvariant();
    public Task<ScannerDevice[]> Devices(CancellationToken cancellation)
    {
        cancellation.ThrowIfCancellationRequested();
        return Task.FromResult(platform.SoftwareInstalled ? platform.ConnectedDevices().Select(id => new ScannerDevice(DeviceId(id), "ScanSnap iX500", "Fujitsu / Ricoh", "iX500", "USB", "SCANSNAP",
            new([300], ["color"], ["feeder"], CancelCapture: true, ExternalSettings: true,
                CaptureInstruction: "Waiting for ScanSnap: place card in feeder and press Scan on the iX500. Save one JPEG to the exact capture destination shown in the local bridge window. Configure Trading Docks Cards in ScanSnap Home: 300 DPI, color, single-sided, JPEG. Settings are managed in ScanSnap Home."))).ToArray() : []);
    }
    public Task<CapturedImage> Capture(string id, ScanSettings settings, CancellationToken cancellation) => Capture(id, settings, new(Guid.NewGuid().ToString(), Guid.NewGuid().ToString()), cancellation);
    public async Task<CapturedImage> Capture(string id, ScanSettings settings, CaptureContext context, CancellationToken cancellation)
    {
        var device = (await Devices(cancellation)).FirstOrDefault(d => d.Id == id) ?? throw new BridgeException("DEVICE_OFFLINE");
        Protocol.Validate(settings, device.Capabilities);
        if (!Guid.TryParse(context.RequestId, out var request) || !Guid.TryParse(context.CaptureId, out var capture)) throw new BridgeException("INVALID_CAPTURE");
        // Inspect existing ancestors before creating anything through them.
        var ancestor = Path.GetFullPath(outputRoot);
        while (!Directory.Exists(ancestor)) ancestor = Path.GetDirectoryName(ancestor) ?? throw new BridgeException("UNSAFE_CAPTURE_PATH");
        NoLinks(ancestor);
        Directory.CreateDirectory(outputRoot);
        NoLinks(outputRoot);
        // Never reuse a session directory, including after a process restart or cancellation.
        var directory = Path.Combine(outputRoot, $"{request:N}-{capture:N}-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, "capture.jpg");
        var transferred = false;
        void Cleanup()
        {
            // Nonrecursive, exact file only. Refuse links and leave unexpected contents alone.
            try { NoLinks(directory); if (File.Exists(path)) { NoLinks(path); File.Delete(path); } Directory.Delete(directory, false); }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException or BridgeException) { /* Never follow links or delete unrelated files. */ }
        }
        try
        {
            using var prompt = platform.ShowCaptureDestination(path, cancellation);
            long priorLength = -1; DateTime priorWrite = default; var stable = 0;
            while (true)
            {
                cancellation.ThrowIfCancellationRequested();
                if (!(await Devices(cancellation)).Any(d => d.Id == id)) throw new BridgeException("DEVICE_OFFLINE");
                NoLinks(directory);
                if (File.Exists(path))
                {
                    NoLinks(path);
                    var info = new FileInfo(path);
                    if (info.Length > Protocol.MaxImageBytes) throw new BridgeException("IMAGE_LIMIT_EXCEEDED");
                    stable = info.Length == priorLength && info.LastWriteTimeUtc == priorWrite ? stable + 1 : 0;
                    priorLength = info.Length; priorWrite = info.LastWriteTimeUtc;
                    if (stable >= 2 && info.Length > 0)
                    {
                        CapturedImage image;
                        try { image = platform.DecodeImage(path); }
                        catch (IOException) { await Task.Delay(250, cancellation); continue; } // Writer still owns file.
                        if (cancellation.IsCancellationRequested) { image.Dispose(); cancellation.ThrowIfCancellationRequested(); }
                        transferred = true;
                        return new(image.Bytes, image.MimeType, image.Width, image.Height, Cleanup);
                    }
                }
                await Task.Delay(250, cancellation);
            }
        }
        finally { if (!transferred) Cleanup(); }
    }
    public static void NoLinks(string path)
    {
        for (var current = Path.GetFullPath(path); current is not null; current = Path.GetDirectoryName(current))
            if ((File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) throw new BridgeException("UNSAFE_CAPTURE_PATH");
    }
}
