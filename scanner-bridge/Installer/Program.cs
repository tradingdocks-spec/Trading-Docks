using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using Microsoft.Win32;
using TradingDocks.ScannerBridge.Installer;

internal static class Program
{
    private static readonly string InstallPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "TradingDocksScannerBridge");
    private const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\TradingDocksScannerBridge";
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        try
        {
            if (args.SequenceEqual(["--uninstall"]))
            {
                if (MessageBox.Show("Remove Scanner Bridge, workstation pairing, startup entry and this installation's local HTTPS certificate?", "Uninstall Scanner Bridge", MessageBoxButtons.YesNo) != DialogResult.Yes) return;
                var temporary = Path.Combine(Path.GetTempPath(), "TD-Bridge-Uninstall-" + Guid.NewGuid() + ".exe");
                File.Copy(Environment.ProcessPath!, temporary);
                Process.Start(new ProcessStartInfo(temporary, "--remove-instance") { UseShellExecute = false, CreateNoWindow = true }); return;
            }
            if (args.SequenceEqual(["--remove-instance"]))
            {
                Thread.Sleep(1500); StopBridge();
                RunBridge("--remove-trust");
                Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false);
                var startup = Environment.GetFolderPath(Environment.SpecialFolder.StartMenu);
                var shortcut = Path.Combine(startup, "Programs", "Trading Docks Scanner Bridge.url");
                if (File.Exists(shortcut)) File.Delete(shortcut);
                // Fixed application-owned path only. The copied uninstaller remains in OS Temp.
                if (Directory.Exists(InstallPath)) Directory.Delete(InstallPath, true);
                MessageBox.Show("Scanner Bridge removed."); return;
            }
            if (args.Length != 0) throw new InvalidOperationException("Unsupported installer option.");
            using var window = new Form { Text = InstallerIdentity.WindowTitle, Width = 520, Height = 300, StartPosition = FormStartPosition.CenterScreen };
            var label = new Label { Dock = DockStyle.Top, Height = 130, Padding = new Padding(15), Text = "Internal unsigned development build. Windows 11 only.\nPhysical scanner certification is PENDING.\n\nInstalls for your Windows user (no administrator required). Local HTTPS certificate trust requires a separate explicit confirmation. No production credentials are bundled." };
            var startupOption = new CheckBox { Dock = DockStyle.Top, Text = "Start Scanner Bridge with Windows", Checked = true, Height = 35 };
            var install = new Button { Dock = DockStyle.Bottom, Text = "Install internal build", Height = 45 };
            install.Click += (_, _) =>
            {
                try
                {
                    StopBridge(); Directory.CreateDirectory(InstallPath);
                    using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip")!;
                    using var zip = new ZipArchive(stream);
                    foreach (var entry in zip.Entries)
                    {
                        var destination = Path.GetFullPath(Path.Combine(InstallPath, entry.FullName));
                        if (!destination.StartsWith(InstallPath + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Invalid installation payload.");
                        if (entry.FullName.EndsWith('/')) { Directory.CreateDirectory(destination); continue; }
                        Directory.CreateDirectory(Path.GetDirectoryName(destination)!); entry.ExtractToFile(destination, true);
                    }
                    if (!string.Equals(Environment.ProcessPath, Path.Combine(InstallPath, "Setup.exe"), StringComparison.OrdinalIgnoreCase)) File.Copy(Environment.ProcessPath!, Path.Combine(InstallPath, "Setup.exe"), true);
                    using var registry = Registry.CurrentUser.CreateSubKey(UninstallKey);
                    registry.SetValue("DisplayName", "Trading Docks Scanner Bridge (internal)"); registry.SetValue("DisplayVersion", InstallerIdentity.DisplayVersion); registry.SetValue("Publisher", "Trading Docks"); registry.SetValue("InstallLocation", InstallPath); registry.SetValue("UninstallString", $"\"{Path.Combine(InstallPath, "Setup.exe")}\" --uninstall"); registry.SetValue("NoModify", 1); registry.SetValue("NoRepair", 1);
                    if (RunBridge("--install-trust") != 0) { MessageBox.Show("Local HTTPS trust was not installed. The bridge will remain stopped. You can rerun this installer when ready."); window.Close(); return; }
                    using var run = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");
                    if (startupOption.Checked) run.SetValue("TradingDocksScannerBridge", $"\"{BridgePath}\""); else run.DeleteValue("TradingDocksScannerBridge", false);
                    Process.Start(new ProcessStartInfo(BridgePath) { UseShellExecute = false }); window.Close();
                }
                catch { MessageBox.Show("Installation did not finish. Close the bridge and verify the installer, then retry or uninstall from Windows Settings."); }
            };
            window.Controls.Add(startupOption); window.Controls.Add(label); window.Controls.Add(install); Application.Run(window);
        }
        catch { MessageBox.Show("Scanner Bridge setup could not complete. No administrator or browser-security bypass is required."); }
    }
    private static string BridgePath => Path.Combine(InstallPath, "TradingDocks.ScannerBridge.exe");
    private static int RunBridge(string argument) { if (!File.Exists(BridgePath)) return 1; using var process = Process.Start(new ProcessStartInfo(BridgePath, argument) { UseShellExecute = false }); if (process is null) return 1; process.WaitForExit(); return process.ExitCode; }
    private static void StopBridge()
    {
        foreach (var process in Process.GetProcessesByName("TradingDocks.ScannerBridge"))
        {
            using (process) if (string.Equals(process.MainModule?.FileName, BridgePath, StringComparison.OrdinalIgnoreCase)) { process.Kill(); process.WaitForExit(5000); }
        }
    }
}
