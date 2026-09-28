namespace TradingDocks.ScannerBridge;

// Routing is based on enumerated opaque device IDs, never a browser-supplied driver/path.
public sealed class WindowsScannerBackend(params IWindowsScannerBackend[] backends) : IWindowsScannerBackend, IScannerDiagnostics, IDisposable
{
    public ScannerDiagnostic[] Diagnostics { get { lock (gate) return backends.OfType<IScannerDiagnostics>().SelectMany(b => b.Diagnostics).Concat(probeDiagnostics.Values).ToArray(); } }
    private readonly Dictionary<IWindowsScannerBackend, ScannerDiagnostic> probeDiagnostics = new();
    private readonly object gate = new();
    private readonly Dictionary<IWindowsScannerBackend, Task<ScannerDevice[]>> probes = new();
    private readonly Dictionary<string, IWindowsScannerBackend> routes = new();
    private async Task<ScannerDevice[]> Probe(IWindowsScannerBackend backend)
    {
        try { return await backend.Devices(CancellationToken.None); }
        catch (Exception error) { lock (gate) probeDiagnostics[backend] = new(backend.GetType().Name, error is BridgeException ? error.Message : "DRIVER_UNAVAILABLE", "Scanner backend unavailable. Check its driver and refresh devices."); return []; } // An unavailable driver must not hide another backend.
    }
    private async Task<ScannerDevice[]> Enumerate(IWindowsScannerBackend backend, CancellationToken cancellation)
    {
        Task<ScannerDevice[]> pending;
        lock (gate)
        {
            if (!probes.TryGetValue(backend, out pending!)) { probeDiagnostics.Remove(backend); probes[backend] = pending = Task.Run(() => Probe(backend)); }
        }
        try
        {
            var devices = await pending.WaitAsync(TimeSpan.FromSeconds(2), cancellation);
            lock (gate)
            {
                if (probeDiagnostics.GetValueOrDefault(backend)?.Code == "DISCOVERY_PENDING") probeDiagnostics.Remove(backend);
                foreach (var id in routes.Where(route => route.Value == backend).Select(route => route.Key).ToArray()) routes.Remove(id);
                foreach (var device in devices) routes[device.Id] = backend;
                if (probes.GetValueOrDefault(backend) == pending) probes.Remove(backend);
            }
            return devices;
        }
        catch (TimeoutException) { lock (gate) probeDiagnostics[backend] = new(backend.GetType().Name, "DISCOVERY_PENDING", "Device discovery is still running. Refresh Devices to collect the result."); return []; } // Retain one pending probe, never enqueue more behind a hung COM call.
    }
    public async Task<ScannerDevice[]> Devices(CancellationToken cancellation)
    {
        var groups = await Task.WhenAll(backends.Select(backend => Enumerate(backend, cancellation)));
        return groups.SelectMany(devices => devices).ToArray();
    }
    public Task<CapturedImage> Capture(string id, ScanSettings settings, CancellationToken cancellation) => Capture(id, settings, new(Guid.NewGuid().ToString(), Guid.NewGuid().ToString()), cancellation);
    public async Task<CapturedImage> Capture(string id, ScanSettings settings, CaptureContext context, CancellationToken cancellation)
    {
        IWindowsScannerBackend? backend;
        lock (gate) routes.TryGetValue(id, out backend);
        if (backend is null) { await Devices(cancellation); lock (gate) routes.TryGetValue(id, out backend); }
        if (backend is null) throw new BridgeException("DEVICE_OFFLINE");
        return await backend.Capture(id, settings, context, cancellation);
    }
    public void Dispose() { foreach (var backend in backends.OfType<IDisposable>()) backend.Dispose(); }
}
