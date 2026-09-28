using System.Drawing.Imaging;
using System.Reflection;
using System.Text.Json;
using NTwain;
using NTwain.Data;

// Private child process, never a network listener. The bridge launches the x86
// build for PaperStream's 32-bit DSM. Only one request is accepted per process.
internal static class Program
{
    private static string Key(DataSource source) => $"{source.Manufacturer}\n{source.ProductFamily}\n{source.Name}";
    private static void Require(ReturnCode code) { if (code != ReturnCode.Success) throw new InvalidOperationException("UNSUPPORTED_SETTING"); }
    private static bool SupportsDpi(DataSource source, CapabilityId capability, int value)
    {
        var values = source.Capabilities.GetValuesRaw(capability);
        if (values is null) return false;
        double Number(object number) => number is TWFix32 fixedPoint ? (double)fixedPoint : Convert.ToDouble(number);
        if (values.ContainerType != ContainerType.Range) return values.EnumerateCapValues().Take(10000).Any(v => Number(v) == value);
        var min = Number(values.RangeMinValue); var max = Number(values.RangeMaxValue); var step = Number(values.RangeStepSize);
        return value >= min && value <= max && (step == 0 || Math.Abs((value - min) / step - Math.Round((value - min) / step)) < 0.000001);
    }
    public static async Task Main()
    {
        try
        {
            var input = Console.ReadLine();
            if (input is null || input.Length > 4096) throw new InvalidOperationException("INVALID_CAPTURE");
            var request = JsonSerializer.Deserialize<Request>(input)!;
            // Use the Windows legacy DSM for the installed 32-bit PaperStream sources.
            PlatformInfo.Current.PreferNewDSM = false;
            var session = new TwainSession(TWIdentity.CreateFromAssembly(DataGroups.Image, Assembly.GetExecutingAssembly()));
            if (session.Open() != ReturnCode.Success) throw new InvalidOperationException("DRIVER_UNAVAILABLE");
            if (request.Action == "devices")
            {
                var devices = new List<object>();
                var failures = new List<object>();
                foreach (var source in session)
                {
                    if (source.Open() != ReturnCode.Success) { failures.Add(new { Name = source.Name, Code = "DEVICE_UNAVAILABLE", Detail = session.GetStatus().ConditionCode.ToString() }); continue; }
                    try
                    {
                        var caps = source.Capabilities;
                        if (!caps.ICapPixelType.GetValues().Contains(PixelType.RGB)) continue;
                        var dpi = new List<int>();
                        foreach (var value in new[] { 300, 400, 600 })
                            if (SupportsDpi(source, CapabilityId.ICapXResolution, value) && SupportsDpi(source, CapabilityId.ICapYResolution, value)) dpi.Add(value);
                        if (dpi.Count == 0) continue;
                        var feeder = caps.CapFeederEnabled.GetCurrent() == BoolType.True || caps.CapFeederEnabled.CanSet;
                        var duplex = caps.CapDuplexEnabled.IsSupported && caps.CapDuplex.GetCurrent() != Duplex.None;
                        var loaded = caps.CapFeederLoaded.IsSupported && caps.CapFeederLoaded.GetCurrent() == BoolType.True;
                        devices.Add(new { NativeKey = Key(source), Name = source.Name, Manufacturer = source.Manufacturer, Dpi = dpi, Feeder = feeder, Duplex = duplex, Loaded = loaded });
                    }
                    catch { failures.Add(new { Name = source.Name, Code = "DRIVER_UNAVAILABLE", Detail = "Capability negotiation failed" }); }
                    finally { source.Close(); }
                }
                session.Close();
                Console.WriteLine(JsonSerializer.Serialize(new { Devices = devices, Errors = failures.Distinct().ToArray() }));
                return;
            }
            if (request.Action != "capture") throw new InvalidOperationException("INVALID_CAPTURE");
            var matches = session.Where(source => Key(source) == request.NativeKey).ToArray();
            if (matches.Length != 1) throw new InvalidOperationException("DEVICE_OFFLINE");
            var selected = matches[0];
            if (selected.Open() != ReturnCode.Success) throw new InvalidOperationException("DEVICE_OFFLINE");
            var c = selected.Capabilities;
            Require(c.ICapXferMech.SetValue(XferMech.Native));
            Require(c.ICapPixelType.SetValue(PixelType.RGB));
            Require(c.ICapXResolution.SetValue((TWFix32)request.Dpi));
            Require(c.ICapYResolution.SetValue((TWFix32)request.Dpi));
            Require(c.CapFeederEnabled.SetValue(request.Feeder ? BoolType.True : BoolType.False));
            if (c.CapDuplexEnabled.IsSupported) Require(c.CapDuplexEnabled.SetValue(request.Duplex ? BoolType.True : BoolType.False));
            else if (request.Duplex) throw new InvalidOperationException("UNSUPPORTED_SETTING");
            // Blank-page suppression would destroy deterministic duplex pairing.
            if (c.ICapAutoDiscardBlankPages.IsSupported) Require(c.ICapAutoDiscardBlankPages.SetValue(BlankPage.Disable));
            Require(c.CapXferCount.SetValue(request.Duplex ? 2 : 1));
            if (c.CapAutoFeed.IsSupported) Require(c.CapAutoFeed.SetValue(BoolType.False));
            if (c.CapFeederOrder.CanSet) Require(c.CapFeederOrder.SetValue(FeederOrder.FirstPageFirst));
            if ((double)c.ICapXResolution.GetCurrent() != request.Dpi || (double)c.ICapYResolution.GetCurrent() != request.Dpi || c.ICapPixelType.GetCurrent() != PixelType.RGB || request.Duplex && c.CapDuplexEnabled.GetCurrent() != BoolType.True) throw new InvalidOperationException("UNSUPPORTED_SETTING");
            var pages = new List<Page>();
            var completion = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            string? failure = null;
            session.TransferReady += (_, e) => { if (failure is not null || pages.Count >= (request.Duplex ? 2 : 1)) e.CancelAll = true; };
            session.DataTransferred += (_, e) =>
            {
                try
                {
                    using var stream = e.GetNativeImageStream();
                    using var bitmap = Image.FromStream(stream ?? throw new InvalidOperationException());
                    if ((long)bitmap.Width * bitmap.Height > 20_000_000) throw new InvalidOperationException();
                    using var output = new MemoryStream(); bitmap.Save(output, ImageFormat.Jpeg);
                    if (output.Length > 8 * 1024 * 1024) throw new InvalidOperationException();
                    int? side = null;
                    try { foreach (var info in e.GetExtImageInfo(ExtendedImageInfo.PageSide)) if (info.ReturnCode == ReturnCode.Success && info.ReadValues().FirstOrDefault() is { } value) { var number = Convert.ToInt32(value); if (number is 1 or 2) side = number; } } catch { /* Older sources omit TWEI_PAGESIDE; strict transfer order is retained. */ }
                    pages.Add(new(Convert.ToBase64String(output.ToArray()), bitmap.Width, bitmap.Height, side));
                }
                catch { failure = "CAPTURE_FAILED"; }
            };
            session.TransferError += (_, _) => { failure = "CAPTURE_FAILED"; completion.TrySetResult(false); };
            session.SourceDisabled += (_, _) => completion.TrySetResult(true);
            Require(selected.Enable(SourceEnableMode.NoUI, false, IntPtr.Zero));
            await completion.Task.WaitAsync(TimeSpan.FromSeconds(80));
            if (failure is not null) throw new InvalidOperationException(failure);
            if (pages.Count != (request.Duplex ? 2 : 1)) throw new InvalidOperationException(request.Duplex ? "DUPLEX_INCOMPLETE" : "NO_MEDIA");
            if (request.Duplex && pages.All(page => page.Side is not null)) {
                if (pages[0].Side == pages[1].Side) throw new InvalidOperationException("DUPLEX_INCOMPLETE");
                pages.Sort((a, b) => a.Side!.Value.CompareTo(b.Side!.Value));
            }
            selected.Close(); session.Close();
            Console.WriteLine(JsonSerializer.Serialize(new { Pages = pages }));
        }
        catch (Exception error)
        {
            var code = error is DllNotFoundException or BadImageFormatException ? "DRIVER_UNAVAILABLE" : error is TimeoutException ? "CAPTURE_INTERRUPTED" : error is InvalidOperationException ? error.Message : "CAPTURE_FAILED";
            Console.WriteLine(JsonSerializer.Serialize(new { Error = code }));
        }
    }
    private sealed record Request(string Action, string? NativeKey, int Dpi = 400, bool Feeder = true, bool Duplex = false);
    private sealed record Page(string Image, int Width, int Height, int? Side);
}
