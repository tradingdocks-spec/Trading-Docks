using System.Security.Cryptography;
using System.Text;

namespace TradingDocks.ScannerBridge;

public record TrustRecord(string Id, string Origin, string PublicKey, DateTimeOffset Expires);
public interface ITrustStore { TrustRecord[] Load(); void Save(TrustRecord[] records); }
public record PairStart(string Challenge, string PublicKey);
public record PairFinish(string Id, string Challenge, string Code);
public record PairPrompt(string Origin, string Code);

// Browser credential IDs are not bearer credentials: every request requires the paired private key.
public sealed class Trust(ITrustStore store, Func<PairPrompt, Task<bool>> approve, TimeProvider? time = null)
{
    private readonly TimeProvider clock = time ?? TimeProvider.System;
    private readonly object gate = new();
    private readonly Dictionary<string, TrustRecord> records = store.Load().ToDictionary(r => r.Id);
    private readonly Dictionary<string, Pending> pending = new();
    private readonly Dictionary<string, DateTimeOffset> challenges = new();
    private readonly Dictionary<string, DateTimeOffset> nonces = new();
    private sealed record Pending(string Origin, string Challenge, string PublicKey, string Code, DateTimeOffset Expires) { public bool Approved; public int Attempts; }
    public int Count { get { lock (gate) return records.Count; } }
    public async Task<string> Begin(string origin, PairStart request)
    {
        if (request.Challenge.Length != 64 || !request.Challenge.All(Uri.IsHexDigit)) throw new BridgeException("INVALID_PAIR_REQUEST");
        try { using var key = ECDsa.Create(); key.ImportSubjectPublicKeyInfo(Convert.FromBase64String(request.PublicKey), out var consumed); if (consumed != Convert.FromBase64String(request.PublicKey).Length || key.ExportParameters(false).Curve.Oid.Value != "1.2.840.10045.3.1.7") throw new CryptographicException(); }
        catch { throw new BridgeException("INVALID_PAIR_REQUEST"); }
        var id = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var code = RandomNumberGenerator.GetInt32(1_000_000).ToString("D6");
        Pending item;
        lock (gate)
        {
            Prune();
            if (pending.Count >= 4 || records.Count >= 8 || challenges.ContainsKey(request.Challenge)) throw new BridgeException("PAIR_REJECTED", 409);
            challenges[request.Challenge] = clock.GetUtcNow().AddMinutes(10);
            item = new(origin, request.Challenge, request.PublicKey, code, clock.GetUtcNow().AddMinutes(2));
            pending[id] = item;
        }
        // Approval takes place in the local tray, never in a browser-controlled endpoint.
        var accepted = await approve(new(origin, code));
        lock (gate) { if (!accepted) pending.Remove(id); else item.Approved = true; }
        if (!accepted) throw new BridgeException("PAIR_REJECTED", 403);
        return id;
    }
    public TrustRecord Finish(string origin, PairFinish request)
    {
        lock (gate)
        {
            Prune();
            if (!pending.TryGetValue(request.Id, out var item) || !item.Approved || item.Origin != origin || item.Challenge != request.Challenge) throw new BridgeException("PAIR_EXPIRED_OR_INVALID", 403);
            item.Attempts++;
            if (item.Attempts > 5) { pending.Remove(request.Id); throw new BridgeException("PAIR_EXPIRED_OR_INVALID", 403); }
            if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(item.Code), Encoding.UTF8.GetBytes(request.Code))) throw new BridgeException("PAIR_EXPIRED_OR_INVALID", 403);
            pending.Remove(request.Id);
            var record = new TrustRecord(Convert.ToHexString(RandomNumberGenerator.GetBytes(32)), origin, item.PublicKey, clock.GetUtcNow().AddDays(30));
            records[record.Id] = record; store.Save(records.Values.ToArray()); return record;
        }
    }
    public string Verify(string origin, string id, string method, string path, string timestamp, string nonce, string signature, string body)
    {
        lock (gate)
        {
            Prune();
            if (!records.TryGetValue(id, out var record) || record.Origin != origin || record.Expires <= clock.GetUtcNow()) throw new BridgeException("UNPAIRED_OR_EXPIRED", 401);
            if (!long.TryParse(timestamp, out var milliseconds) || Math.Abs(clock.GetUtcNow().ToUnixTimeMilliseconds() - (double)milliseconds) > 60_000 || nonce.Length != 64 || !nonce.All(Uri.IsHexDigit)) throw new BridgeException("INVALID_PROOF", 401);
            var replayKey = id + nonce;
            if (nonces.ContainsKey(replayKey) || nonces.Count >= 10_000) throw new BridgeException("REPLAY_REJECTED", 409);
            var digest = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(body))).ToLowerInvariant();
            var canonical = $"{method}\n{path}\n{timestamp}\n{nonce}\n{digest}";
            try
            {
                using var key = ECDsa.Create(); key.ImportSubjectPublicKeyInfo(Convert.FromBase64String(record.PublicKey), out _);
                if (!key.VerifyData(Encoding.UTF8.GetBytes(canonical), Convert.FromBase64String(signature), HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation)) throw new CryptographicException();
            }
            catch { throw new BridgeException("INVALID_PROOF", 401); }
            nonces[replayKey] = clock.GetUtcNow().AddMinutes(2);
            return id;
        }
    }
    public void Revoke(string? id = null) { lock (gate) { if (id is null) records.Clear(); else records.Remove(id); pending.Clear(); store.Save(records.Values.ToArray()); } }
    private void Prune()
    {
        foreach (var key in pending.Where(p => p.Value.Expires <= clock.GetUtcNow()).Select(p => p.Key).ToArray()) pending.Remove(key);
        foreach (var map in new[] { challenges, nonces }) foreach (var key in map.Where(p => p.Value <= clock.GetUtcNow()).Select(p => p.Key).ToArray()) map.Remove(key);
        foreach (var key in records.Where(p => p.Value.Expires <= clock.GetUtcNow()).Select(p => p.Key).ToArray()) records.Remove(key);
    }
}
