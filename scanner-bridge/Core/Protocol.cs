namespace TradingDocks.ScannerBridge;

public record ScanCapabilities(int[] Dpi, string[] ColorModes, string[] Sources, bool Duplex = false, bool AutoCrop = false, bool CancelCapture = false);
public record ScannerDevice(string Id, string DisplayName, string Manufacturer, string Model, string Connection, string Backend, ScanCapabilities Capabilities);
public record ScanSettings(int Dpi = 300, string ColorMode = "color", string Source = "flatbed", bool Duplex = false, bool AutoCrop = false);
public record CaptureRequest(string RequestId, string DeviceId, ScanSettings Settings, long RequestedAt);
public record CapturedImage(byte[] Bytes, string MimeType, int Width, int Height);
public interface IWindowsScannerBackend
{
    Task<ScannerDevice[]> Devices(CancellationToken cancellation);
    Task<CapturedImage> Capture(string deviceId, ScanSettings settings, CancellationToken cancellation);
}
public sealed class BridgeException(string code, int status = 400) : Exception(code)
{
    public int Status { get; } = status;
}
public static class Protocol
{
    public const int Version = 1;
    public const int Port = 47391;
    public const string VersionString = "1.0.0";
    public const int MaxImageBytes = 8 * 1024 * 1024;
    public static void Validate(ScanSettings settings, ScanCapabilities caps)
    {
        if (!caps.Dpi.Contains(settings.Dpi) || !caps.ColorModes.Contains(settings.ColorMode) || !caps.Sources.Contains(settings.Source)
            || settings.Duplex && !caps.Duplex || settings.AutoCrop && !caps.AutoCrop) throw new BridgeException("UNSUPPORTED_SETTING");
    }
}
