using System.Collections.Concurrent;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using TradingDocks.ScannerBridge;

namespace TradingDocks.ScannerBridge.Windows;

// WIA COM objects are created, used and released only on one dedicated STA thread.
public sealed class WiaScannerBackend : IWindowsScannerBackend, IDisposable
{
    private readonly BlockingCollection<Action> work = new(8);
    private readonly Thread worker;
    private readonly byte[] salt;
    private readonly Dictionary<string, string> deviceIds = new();
    public WiaScannerBackend(byte[] salt)
    {
        this.salt = salt;
        worker = new Thread(() => { foreach (var action in work.GetConsumingEnumerable()) action(); }) { IsBackground = true, Name = "Scanner WIA STA" };
        worker.SetApartmentState(ApartmentState.STA); worker.Start();
    }
    private Task<T> Run<T>(Func<T> operation, CancellationToken cancellation)
    {
        var result = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!work.TryAdd(() => { try { cancellation.ThrowIfCancellationRequested(); result.SetResult(operation()); } catch (COMException e) { result.SetException(new BridgeException(Error(e.ErrorCode))); } catch (Exception e) { result.SetException(e); } })) throw new BridgeException("DEVICE_BUSY", 409);
        return result.Task;
    }
    public Task<ScannerDevice[]> Devices(CancellationToken cancellation) => Run(() =>
    {
        dynamic manager = Activator.CreateInstance(Type.GetTypeFromProgID("WIA.DeviceManager") ?? throw new BridgeException("BACKEND_UNAVAILABLE"))!;
        var devices = new List<ScannerDevice>();
        try
        {
            deviceIds.Clear();
            foreach (dynamic info in manager.DeviceInfos)
            {
                try
                {
                    if ((int)info.Type != 1) continue;
                    string nativeId = info.DeviceID;
                    var id = Convert.ToHexString(HMACSHA256.HashData(salt, Encoding.UTF8.GetBytes(nativeId))).ToLowerInvariant();
                    dynamic device = info.Connect();
                    try
                    {
                        dynamic item = device.Items[1];
                        try
                        {
                            int[] xDpi = Values(item.Properties, 6147, new[] { 300, 600 });
                            int[] yDpi = Values(item.Properties, 6148, new[] { 300, 600 });
                            int[] dpi = xDpi.Intersect(yDpi).Where(d => Supports(item.Properties, 6151, d * 3) && Supports(item.Properties, 6152, d * 4)).ToArray();
                            if (!Supports(item.Properties, 6146, 1)) continue;
                            if (dpi.Length == 0) continue;
                            var sources = new List<string>();
                            int handling = Convert.ToInt32(Read(device.Properties, 3086, 2));
                            if ((handling & 2) != 0) sources.Add("flatbed"); if ((handling & 1) != 0) sources.Add("feeder");
                            if (sources.Count == 0) sources.Add("flatbed");
                            string name = Convert.ToString(Read(info.Properties, 7, "WIA Scanner"))!;
                            string manufacturer = Convert.ToString(Read(info.Properties, 3, "Unknown"))!;
                            deviceIds[id] = nativeId;
                            devices.Add(new(id, name, manufacturer, name, "Driver-managed", "WIA", new(dpi, ["color"], sources.ToArray())));
                        } finally { Release(item); }
                    } finally { Release(device); }
                }
                catch (COMException) { /* Offline devices cannot advertise usable capabilities. */ }
                finally { Release(info); }
            }
        } finally { Release(manager); }
        return devices.ToArray();
    }, cancellation);
    public Task<CapturedImage> Capture(string deviceId, ScanSettings settings, CancellationToken cancellation) => Run(() =>
    {
        if (!deviceIds.TryGetValue(deviceId, out var nativeId)) throw new BridgeException("DEVICE_OFFLINE");
        dynamic manager = Activator.CreateInstance(Type.GetTypeFromProgID("WIA.DeviceManager")!)!;
        try
        {
            foreach (dynamic info in manager.DeviceInfos)
            {
                try
                {
                    if ((string)info.DeviceID != nativeId) continue;
                    dynamic device = info.Connect();
                    try
                    {
                        // Single-side, one transfer. No driver UI or file paths are accepted over HTTP.
                        if (!Write(device.Properties, 3088, settings.Source == "feeder" ? 1 : 2) && settings.Source == "feeder") throw new BridgeException("UNSUPPORTED_SETTING");
                        dynamic item = device.Items[1];
                        try
                        {
                            if (!Write(item.Properties, 6146, 1) || !Write(item.Properties, 6147, settings.Dpi) || !Write(item.Properties, 6148, settings.Dpi)) throw new BridgeException("UNSUPPORTED_SETTING");
                            // Bound driver output to a card-sized region (3 x 4 inches) where writable.
                            if (!Write(item.Properties, 6151, settings.Dpi * 3) || !Write(item.Properties, 6152, settings.Dpi * 4)) throw new BridgeException("UNSUPPORTED_SETTING");
                            dynamic image = item.Transfer("{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}");
                            try
                            {
                                cancellation.ThrowIfCancellationRequested();
                                byte[] bytes = (byte[])image.FileData.get_BinaryData();
                                if (bytes.Length > 32 * 1024 * 1024) throw new BridgeException("IMAGE_LIMIT_EXCEEDED");
                                using var input = new MemoryStream(bytes); using var bitmap = Image.FromStream(input);
                                if ((long)bitmap.Width * bitmap.Height > 20_000_000) throw new BridgeException("IMAGE_LIMIT_EXCEEDED");
                                var ratio = Math.Min(1, 2500d / Math.Max(bitmap.Width, bitmap.Height));
                                using var normalized = new Bitmap(bitmap, Math.Max(1, (int)(bitmap.Width * ratio)), Math.Max(1, (int)(bitmap.Height * ratio)));
                                using var output = new MemoryStream(); normalized.Save(output, ImageFormat.Jpeg);
                                return new CapturedImage(output.ToArray(), "image/jpeg", normalized.Width, normalized.Height);
                            } finally { Release(image); }
                        } finally { Release(item); }
                    } finally { Release(device); }
                } finally { Release(info); }
            }
            throw new BridgeException("DEVICE_OFFLINE");
        } finally { Release(manager); }
    }, cancellation);
    private static object Read(dynamic properties, int id, object fallback) { foreach (dynamic p in properties) { try { if ((int)p.PropertyID == id) return p.get_Value(); } finally { Release(p); } } return fallback; }
    private static bool Write(dynamic properties, int id, int value) { foreach (dynamic p in properties) { try { if ((int)p.PropertyID == id) { if ((bool)p.IsReadOnly) return (int)p.get_Value() == value; p.set_Value(value); return (int)p.get_Value() == value; } } finally { Release(p); } } return false; }
    private static bool Supports(dynamic properties, int id, int value) => Values(properties, id, new[] { value }).Length != 0;
    private static int[] Values(dynamic properties, int id, int[] preferred)
    {
        foreach (dynamic p in properties) try
        {
            if ((int)p.PropertyID != id) continue;
            if ((bool)p.IsReadOnly) return preferred.Contains((int)p.get_Value()) ? [(int)p.get_Value()] : [];
            int kind = p.SubType;
            if (kind == 1) { int min = p.SubTypeMin, max = p.SubTypeMax, step = Math.Max(1, (int)p.SubTypeStep); return preferred.Where(v => v >= min && v <= max && (v - min) % step == 0).ToArray(); }
            if (kind == 2) { var values = new List<int>(); foreach (var value in p.SubTypeValues) values.Add(Convert.ToInt32(value)); return preferred.Intersect(values).ToArray(); }
            return preferred.Contains((int)p.get_Value()) ? [(int)p.get_Value()] : [];
        } finally { Release(p); }
        return [];
    }
    private static void Release(object? value) { if (value is not null && Marshal.IsComObject(value)) Marshal.FinalReleaseComObject(value); }
    private static string Error(int code) => unchecked((uint)code) switch { 0x80210002 => "PAPER_JAM", 0x80210003 => "NO_MEDIA", 0x80210006 => "DEVICE_BUSY", 0x80210005 => "DEVICE_OFFLINE", 0x8021000C => "UNSUPPORTED_SETTING", _ => "CAPTURE_FAILED" };
    public void Dispose() { work.CompleteAdding(); }
}
