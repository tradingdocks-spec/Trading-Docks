using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TradingDocks.ScannerBridge;

static class RecoveryTests
{
    public static async Task Run(Action<bool, string> check)
    {
        var journal = new MemoryJournal(); var backend = new RecoveryBackend();
        var request = new CaptureRequest(Guid.NewGuid().ToString(), "device", new(), DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        var first = new Captures(backend, recovery: journal);
        string Id(object value) => JsonSerializer.SerializeToElement(value).GetProperty("captureId").GetString()!;
        string Status(Captures value, string id) => JsonSerializer.SerializeToElement(value.Read("owner", id)).GetProperty("status").GetString()!;
        var id = Id(first.Begin("owner", request));
        check(Status(first, id) == "ready", "ready image journaled before delivery");
        first.Dispose();
        var restored = new Captures(backend, recovery: journal);
        check(Id(restored.Begin("owner", request)) == id && Status(restored, id) == "ready", "restart preserves exact capture ID and image");
        check(backend.Calls == 1, "restart retry never reacquires hardware");
        try { restored.Read("other", id); check(false, "cross pairing denied"); } catch (BridgeException e) { check(e.Message == "CAPTURE_NOT_FOUND", "cross pairing denied"); }
        try { restored.Begin("owner", request with { RequestId = Guid.NewGuid().ToString() }); check(false, "queue backpressure"); } catch (BridgeException e) { check(e.Message == "DEVICE_BUSY", "unacknowledged image blocks next capture"); }
        restored.Ack("owner", id);
        var afterAck = new Captures(backend, recovery: journal);
        afterAck.Ack("owner", id);
        check(Status(afterAck, id) == "acknowledged" && backend.Calls == 1, "lost ACK/restart returns terminal tombstone");
        check(JsonSerializer.SerializeToElement(afterAck.Read("owner", id)).GetProperty("image").ValueKind == JsonValueKind.Null, "acknowledged bytes absent after restore");
        var interruptedJournal = new MemoryJournal(); backend.Wait = true;
        var interrupted = new Captures(backend, recovery: interruptedJournal);
        var secondId = Id(interrupted.Begin("owner", request with { RequestId = Guid.NewGuid().ToString() }));
        var crashed = new Captures(backend, recovery: interruptedJournal);
        check(Status(crashed, secondId) == "interrupted", "uncertain driver result requires intervention instead of rescan");
        crashed.Discard("owner", secondId);
        check(Status(new Captures(backend, recovery: interruptedJournal), secondId) == "cancelled", "explicit discard persisted");
        interrupted.Dispose(); await Task.Delay(20);
        journal.Corrupt = true;
        try { new Captures(backend, recovery: journal).Begin("owner", request); check(false, "corruption rejected"); } catch (JsonException) { check(true, "corrupt journal fails closed"); }

        using var signing = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var auth = new CaptureAuthorization([signing.ExportSubjectPublicKeyInfoPem()]);
        var binding = new CaptureBinding("user", "workspace", "batch", "workstation", "session", "destination");
        var scoped = request with { Binding = binding };
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        string Permit(long expiry, string purpose = "capture")
        {
            var raw = JsonSerializer.SerializeToUtf8Bytes(new { userId = "user", workspaceId = "workspace", batchId = "batch", workstationId = "workstation", sessionId = "session", destinationId = "destination", deviceId = "device", captureId = request.RequestId, audience = "trading-docks-scanner", issuedAt = now, expiresAt = expiry, purpose });
            string Url(byte[] value) => Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
            var payload = Url(raw); return payload + "." + Url(signing.SignData(Encoding.UTF8.GetBytes(payload), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation));
        }
        scoped = scoped with { Authorization = Permit(now + 120) }; auth.Verify(scoped, "workstation"); check(true, "valid short-lived cloud permit accepted");
        foreach (var bad in new[] { scoped with { Binding = binding with { UserId = "other" } }, scoped with { Binding = binding with { WorkspaceId = "other" } }, scoped with { Binding = binding with { BatchId = "other" } }, scoped with { RequestId = Guid.NewGuid().ToString() }, scoped with { Authorization = Permit(now - 1) }, scoped with { Authorization = Permit(now + 121) }, scoped with { Authorization = null } })
        { try { auth.Verify(bad, "workstation"); check(false, "invalid permit"); } catch (BridgeException) { check(true, "wrong scope/expired/missing permit denied"); } }
        try { auth.Verify(scoped, "workstation", "ack"); check(false, "capture permit cannot acknowledge"); } catch (BridgeException) { check(true, "cloud acceptance permit required for acknowledgement"); }
        auth.Verify(scoped with { Authorization = Permit(now + 120, "ack") }, "workstation", "ack"); check(true, "cloud acceptance acknowledgement verified");
        var trustStore = new PairingStore(); var replay = new MemoryJournal(); string pairCode = "";
        var trust = new Trust(trustStore, prompt => { pairCode = prompt.Code; return Task.FromResult(true); }, recovery: replay);
        var challenge = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var origin = "https://www.tradingdocks.com";
        var pairId = await trust.Begin(origin, new(challenge, Convert.ToBase64String(signing.ExportSubjectPublicKeyInfo())));
        var credential = trust.Finish(origin, new(pairId, challenge, pairCode));
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(); var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var digest = Convert.ToHexString(SHA256.HashData([])).ToLowerInvariant();
        var canonical = $"GET\n/v1/status\n{timestamp}\n{nonce}\n{digest}";
        var proof = Convert.ToBase64String(signing.SignData(Encoding.UTF8.GetBytes(canonical), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation));
        trust.Verify(origin, credential.Id, "GET", "/v1/status", timestamp, nonce, proof, "");
        var trustRestart = new Trust(trustStore, _ => Task.FromResult(false), recovery: replay);
        try { trustRestart.Verify(origin, credential.Id, "GET", "/v1/status", timestamp, nonce, proof, ""); check(false, "replay after restart"); } catch (BridgeException e) { check(e.Message == "REPLAY_REJECTED", "signed replay denied after restart"); }
        check(trustRestart.Renew(credential.Id).Id == credential.Id, "pairing identity preserved after restart/renewal");
        trustRestart.Revoke(credential.Id);
        try { trustRestart.Renew(credential.Id); check(false, "revoked renewal"); } catch (BridgeException e) { check(e.Message == "UNPAIRED_OR_EXPIRED", "revoked pairing cannot renew"); }

    }
    private sealed class PairingStore : ITrustStore {
        private TrustRecord[] records = [];
        public TrustRecord[] Load() => records;
        public void Save(TrustRecord[] value) => records = value;
    }
    private sealed class MemoryJournal : IRecoveryStore
    {
        private readonly Dictionary<string, byte[]> records = new(); public bool Corrupt;
        public byte[]? Read(string key) => Corrupt ? [0] : records.GetValueOrDefault(key)?.ToArray();
        public void Write(string key, byte[] value) => records[key] = value.ToArray();
    }
    private sealed class RecoveryBackend : IWindowsScannerBackend
    {
        public int Calls; public bool Wait;
        public Task<ScannerDevice[]> Devices(CancellationToken cancellation) => Task.FromResult<ScannerDevice[]>([new("device", "Fixture", "Fixture", "Fixture", "USB", "WIA", new([300], ["color"], ["flatbed"]))]);
        public async Task<CapturedImage> Capture(string id, ScanSettings settings, CancellationToken cancellation) { Calls++; if (Wait) await Task.Delay(Timeout.Infinite, cancellation); return new([1, 2, 3], "image/jpeg", 20, 30); }
    }
}
