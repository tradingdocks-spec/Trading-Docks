using TradingDocks.ScannerBridge;

static class ScanSnapTests
{
    public static async Task Run(Action<bool, string> check)
    {
        var root = Path.Combine(Path.GetTempPath(), "td-scansnap-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        var platform = new Fixture();
        using var backend = new ScanSnapBackend(platform, root, new byte[32]);
        var settings = new ScanSettings(Source: "feeder");
        CaptureContext Context() => new(Guid.NewGuid().ToString(), Guid.NewGuid().ToString());
        try
        {
            check((await backend.Devices(default)).Length == 0, "ScanSnap software absent");
            platform.SoftwareInstalled = true;
            check((await backend.Devices(default)).Length == 0, "ScanSnap installed, scanner absent");
            platform.Connected = true;
            var device = (await backend.Devices(default)).Single();
            check(device.Backend == "SCANSNAP" && device.Connection == "USB" && device.Capabilities.ExternalSettings && !device.Id.Contains("native"), "iX500 normalized detection and opaque identity");
            var stalled = new StalledBackend();
            using (var bounded = new WindowsScannerBackend(stalled, new FailedBackend(), new ScanSnapBackend(platform, root, new byte[32])))
            {
                check((await bounded.Devices(default)).Single().Id == device.Id, "stalled/failed backend does not hide ScanSnap");
                check((await bounded.Devices(default)).Single().Id == device.Id && stalled.Calls == 1, "stalled enumeration stays single-flight");
            }
            using var composite = new WindowsScannerBackend(new OtherBackend(), backend);
            check((await composite.Devices(default)).Length == 2, "WIA and ScanSnap composite enumeration");
            using var wia = await composite.Capture("wia", new(), default);
            check(wia.Width == 1, "WIA capture routing preserved");

            // A preexisting or unrelated image is not accepted.
            var old = Path.Combine(root, "old.jpg"); File.WriteAllBytes(old, [0xff, 0xd8, 0xff]);
            using var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            var capture = composite.Capture(device.Id, settings, Context(), cancel.Token);
            var path = platform.Path!;
            check(path.EndsWith("capture.jpg") && Path.GetDirectoryName(path) != root, "capture request allocates isolated destination");
            File.WriteAllBytes(Path.Combine(Path.GetDirectoryName(path)!, "unrelated.png"), [1]);
            await Task.Delay(350);
            check(!capture.IsCompleted, "old files and wrong extensions ignored");
            File.WriteAllBytes(path, [0xff, 0xd8, 0xff]);
            using (var image = await capture)
            {
                check(image.MimeType == "image/jpeg" && platform.DecodeCount == 1, "new capture output received once");
                File.WriteAllBytes(path, [0xff, 0xd8, 0xff]); await Task.Delay(350);
                check(platform.DecodeCount == 1, "duplicate file ignored after delivery");
                check(File.Exists(path), "temporary file retained until acknowledgement");
            }
            check(!File.Exists(path) && File.Exists(old), "acknowledgement deletes exact capture only");
            check(platform.PromptsClosed == 1, "capture prompt closed on output");

            async Task RejectCapture(string expected, Action<CancellationTokenSource> arrange)
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(4));
                var task = backend.Capture(device.Id, settings, Context(), cts.Token);
                var current = platform.Path!;
                arrange(cts);
                try { using var unexpected = await task; throw new Exception("Unexpected capture success"); }
                catch (BridgeException e) { check(e.Message == expected, expected); }
                catch (OperationCanceledException) { check(expected == "cancelled", "capture cancellation/timeout"); }
                check(!File.Exists(current), "failed/cancelled output cleaned");
            }
            await RejectCapture("INVALID_IMAGE", _ => File.WriteAllBytes(platform.Path!, [1, 2, 3]));
            await RejectCapture("IMAGE_LIMIT_EXCEEDED", _ => { using var file = File.Create(platform.Path!); file.SetLength(Protocol.MaxImageBytes + 1); });
            await RejectCapture("cancelled", cts => cts.Cancel());
            var stale = platform.Path!;
            await RejectCapture("cancelled", cts => cts.CancelAfter(100));
            await RejectCapture("DEVICE_OFFLINE", _ => platform.Connected = false);
            platform.Connected = true;
            using var finalCancellation = new CancellationTokenSource(900);
            var finalCapture = backend.Capture(device.Id, settings, Context(), finalCancellation.Token);
            Directory.CreateDirectory(Path.GetDirectoryName(stale)!); File.WriteAllBytes(stale, [0xff, 0xd8, 0xff]);
            try { using var unexpected = await finalCapture; throw new Exception("Stale capture accepted"); }
            catch (OperationCanceledException) { check(true, "late cancelled output cannot enter next request"); }
            check(platform.PromptsClosed == 7, "all capture prompts released");
        }
        finally
        {
            // Test-created isolated root; never points at production or bridge state.
            Directory.Delete(root, true);
        }
    }
    private sealed class Fixture : IScanSnapPlatform
    {
        public bool SoftwareInstalled { get; set; }
        public bool Connected;
        public string? Path;
        public int DecodeCount, PromptsClosed;
        public string[] ConnectedDevices() => Connected ? ["native-device-id"] : [];
        public IDisposable ShowCaptureDestination(string path, CancellationToken cancellation) { Path = path; return new Lease(() => PromptsClosed++); }
        public CapturedImage DecodeImage(string path)
        {
            var bytes = File.ReadAllBytes(path); DecodeCount++;
            if (!bytes.SequenceEqual(new byte[] { 0xff, 0xd8, 0xff })) throw new BridgeException("INVALID_IMAGE");
            return new(bytes, "image/jpeg", 10, 20);
        }
    }
    private sealed class Lease(Action dispose) : IDisposable { public void Dispose() => dispose(); }
    private sealed class OtherBackend : IWindowsScannerBackend
    {
        public Task<ScannerDevice[]> Devices(CancellationToken c) => Task.FromResult<ScannerDevice[]>([new("wia", "WIA fixture", "Fixture", "Fixture", "USB", "WIA", new([300], ["color"], ["flatbed"]))]);
        public Task<CapturedImage> Capture(string id, ScanSettings settings, CancellationToken c) => Task.FromResult(new CapturedImage([1], "image/jpeg", 1, 1));
    }
    private sealed class StalledBackend : IWindowsScannerBackend
    {
        public int Calls;
        private readonly TaskCompletionSource<ScannerDevice[]> pending = new();
        public Task<ScannerDevice[]> Devices(CancellationToken cancellation) { Calls++; return pending.Task; }
        public Task<CapturedImage> Capture(string id, ScanSettings settings, CancellationToken c) => throw new Exception("Should not route to unenumerated device");
    }
    private sealed class FailedBackend : IWindowsScannerBackend
    {
        public Task<ScannerDevice[]> Devices(CancellationToken cancellation) => throw new BridgeException("BACKEND_UNAVAILABLE");
        public Task<CapturedImage> Capture(string id, ScanSettings settings, CancellationToken c) => throw new Exception("Should not route to failed backend");
    }
}
