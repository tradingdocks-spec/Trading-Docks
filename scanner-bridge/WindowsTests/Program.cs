using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using TradingDocks.ScannerBridge;
using TradingDocks.ScannerBridge.Windows;
using TradingDocks.ScannerBridge.Installer;

// Default tests are synthetic. Explicit --capture-twain performs owner-directed physical acceptance.
using var dispatcher = new Control();
// This console diagnostic does not run a WinForms message loop.
SynchronizationContext.SetSynchronizationContext(null);
var platform = new ScanSnapPlatform(dispatcher);
var supportedIntents = WiaCapabilityValues.Flags([1, 2, 4, 65536, 131072, 262144], [1, 1 | 65536, 8]);
if (!supportedIntents.SequenceEqual(new[] { 1, 1 | 65536 })) throw new Exception("WIA advertised color/combined intent flags were rejected or unsupported flags accepted");
Console.WriteLine("PASS: WIA flag capabilities accept color and supported combinations independent of current intent");
var priorContext = SynchronizationContext.Current;
SynchronizationContext.SetSynchronizationContext(new RejectPostedContinuations());
var shutdownCompleted = false;
try
{
    AgentLifecycle.RunHostOperation(async () => { await Task.Delay(25); shutdownCompleted = true; });
}
finally { SynchronizationContext.SetSynchronizationContext(priorContext); }
if (!shutdownCompleted) throw new Exception("Host shutdown did not complete off the UI context");
var restartInfo = AgentLifecycle.RestartInfo("C:\\private-agent\\TradingDocks.ScannerBridge.exe", "C:\\private-agent");
if (restartInfo.FileName != "C:\\private-agent\\TradingDocks.ScannerBridge.exe" || restartInfo.WorkingDirectory != "C:\\private-agent" || restartInfo.UseShellExecute) throw new Exception("Restart executable/directory changed");
Console.WriteLine("PASS: async host shutdown avoids blocked UI context; relaunch uses exact executable and directory");
if (InstallerIdentity.DisplayVersion != Protocol.VersionString || InstallerIdentity.DisplayVersion != typeof(ScanSnapPlatform).Assembly.GetName().Version!.ToString(3)) throw new Exception("Installer / runtime release version mismatch");
if (InstallerIdentity.WindowTitle != $"Trading Docks Scanner Bridge {Protocol.VersionString} — Internal") throw new Exception("Installer label version mismatch");
Console.WriteLine("PASS: installer UI / Windows app version / bridge assembly / runtime version agree");
if (args.SequenceEqual(["--detect-twain"]) || args.SequenceEqual(["--capture-twain"]))
{
    var backend = new TwainScannerBackend(new byte[32], Path.GetFullPath("scanner-bridge/artifacts/payload/twain-x86/TradingDocks.TwainWorker.exe"));
    var devices = await backend.Devices(default);
    Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { devices, diagnostics = backend.Diagnostics }));
    if (args[0] == "--capture-twain")
    {
        var device = devices.Single(d => d.DisplayName.Contains("fi-8170") && d.Capabilities.Duplex);
        var physicalRoot = Path.GetFullPath(".cache/ricoh-physical-acceptance"); Directory.CreateDirectory(physicalRoot);
        var journal = new EncryptedRecoveryStore(Path.Combine(physicalRoot, "recovery"));
        using var captures = new Captures(backend, recovery: journal);
        var request = new CaptureRequest(Guid.NewGuid().ToString(), device.Id, new(400, "color", "feeder", true), DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), PairedImages: true);
        var id = System.Text.Json.JsonSerializer.SerializeToElement(captures.Begin("physical-local-test", request)).GetProperty("captureId").GetString()!;
        System.Text.Json.JsonElement result;
        do { await Task.Delay(250); result = System.Text.Json.JsonSerializer.SerializeToElement(captures.Read("physical-local-test", id)); } while (result.GetProperty("status").GetString() == "capturing");
        if (result.GetProperty("status").GetString() != "ready") throw new Exception(result.GetProperty("error").ToString());
        using var restored = new Captures(backend, recovery: journal);
        var recovered = System.Text.Json.JsonSerializer.SerializeToElement(restored.Read("physical-local-test", id));
        File.WriteAllBytes(Path.Combine(physicalRoot, id + "-front.jpg"), Convert.FromBase64String(recovered.GetProperty("image").GetString()!));
        File.WriteAllBytes(Path.Combine(physicalRoot, id + "-back.jpg"), Convert.FromBase64String(recovered.GetProperty("back").GetProperty("image").GetString()!));
        // Local acceptance receipt only, never a hosted cloud/inventory acknowledgement.
        restored.Ack("physical-local-test", id);
        Console.WriteLine($"PHYSICAL_CAPTURE_OK id={id} physicalCards=1 sides=2 dpi=400 recoveryVerified=true output={physicalRoot}");
    }
    return;
}
if (args.SequenceEqual(["--detect-wia"]))
{
    using var wia = new WiaScannerBackend(new byte[32]);
    Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(await wia.Devices(default)));
    return;
}
if (args.SequenceEqual(["--detect"]))
{
    using var backend = new WindowsScannerBackend(new WiaScannerBackend(new byte[32]), new ScanSnapBackend(platform, Path.Combine(Path.GetTempPath(), "td-scansnap-detection-" + Guid.NewGuid().ToString("N")), new byte[32]));
    var devices = await backend.Devices(default);
    Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { softwareInstalled = platform.SoftwareInstalled, devices = devices.Select(d => new { d.DisplayName, d.Model, d.Backend, d.Connection }), diagnostics = backend.Diagnostics }));
    return;
}
var root = Path.Combine(Path.GetTempPath(), "td-scansnap-image-tests-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(root);
var file = Path.Combine(root, "capture.jpg");
var recoveryRoot = Path.Combine(root, "recovery");
var protectedStore = new EncryptedRecoveryStore(recoveryRoot);
var recoveryBytes = System.Text.Encoding.UTF8.GetBytes("synthetic-capture-recovery");
protectedStore.Write("captures", recoveryBytes);
if (!new EncryptedRecoveryStore(recoveryRoot).Read("captures")!.SequenceEqual(recoveryBytes)) throw new Exception("DPAPI restore failed");
if (System.Text.Encoding.UTF8.GetString(File.ReadAllBytes(Path.Combine(recoveryRoot, "captures.dpapi"))).Contains("synthetic-capture-recovery")) throw new Exception("Recovery plaintext on disk");
protectedStore.Write("captures", [1,2,3]);
if (!protectedStore.Read("captures")!.SequenceEqual(new byte[] {1,2,3})) throw new Exception("Atomic replacement failed");
Console.WriteLine("PASS: Windows DPAPI encrypted recovery read/restart/atomic replacement");

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
finally { File.Delete(file); File.Delete(Path.Combine(recoveryRoot, "captures.dpapi")); Directory.Delete(recoveryRoot); Directory.Delete(root); }

static class Native
{
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, EntryPoint = "CreateHardLinkW")] public static extern bool CreateHardLink(string path, string existing, IntPtr security);
}

sealed class RejectPostedContinuations : SynchronizationContext
{
    public override void Post(SendOrPostCallback callback, object? state) => throw new InvalidOperationException("Host continuation captured blocked WinForms UI");
}
