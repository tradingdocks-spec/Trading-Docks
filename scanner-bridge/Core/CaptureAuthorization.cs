using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace TradingDocks.ScannerBridge;

public sealed class CaptureAuthorization(string[] publicKeys, TimeProvider? time = null)
{
    private sealed record Permit(string UserId, string WorkspaceId, string BatchId, string WorkstationId, string SessionId, string DestinationId, string DeviceId, string CaptureId, string Audience, long IssuedAt, long ExpiresAt, string Purpose);
    private static byte[] Decode(string value) => Convert.FromBase64String(value.Replace('-', '+').Replace('_', '/') + new string('=', (4 - value.Length % 4) % 4));
    public void Verify(CaptureRequest request, string workstationId, string purpose = "capture")
    {
        try
        {
            var parts = request.Authorization?.Split('.') ?? [];
            if (parts.Length != 2 || request.Authorization!.Length > 4096 || request.Binding is null) throw new CryptographicException();
            var signature = Decode(parts[1]);
            var verified = publicKeys.Any(pem => { using var key = ECDsa.Create(); key.ImportFromPem(pem); return key.VerifyData(Encoding.UTF8.GetBytes(parts[0]), signature, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation); });
            if (!verified) throw new CryptographicException();
            var p = JsonSerializer.Deserialize<Permit>(Decode(parts[0]), new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? throw new CryptographicException();
            var b = request.Binding;
            var now = (time ?? TimeProvider.System).GetUtcNow().ToUnixTimeSeconds();
            if (p.Purpose != (request.Preview ? "preview" : purpose) || p.Audience != "trading-docks-scanner" || p.IssuedAt > now + 15 || p.ExpiresAt <= now || p.ExpiresAt - p.IssuedAt > 120 ||
                p.WorkstationId != workstationId || p.CaptureId != request.RequestId || p.DeviceId != request.DeviceId ||
                p.UserId != b.UserId || p.WorkspaceId != b.WorkspaceId || p.BatchId != b.BatchId || p.WorkstationId != b.WorkstationId || p.SessionId != b.SessionId || p.DestinationId != b.DestinationId ||
                request.SessionId is not null && request.SessionId != b.SessionId) throw new CryptographicException();
        }
        catch { throw new BridgeException("CLOUD_CAPTURE_UNAUTHORIZED", 403); }
    }
}
