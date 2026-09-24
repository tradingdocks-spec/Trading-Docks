using TradingDocks.ScannerBridge;
using TradingDocks.ScannerBridge.Windows;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        if (args.SequenceEqual(["--install-trust"]))
        {
            if (MessageBox.Show("Internal development build — physical scanner certification pending.\n\nTrust this workstation's unique loopback HTTPS certificate for 90 days? It is installed for this Windows user only. Never accept certificates from an unverified installer.", "Trading Docks Scanner Bridge", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes) LocalState.InstallCertificate();
            else Environment.ExitCode = 2;
            return;
        }
        if (args.SequenceEqual(["--remove-trust"])) { LocalState.AutoStart = false; LocalState.RemoveCertificate(); new LocalState().Save([]); return; } // Preserve unacknowledged Inbox files; never recursively delete captures on uninstall.
        if (args.Length != 0) { MessageBox.Show("Unsupported bridge argument."); return; }
        var restart = false;
        using (var singleton = new Mutex(true, "Local\\TradingDocksScannerBridge", out var first))
        {
            if (!first) { MessageBox.Show("Scanner Bridge is already running in the tray."); return; }
            try
            {
                AgentLifecycle.Log("startup");
                var context = new BridgeTray();
                Application.Run(context);
                restart = context.RestartRequested;
            }
            catch (Exception error) { AgentLifecycle.Log("lifecycle-failed", error); MessageBox.Show("Scanner Bridge could not start or stop cleanly. See lifecycle.log in ScannerBridgeState. Recovery and pairing state are preserved.", "Scanner Bridge"); }
            finally { singleton.ReleaseMutex(); }
        }
        // Launch only after shutdown and singleton release, never from inside
        // Application.Restart's synchronous ExitApplication callbacks.
        if (restart)
        {
            AgentLifecycle.Log("relaunch");
            System.Diagnostics.Process.Start(AgentLifecycle.RestartInfo(Environment.ProcessPath!, AppContext.BaseDirectory));
        }
    }
}

internal sealed class BridgeTray : ApplicationContext
{
    public bool RestartRequested { get; private set; }
    private bool stopping;
    private readonly Form dispatcher = new() { ShowInTaskbar = false };
    private readonly NotifyIcon tray;
    private readonly WindowsScannerBackend backend;
    private readonly Trust trust;
    private readonly Captures captures;
    private readonly Microsoft.AspNetCore.Builder.WebApplication server;
    public BridgeTray()
    {
        _ = dispatcher.Handle;
        var state = new LocalState();
        var setupMarker = Path.Combine(LocalState.DirectoryPath, "scansnap-inbox-configured");
        backend = new(new WiaScannerBackend(state.Salt), new ScanSnapBackend(new ScanSnapPlatform(dispatcher), Path.Combine(LocalState.DirectoryPath, "captures"), state.Salt, () => File.Exists(setupMarker)));
        trust = new(state, prompt =>
        {
            var completion = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            dispatcher.BeginInvoke(() => completion.SetResult(MessageBox.Show($"Allow pairing from:\n{prompt.Origin}\n\nEnter this one-time code in that browser: {prompt.Code}\n\nCode expires after two minutes. Approve only if you initiated pairing.", "Pair Trading Docks workstation", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.Yes));
            return completion.Task;
        });
        var inbox = new ScannerInbox(Path.Combine(LocalState.DirectoryPath, "Inbox"), new ScanSnapPlatform(dispatcher));
        inbox.Prepare();
        captures = new(backend, inbox);
        // Additional origins must be reviewed and explicitly set in this local-user file.
        var config = Path.Combine(LocalState.DirectoryPath, "origins.json");
        var origins = File.Exists(config) ? System.Text.Json.JsonSerializer.Deserialize<string[]>(File.ReadAllText(config)) ?? [] : ["https://www.tradingdocks.com"];
        var certificate = state.Certificate();
        AgentLifecycle.Log($"configuration-loaded origins={origins.Length} tls={certificate.Thumbprint}");
        server = BridgeHost.Create(new(certificate, origins), trust, captures, backend, state.WorkstationId, inbox);
        AgentLifecycle.RunHostOperation(() => server.StartAsync());
        AgentLifecycle.Log("listener-started 127.0.0.1:47391");
        var menu = new ContextMenuStrip();
        menu.Items.Add("ScanSnap setup", null, (_, _) => MessageBox.Show($"Create a Trading Docks Cards profile in ScanSnap Home.\nPC (Scan to file), direct save, JPEG, color, 300 DPI, single-sided. Disable per-scan Save/rename prompts.\nSave destination (configure once):\n{inbox.Root}\n\nStart Live Scan in Trading Docks before pressing the physical Scan button. Only new JPEG files in this inbox are accepted. Physical certification pending.", "Finish ScanSnap setup"));
        menu.Items.Add("Open Status", null, (_, _) => MessageBox.Show($"Bridge {Protocol.VersionString} — HTTPS loopback only\nPaired browsers: {trust.Count}\nWorkstation: {state.WorkstationId}\nChoose your scanner in Chaos Sort. Physical certification pending.", "Scanner Bridge"));
        menu.Items.Add("Confirm ScanSnap profile configured", null, (_, _) => { if (MessageBox.Show("Have you configured Trading Docks Cards to automatically save JPEGs to this bridge's Inbox? This records setup confirmation, not hardware certification.", "Confirm one-time setup", MessageBoxButtons.YesNo) == DialogResult.Yes) File.WriteAllText(setupMarker, DateTimeOffset.UtcNow.ToString("O")); });
        var startup = new ToolStripMenuItem("Start with Windows") { Checked = LocalState.AutoStart, CheckOnClick = true }; startup.Click += (_, _) => LocalState.AutoStart = startup.Checked; menu.Items.Add(startup);
        menu.Items.Add("Restart Bridge", null, (_, _) => { RestartRequested = true; ExitThread(); });
        menu.Items.Add("Unpair Trading Docks", null, (_, _) => { trust.Revoke(); captures.RevokeAll(); inbox.Revoke(); });
        menu.Items.Add("Exit", null, (_, _) => ExitThread());
        tray = new() { Icon = SystemIcons.Application, Text = "Trading Docks Scanner Bridge (internal)", ContextMenuStrip = menu, Visible = true };
        AgentLifecycle.Log("tray-visible");
    }
    protected override void ExitThreadCore()
    {
        if (stopping) return;
        stopping = true;
        AgentLifecycle.Log(RestartRequested ? "restart-requested" : "exit-requested");
        captures.RevokeAll();
        AgentLifecycle.RunHostOperation(async () => { await server.StopAsync().ConfigureAwait(false); await server.DisposeAsync().ConfigureAwait(false); });
        AgentLifecycle.Log("listener-stopped");
        tray.Visible = false; tray.Dispose(); backend.Dispose(); dispatcher.Dispose();
        base.ExitThreadCore();
    }
}
