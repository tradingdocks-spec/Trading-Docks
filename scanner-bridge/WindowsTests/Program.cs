using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using TradingDocks.ScannerBridge;
using TradingDocks.ScannerBridge.Windows;

// No physical capture, no local server or certificate changes. Synthetic JPEGs only.
using var dispatcher = new Control();
// This console diagnostic does not run a WinForms message loop.
SynchronizationContext.SetSynchronizationContext(null);
var platform = new ScanSnapPlatform(dispatcher);
if (args.SequenceEqual(["--detect"]))
{
    using var backend = new WindowsScannerBackend(new WiaScannerBackend(new byte[32]), new ScanSnapBackend(platform, Path.Combine(Path.GetTempPath(), "td-scansnap-detection-" + Guid.NewGuid().ToString("N")), new byte[32]));
    var devices = await backend.Devices(default);
    Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { softwareInstalled = platform.SoftwareInstalled, devices = devices.Select(d => new { d.DisplayName, d.Model, d.Backend, d.Connection }) }));
    return;
}
var root = Path.Combine(Path.GetTempPath(), "td-scansnap-image-tests-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(root);
var file = Path.Combine(root, "capture.jpg");
try
{
    using (var bitmap = new Bitmap(50, 70)) bitmap.Save(file, ImageFormat.Jpeg);
    using (var image = platform.DecodeImage(file)) { if (image.Width != 50 || image.Height != 70 || image.MimeType != "image/jpeg") throw new Exception("JPEG decode failed"); }
    Console.WriteLine("PASS: Windows JPEG validation / normalization / handle identity");
    File.WriteAllText(file, "not a JPEG");
    try { using var invalid = platform.DecodeImage(file); throw new Exception("Invalid image accepted"); } catch (BridgeException error) when (error.Message == "INVALID_IMAGE") { }
    using (var bitmap = new Bitmap(50, 70)) bitmap.Save(file, ImageFormat.Png);
    try { using var invalid = platform.DecodeImage(file); throw new Exception("False extension accepted"); } catch (BridgeException error) when (error.Message == "INVALID_IMAGE") { }
    Console.WriteLine("PASS: malformed image / MIME-extension mismatch rejected");
    var link = Path.Combine(root, "linked.jpg");
    if (!Native.CreateHardLink(link, file, IntPtr.Zero)) throw new Exception("Could not create isolated hard-link fixture");
    try { using var invalid = platform.DecodeImage(link); throw new Exception("Hard-linked input accepted"); } catch (BridgeException error) when (error.Message == "UNSAFE_CAPTURE_PATH") { }
    finally { File.Delete(link); }
    Console.WriteLine("PASS: hard-linked input rejected");
}
finally { File.Delete(file); Directory.Delete(root); }

static class Native
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, EntryPoint = "CreateHardLinkW")] public static extern bool CreateHardLink(string path, string existing, IntPtr security);
}
