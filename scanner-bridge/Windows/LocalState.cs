using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using Microsoft.Win32;
using TradingDocks.ScannerBridge;

namespace TradingDocks.ScannerBridge.Windows;

public sealed class LocalState : ITrustStore
{
    public static readonly string DirectoryPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TradingDocks", "ScannerBridgeState");
    private static string FilePath(string name) => Path.Combine(DirectoryPath, name);
    public string WorkstationId { get; }
    public byte[] Salt { get; }
    public LocalState()
    {
        Directory.CreateDirectory(DirectoryPath);
        WorkstationId = ReadOrCreate("workstation", () => Guid.NewGuid().ToString());
        Salt = Convert.FromBase64String(ReadOrCreate("device-salt", () => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))));
    }
    private static string ReadOrCreate(string name, Func<string> create)
    {
        if (File.Exists(FilePath(name))) return File.ReadAllText(FilePath(name));
        var value = create(); File.WriteAllText(FilePath(name), value); return value;
    }
    public TrustRecord[] Load()
    {
        if (!File.Exists(FilePath("trust.dat"))) return [];
        return JsonSerializer.Deserialize<TrustRecord[]>(ProtectedData.Unprotect(File.ReadAllBytes(FilePath("trust.dat")), null, DataProtectionScope.CurrentUser)) ?? [];
    }
    public void Save(TrustRecord[] records)
    {
        var bytes = ProtectedData.Protect(JsonSerializer.SerializeToUtf8Bytes(records), null, DataProtectionScope.CurrentUser);
        File.WriteAllBytes(FilePath("trust.tmp"), bytes); File.Move(FilePath("trust.tmp"), FilePath("trust.dat"), true);
    }
    public X509Certificate2 Certificate()
    {
        using var store = new X509Store(StoreName.My, StoreLocation.CurrentUser); store.Open(OpenFlags.ReadOnly);
        var thumbprint = File.Exists(FilePath("certificate")) ? File.ReadAllText(FilePath("certificate")) : "";
        var certificate = store.Certificates.Find(X509FindType.FindByThumbprint, thumbprint, false).OfType<X509Certificate2>().FirstOrDefault();
        if (certificate is null || !certificate.HasPrivateKey || certificate.NotAfter < DateTime.Now) throw new InvalidOperationException("Local HTTPS trust is missing or expired. Run the reviewed installer again. Do not bypass browser certificate checks.");
        return certificate;
    }
    public static bool HasValidTrustedCertificate()
    {
        try
        {
            using var certificate = new LocalState().Certificate();
            using var root = new X509Store(StoreName.Root, StoreLocation.CurrentUser);
            root.Open(OpenFlags.ReadOnly);
            return certificate.NotBefore <= DateTime.Now && root.Certificates.Find(X509FindType.FindByThumbprint, certificate.Thumbprint, false).Count == 1;
        }
        catch { return false; }
    }
    public static void InstallCertificate()
    {
        Directory.CreateDirectory(DirectoryPath);
        RemoveCertificate();
        using var rsa = RSA.Create(3072);
        var request = new CertificateRequest("CN=Trading Docks Scanner Bridge Loopback", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
        request.CertificateExtensions.Add(new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
        request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(new OidCollection { new("1.3.6.1.5.5.7.3.1") }, true));
        var san = new SubjectAlternativeNameBuilder(); san.AddIpAddress(IPAddress.Loopback); san.AddDnsName("localhost"); request.CertificateExtensions.Add(san.Build());
        using var ephemeral = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddDays(90));
        using var persisted = X509CertificateLoader.LoadPkcs12(ephemeral.Export(X509ContentType.Pfx), null, X509KeyStorageFlags.UserKeySet | X509KeyStorageFlags.PersistKeySet);
        using var personal = new X509Store(StoreName.My, StoreLocation.CurrentUser); personal.Open(OpenFlags.ReadWrite); personal.Add(persisted);
        using var publicOnly = X509CertificateLoader.LoadCertificate(persisted.Export(X509ContentType.Cert));
        File.WriteAllText(FilePath("certificate"), persisted.Thumbprint);
        try { using var root = new X509Store(StoreName.Root, StoreLocation.CurrentUser); root.Open(OpenFlags.ReadWrite); root.Add(publicOnly); }
        catch { RemoveCertificate(); throw; }
    }
    public static void RemoveCertificate()
    {
        if (!File.Exists(FilePath("certificate"))) return;
        var thumbprint = File.ReadAllText(FilePath("certificate"));
        foreach (var name in new[] { StoreName.My, StoreName.Root })
        {
            using var store = new X509Store(name, StoreLocation.CurrentUser); store.Open(OpenFlags.ReadWrite);
            foreach (var cert in store.Certificates.Find(X509FindType.FindByThumbprint, thumbprint, false))
            {
                using (cert) { using var key = cert.HasPrivateKey ? cert.GetRSAPrivateKey() : null; store.Remove(cert); if (key is RSACng cng) cng.Key.Delete(); }
            }
        }
        File.Delete(FilePath("certificate"));
    }
    public static bool AutoStart
    {
        get { using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"); return key?.GetValue("TradingDocksScannerBridge") is string; }
        set { using var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run"); if (value) key.SetValue("TradingDocksScannerBridge", $"\"{Environment.ProcessPath}\""); else key.DeleteValue("TradingDocksScannerBridge", false); }
    }
}
