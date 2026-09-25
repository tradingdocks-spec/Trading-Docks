using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TradingDocks.ScannerBridge;

// Compiled against a hash-verified COPY of the installed Core.dll, never the
// candidate project. Only hardware and local journal storage are synthetic.
static class InstalledAgentDownstream
{
    public static void Run()
    {
        var input = Environment.GetEnvironmentVariable("TD_AGENT_PARITY_INPUT");
        var output = Environment.GetEnvironmentVariable("TD_AGENT_PARITY_OUTPUT");
        if (input is null || output is null) return;
        var scope = JsonSerializer.Deserialize<Scope>(File.ReadAllText(input))!;
        using var signing = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var auth = new CaptureAuthorization([signing.ExportSubjectPublicKeyInfoPem()]);
        var binding = new CaptureBinding(scope.User, scope.Workspace, scope.Batch, "isolated-workstation", scope.Batch, scope.Destination);
        var request = new CaptureRequest(scope.Capture, "fixture", new(), DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), Binding: binding);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        string Url(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var payload = Url(JsonSerializer.SerializeToUtf8Bytes(new { userId = scope.User, workspaceId = scope.Workspace, batchId = scope.Batch, workstationId = binding.WorkstationId, sessionId = scope.Batch, destinationId = scope.Destination, deviceId = request.DeviceId, captureId = scope.Capture, audience = "trading-docks-scanner", issuedAt = now, expiresAt = now + 120, purpose = "capture" }));
        request = request with { Authorization = payload + "." + Url(signing.SignData(Encoding.UTF8.GetBytes(payload), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation)) };
        auth.Verify(request, binding.WorkstationId);
        var journal = new Journal(); var backend = new Backend();
        using var first = new Captures(backend, recovery: journal);
        var id = JsonSerializer.SerializeToElement(first.Begin("synthetic-pairing", request)).GetProperty("captureId").GetString();
        if (id != scope.Capture) throw new Exception("Capture identity lost");
        first.Begin("synthetic-pairing", request); // lost-response retry
        try { first.Begin("synthetic-pairing", request with { Settings = new(Dpi: 600) }); throw new Exception("Changed payload accepted"); }
        catch (BridgeException e) when (e.Message == "CAPTURE_CONFLICT") { }
        using var restarted = new Captures(backend, recovery: journal);
        restarted.Begin("synthetic-pairing", request);
        var recovered = JsonSerializer.SerializeToElement(restarted.Read("synthetic-pairing", scope.Capture));
        if (recovered.GetProperty("status").GetString() != "ready" || backend.Calls != 1) throw new Exception("Restart duplicated or lost capture");
        foreach (var bad in new[] { binding with { WorkspaceId = "wrong" }, binding with { BatchId = "wrong" } })
        {
            try { auth.Verify(request with { Binding = bad }, binding.WorkstationId); throw new Exception("Wrong scope accepted"); }
            catch (BridgeException) { }
        }
        // The subsequent Node harness must reserve this actual artifact's capture
        // ID and bytes, then use the normal cloud review/commit RPCs.
        File.WriteAllText(output, JsonSerializer.Serialize(new { captureId = id, binding, capture = recovered, calls = backend.Calls, duplicate = true, restart = true, changedPayloadDenied = true }));
    }
    private record Scope(string User, string Workspace, string Batch, string Destination, string Capture);
    private sealed class Journal : IRecoveryStore
    {
        private readonly Dictionary<string, byte[]> data = new();
        public byte[]? Read(string key) => data.GetValueOrDefault(key)?.ToArray();
        public void Write(string key, byte[] value) => data[key] = value.ToArray();
    }
    private sealed class Backend : IWindowsScannerBackend
    {
        public int Calls;
        public Task<ScannerDevice[]> Devices(CancellationToken cancellation) => Task.FromResult<ScannerDevice[]>([new("fixture", "Synthetic physical source", "Fixture", "Fixture", "USB", "WIA", new([300], ["color"], ["flatbed"]))]);
        public Task<CapturedImage> Capture(string id, ScanSettings settings, CancellationToken cancellation)
        {
            Calls++;
            // Valid 1x1 PNG; no private image or real device is accessed.
            return Task.FromResult(new CapturedImage(Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWPQsAkAAAFEALX3dzdkAAAAAElFTkSuQmCC"), "image/png", 1, 1));
        }
    }
}
