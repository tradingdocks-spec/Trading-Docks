using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TradingDocks.ScannerBridge;

namespace TradingDocks.ScannerBridge.Windows;

// The x86 child shares this agent's trust, routing, recovery and capture protocol.
// No arbitrary executable, source path or command line comes from the browser.
public sealed class TwainScannerBackend(byte[] salt, string? workerPath = null) : IWindowsScannerBackend, IScannerDiagnostics
{
    private readonly SemaphoreSlim gate = new(1);
    private readonly Dictionary<string, string> sources = new();
    private ScannerDiagnostic[] diagnostics = [];
    public ScannerDiagnostic[] Diagnostics => diagnostics;
    private sealed record NativeDevice(string NativeKey, string Name, string Manufacturer, int[] Dpi, bool Feeder, bool Duplex);
    private sealed record NativeError(string Name, string Code, string Detail);
    private sealed record Page(string Image, int Width, int Height);
    private sealed record Result(NativeDevice[]? Devices, NativeError[]? Errors, Page[]? Pages, string? Error);
    private async Task<Result> Invoke(object request, CancellationToken cancellation)
    {
        var path = workerPath ?? Path.Combine(AppContext.BaseDirectory, "twain-x86", "TradingDocks.TwainWorker.exe");
        if (!File.Exists(path)) throw new BridgeException("DRIVER_UNAVAILABLE");
        using var process = new Process { StartInfo = new(path) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = Path.GetDirectoryName(path)! } };
        process.Start();
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
        timeout.CancelAfter(TimeSpan.FromSeconds(85));
        try
        {
            await process.StandardInput.WriteLineAsync(JsonSerializer.Serialize(request)); process.StandardInput.Close();
            var output = process.StandardOutput.ReadToEndAsync(timeout.Token);
            var errors = process.StandardError.ReadToEndAsync(timeout.Token);
            await process.WaitForExitAsync(timeout.Token);
            var value = await output; await errors;
            if (process.ExitCode != 0 || value.Length > 24_000_000) throw new BridgeException("CAPTURE_FAILED");
            var result = JsonSerializer.Deserialize<Result>(value) ?? throw new BridgeException("DRIVER_UNAVAILABLE");
            if (result.Error is { } error) throw new BridgeException(error);
            return result;
        }
        catch (OperationCanceledException) { throw new BridgeException("CAPTURE_INTERRUPTED"); }
        finally { if (!process.HasExited) { process.Kill(entireProcessTree: true); await process.WaitForExitAsync(); } }
    }
    public async Task<ScannerDevice[]> Devices(CancellationToken cancellation)
    {
        await gate.WaitAsync(cancellation);
        try
        {
            sources.Clear();
            var result = await Invoke(new { Action = "devices" }, cancellation);
            diagnostics = (result.Errors ?? []).Select(e => new ScannerDiagnostic("TWAIN", e.Code, $"{e.Name}: {e.Detail}. Close other scanning applications and refresh devices.")).ToArray();
            var devices = new List<ScannerDevice>();
            foreach (var source in result.Devices ?? [])
            {
                var id = "twain-" + Convert.ToHexString(HMACSHA256.HashData(salt, Encoding.UTF8.GetBytes(source.NativeKey))).ToLowerInvariant();
                sources[id] = source.NativeKey;
                devices.Add(new(id, source.Name, source.Manufacturer, source.Name, "Windows TWAIN (32-bit)", "TWAIN", new(source.Dpi, ["color"], source.Feeder ? ["feeder"] : ["flatbed"], Duplex: source.Duplex)));
            }
            return devices.ToArray();
        }
        catch (BridgeException error) { diagnostics = [new("TWAIN", error.Message, "TWAIN driver/worker unavailable. Repair the installed Scanner Agent and PaperStream driver.")]; return []; }
        finally { gate.Release(); }
    }
    public async Task<CapturedImage> Capture(string deviceId, ScanSettings settings, CancellationToken cancellation)
    {
        await gate.WaitAsync(cancellation);
        try
        {
            if (!sources.TryGetValue(deviceId, out var source)) throw new BridgeException("DEVICE_OFFLINE");
            var result = await Invoke(new { Action = "capture", NativeKey = source, Dpi = settings.Dpi, Feeder = settings.Source == "feeder", Duplex = settings.Duplex }, cancellation);
            if (result.Pages?.Length != (settings.Duplex ? 2 : 1)) throw new BridgeException("DUPLEX_INCOMPLETE");
            CapturedImage Decode(Page page) {
                var bytes = Convert.FromBase64String(page.Image);
                if (bytes.Length > Protocol.MaxImageBytes || page.Width > 3000 || page.Height > 3000) throw new BridgeException("IMAGE_LIMIT_EXCEEDED");
                return new(bytes, "image/jpeg", page.Width, page.Height);
            }
            var front = Decode(result.Pages[0]);
            try { return settings.Duplex ? front with { Back = Decode(result.Pages[1]) } : front; }
            catch { front.Dispose(); throw; }
        }
        finally { gate.Release(); }
    }
}
