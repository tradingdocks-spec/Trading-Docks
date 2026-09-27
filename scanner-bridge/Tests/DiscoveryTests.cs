using TradingDocks.ScannerBridge;

static class DiscoveryTests
{
    public static async Task Run(Action<bool, string> check)
    {
        var twain = new Probe(); var unavailable = new Probe { Fail = true };
        using var backend = new WindowsScannerBackend(unavailable, twain);
        var first = await backend.Devices(default);
        check(first.Length == 1 && first[0].Backend == "TWAIN", "unavailable WIA does not hide discovered TWAIN source");
        check(backend.Diagnostics.Any(d => d.Code == "DRIVER_UNAVAILABLE"), "unavailable driver is explained separately from agent connection");
        check((await backend.Devices(default))[0].Id == first[0].Id && twain.Probes == 2, "refresh really re-enumerates and preserves opaque source identity");
        using var image = await backend.Capture(first[0].Id, new(400, "color", "feeder", true), default);
        check(twain.Captures == 1 && image.Back is not null, "one routed duplex acquisition returns both sides");
        twain.Connected = false; await backend.Devices(default);
        try { await backend.Capture(first[0].Id, new(), default); check(false, "stale route removed"); }
        catch (BridgeException e) { check(e.Message == "DEVICE_OFFLINE", "stale device route removed on refresh"); }
        twain.Connected = true;
        check((await backend.Devices(default))[0].Id == first[0].Id, "reconnect resolves original stable device identity");
    }
    private sealed class Probe : IWindowsScannerBackend
    {
        public bool Connected = true, Fail; public int Probes, Captures;
        public Task<ScannerDevice[]> Devices(CancellationToken cancellation) {
            Probes++; if (Fail) throw new BridgeException("DRIVER_UNAVAILABLE");
            return Task.FromResult<ScannerDevice[]>(Connected ? [new("stable-twain", "Synthetic TWAIN fixture", "Fixture", "Fixture", "USB", "TWAIN", new([400], ["color"], ["feeder"], Duplex: true))] : []);
        }
        public Task<CapturedImage> Capture(string id, ScanSettings settings, CancellationToken cancellation) { Captures++; return Task.FromResult(new CapturedImage([1], "image/jpeg", 1, 1, Back: new([2], "image/jpeg", 1, 1))); }
    }
}
