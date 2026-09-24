using System.Diagnostics;

namespace TradingDocks.ScannerBridge.Windows;

public static class AgentLifecycle
{
    // WinForms shutdown is synchronous. Do not let async host continuations
    // capture its blocked synchronization context.
    public static void RunHostOperation(Func<Task> stop) => Task.Run(stop).GetAwaiter().GetResult();

    public static ProcessStartInfo RestartInfo(string executable, string directory) => new(executable)
    {
        WorkingDirectory = directory,
        UseShellExecute = false
    };

    public static void Log(string stage, Exception? error = null)
    {
        try
        {
            Directory.CreateDirectory(LocalState.DirectoryPath);
            File.AppendAllText(Path.Combine(LocalState.DirectoryPath, "lifecycle.log"),
                $"{DateTimeOffset.UtcNow:O} pid={Environment.ProcessId} {stage}" +
                (error is null ? "" : $" {error.GetType().FullName} HRESULT={error.HResult:X8}\n{error.StackTrace}") + "\n");
        }
        catch { /* Logging must not prevent startup or state-preserving shutdown. */ }
    }
}
