namespace TradingDocks.ScannerBridge.Installer;

// The window and Windows app entry use the built assembly's release version.
public static class InstallerIdentity
{
    public static string DisplayVersion => typeof(InstallerIdentity).Assembly.GetName().Version!.ToString(3);
    public static string WindowTitle => $"Trading Docks Scanner Bridge {DisplayVersion} — Internal";
}
