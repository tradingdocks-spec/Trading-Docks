using System.Security.Cryptography;
using TradingDocks.ScannerBridge;

namespace TradingDocks.ScannerBridge.Windows;

public sealed class EncryptedRecoveryStore(string root) : IRecoveryStore
{
    private readonly object gate = new();
    private string PathFor(string key)
    {
        if (key is not ("captures" or "inbox" or "replay")) throw new InvalidOperationException("Invalid recovery record");
        Directory.CreateDirectory(root);
        ScanSnapBackend.NoLinks(root);
        return Path.Combine(root, key + ".dpapi");
    }
    public byte[]? Read(string key)
    {
        lock (gate)
        {
            var path = PathFor(key);
            if (!File.Exists(path)) return null;
            ScanSnapBackend.NoLinks(path);
            if (new FileInfo(path).Length > 32 * 1024 * 1024) throw new InvalidDataException("Recovery record too large");
            return ProtectedData.Unprotect(File.ReadAllBytes(path), null, DataProtectionScope.CurrentUser);
        }
    }
    public void Write(string key, byte[] value)
    {
        lock (gate)
        {
            var path = PathFor(key);
            var temporary = path + ".tmp";
            if (File.Exists(path)) ScanSnapBackend.NoLinks(path);
            if (File.Exists(temporary)) ScanSnapBackend.NoLinks(temporary);
            var encrypted = ProtectedData.Protect(value, null, DataProtectionScope.CurrentUser);
            if (encrypted.Length > 32 * 1024 * 1024) throw new InvalidDataException("Recovery capacity reached");
            using (var output = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
            { output.Write(encrypted); output.Flush(true); }
            File.Move(temporary, path, true);
        }
    }
}
