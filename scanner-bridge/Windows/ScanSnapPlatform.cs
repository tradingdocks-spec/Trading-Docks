using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;
using TradingDocks.ScannerBridge;

namespace TradingDocks.ScannerBridge.Windows;

// Windows SetupAPI enumeration; no WIA dependency, shell execution, or proprietary SDK calls.
public sealed class ScanSnapPlatform(Control dispatcher) : IScanSnapPlatform
{
    public bool SoftwareInstalled => File.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "PFU", "ScanSnap", "Home", "PfuSshMain.exe"));
    public string[] ConnectedDevices()
    {
        var found = new List<string>();
        var set = SetupDiGetClassDevs(IntPtr.Zero, "USB", IntPtr.Zero, 6); // PRESENT | ALLCLASSES
        if (set == new IntPtr(-1)) return [];
        try
        {
            for (uint index = 0; ; index++)
            {
                var data = new DeviceData { Size = (uint)Marshal.SizeOf<DeviceData>() };
                if (!SetupDiEnumDeviceInfo(set, index, ref data)) break;
                var id = new StringBuilder(512);
                if (!SetupDiGetDeviceInstanceId(set, ref data, id, id.Capacity, out _)) continue;
                var value = id.ToString();
                if (!value.StartsWith("USB\\VID_04C5&PID_132B\\", StringComparison.OrdinalIgnoreCase)) continue;
                // Require the installed driver's descriptive identity as well as the observed USB product ID.
                var description = new byte[1024];
                if (!SetupDiGetDeviceRegistryProperty(set, ref data, 0, out _, description, description.Length, out _)) continue;
                if (Encoding.Unicode.GetString(description).TrimEnd('\0').Contains("iX500", StringComparison.OrdinalIgnoreCase)) found.Add(value);
            }
        }
        finally { SetupDiDestroyDeviceInfoList(set); }
        return found.ToArray();
    }
    public IDisposable ShowCaptureDestination(string path, CancellationToken cancellation)
    {
        var lease = new PromptLease(dispatcher);
        dispatcher.BeginInvoke(() =>
        {
            if (lease.Closed || cancellation.IsCancellationRequested) return;
            var window = new Form { Text = "Waiting for ScanSnap — Trading Docks", Width = 650, Height = 290, StartPosition = FormStartPosition.CenterScreen };
            var layout = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, Padding = new Padding(14), WrapContents = false };
            layout.Controls.Add(new Label { AutoSize = true, MaximumSize = new Size(595, 0), Text = "Place one card in the feeder and press Scan on the iX500.\nUse Trading Docks Cards: 300 DPI, color, simplex, JPEG.\nIn ScanSnap Home's save dialog, paste this complete destination.\nOnly this capture.jpg is accepted. This request expires after 90 seconds." });
            var field = new TextBox { ReadOnly = true, Text = path, Width = 590 };
            layout.Controls.Add(field);
            var copy = new Button { Text = "Copy capture destination", AutoSize = true };
            copy.Click += (_, _) => { try { Clipboard.SetText(path); } catch (ExternalException) { field.SelectAll(); field.Focus(); } };
            layout.Controls.Add(copy);
            layout.Controls.Add(new Label { Text = "Cancel in Trading Docks to abandon this request. Never save to a previous capture destination.", AutoSize = true, MaximumSize = new Size(595, 0) });
            window.Controls.Add(layout); lease.Window = window; window.Show();
        });
        return lease;
    }
    public CapturedImage DecodeImage(string path)
    {
        ScanSnapBackend.NoLinks(path);
        using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.None);
        if (!GetFileInformationByHandle(file.SafeFileHandle, out var info) || info.Links != 1 || (info.Attributes & 0x400) != 0) throw new BridgeException("UNSAFE_CAPTURE_PATH");
        var actual = new StringBuilder(32768);
        var length = GetFinalPathNameByHandle(file.SafeFileHandle, actual, actual.Capacity, 0);
        if (length == 0 || length >= actual.Capacity || !string.Equals(actual.ToString(), "\\\\?\\" + Path.GetFullPath(path), StringComparison.OrdinalIgnoreCase)) throw new BridgeException("UNSAFE_CAPTURE_PATH");
        if (file.Length > Protocol.MaxImageBytes) throw new BridgeException("IMAGE_LIMIT_EXCEEDED");
        if (file.ReadByte() != 0xff || file.ReadByte() != 0xd8 || file.ReadByte() != 0xff) throw new BridgeException("INVALID_IMAGE");
        file.Position = 0;
        try
        {
            using var image = Image.FromStream(file, false, true);
            if (image.RawFormat.Guid != ImageFormat.Jpeg.Guid || (long)image.Width * image.Height > 20_000_000) throw new BridgeException("INVALID_IMAGE");
            var ratio = Math.Min(1, 2500d / Math.Max(image.Width, image.Height));
            using var normalized = new Bitmap(image, Math.Max(1, (int)(image.Width * ratio)), Math.Max(1, (int)(image.Height * ratio)));
            using var output = new MemoryStream(); normalized.Save(output, ImageFormat.Jpeg);
            if (output.Length > Protocol.MaxImageBytes) throw new BridgeException("IMAGE_LIMIT_EXCEEDED");
            return new(output.ToArray(), "image/jpeg", normalized.Width, normalized.Height);
        }
        catch (Exception error) when (error is ArgumentException or ExternalException or OutOfMemoryException) { throw new BridgeException("INVALID_IMAGE"); }
    }
    private sealed class PromptLease(Control dispatcher) : IDisposable
    {
        public volatile bool Closed;
        public Form? Window;
        public void Dispose() { Closed = true; if (!dispatcher.IsDisposed) dispatcher.BeginInvoke(() => { Window?.Close(); Window?.Dispose(); }); }
    }
    [StructLayout(LayoutKind.Sequential)] private struct DeviceData { public uint Size; public Guid Class; public uint DevInst; public IntPtr Reserved; }
    [StructLayout(LayoutKind.Sequential)] private struct FileInfoNative { public uint Attributes, CreatedLow, CreatedHigh, AccessedLow, AccessedHigh, WrittenLow, WrittenHigh, Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow; }
    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, EntryPoint = "SetupDiGetClassDevsW")] private static extern IntPtr SetupDiGetClassDevs(IntPtr guid, string enumerator, IntPtr parent, uint flags);
    [DllImport("setupapi.dll")] private static extern bool SetupDiEnumDeviceInfo(IntPtr set, uint index, ref DeviceData data);
    [DllImport("setupapi.dll", CharSet = CharSet.Unicode, EntryPoint = "SetupDiGetDeviceInstanceIdW")] private static extern bool SetupDiGetDeviceInstanceId(IntPtr set, ref DeviceData data, StringBuilder id, int size, out int required);
    [DllImport("setupapi.dll", EntryPoint = "SetupDiGetDeviceRegistryPropertyW")] private static extern bool SetupDiGetDeviceRegistryProperty(IntPtr set, ref DeviceData data, uint property, out uint type, byte[] buffer, int size, out int required);
    [DllImport("setupapi.dll")] private static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
    [DllImport("kernel32.dll")] private static extern bool GetFileInformationByHandle(SafeFileHandle file, out FileInfoNative info);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, EntryPoint = "GetFinalPathNameByHandleW")] private static extern uint GetFinalPathNameByHandle(SafeFileHandle file, StringBuilder path, int size, uint flags);
}
