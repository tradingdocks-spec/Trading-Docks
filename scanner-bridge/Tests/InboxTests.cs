using TradingDocks.ScannerBridge;
static class InboxTests
{
    public static async Task Run(Action<bool,string> check)
    {
        var root = Path.Combine(Path.GetTempPath(), "td-inbox-test-"+Guid.NewGuid().ToString("N")); Directory.CreateDirectory(root);
        var platform = new Fixture(); var inbox = new ScannerInbox(root,platform,5);
        var session = new LiveInboxSession(Guid.NewGuid().ToString(),Guid.NewGuid().ToString(),Guid.NewGuid().ToString(),"box","station","scanner");
        var old=Path.Combine(root,"old.jpg"); File.WriteAllBytes(old,[1]);
        try {
            try { await inbox.Capture("owner",session.Id,"no-session",default); throw new Exception("No-session accepted"); } catch(BridgeException e) { check(e.Message=="SESSION_EXPIRED_OR_INVALID","inbox requires authorized session"); }
            inbox.Start("owner",session);
            try { inbox.ValidateDevice("owner",session.Id,"different"); throw new Exception("Wrong device accepted"); } catch(BridgeException e) { check(e.Message=="SESSION_DEVICE_MISMATCH","capture cannot switch the scoped device"); }
            File.WriteAllBytes(old,[2]);
            using(var cancel=new CancellationTokenSource(40)) { try { await inbox.Capture("owner",session.Id,"old",cancel.Token); throw new Exception("Old file accepted"); } catch(OperationCanceledException) { check(true,"preexisting file ignored even if modified"); } }
            for(var i=1;i<=100;i++) {
                var file=Path.Combine(root,$"scan-{i}.jpg"); var request=$"request-{i}";
                File.WriteAllBytes(file,[0xff,0xd8,0xff]);
                using var result=await inbox.Capture("owner",session.Id,request,default);
                using var retry=await inbox.Capture("owner",session.Id,request,default);
                check(result.Bytes.SequenceEqual(retry.Bytes),$"capture {i} response-loss replay preserves identity");
                check(File.Exists(file),$"capture {i} retained before cloud ACK");
                inbox.Ack("owner",session.Id,request); inbox.Ack("owner",session.Id,request);
                check(!File.Exists(file),$"capture {i} ACK cleanup idempotent");
            }
            var overflow=Path.Combine(root,"101.jpg"); File.WriteAllBytes(overflow,[0xff,0xd8,0xff]);
            try { await inbox.Capture("owner",session.Id,"101",default); throw new Exception("Overflow accepted"); } catch(BridgeException e) { check(e.Message=="BATCH_FULL" && File.Exists(overflow),"101 blocked and preserved"); }
            try { inbox.Start("other",session); throw new Exception("Wrong user resumed"); } catch(BridgeException e) { check(e.Message=="SESSION_CONFLICT","different credential cannot resume session"); }
            var next=session with{Id=Guid.NewGuid().ToString(),BatchId=Guid.NewGuid().ToString()}; inbox.Start("owner",next);
            using(var cancel=new CancellationTokenSource(40)) { try { await inbox.Capture("owner",next.Id,"old-overflow",cancel.Token); throw new Exception("Overflow moved batch"); } catch(OperationCanceledException) { check(File.Exists(overflow),"next batch cannot silently consume prior overflow"); } }
            var invalid=Path.Combine(root,"bad.jpg"); File.WriteAllBytes(invalid,[1,2,3]);
            try { await inbox.Capture("owner",next.Id,"bad",default); throw new Exception("Bad image accepted"); } catch(BridgeException e) { check(e.Message=="INVALID_IMAGE" && File.Exists(invalid),"malformed file rejected and retained"); }
            inbox.Pause("owner",next.Id);
            try { await inbox.Capture("owner",next.Id,"paused",default); throw new Exception("Paused accepted"); } catch(BridgeException e) { check(e.Message=="SESSION_PAUSED","paused session refuses intake"); }
            inbox.Start("owner",next);
            var incomplete=Path.Combine(root,"incomplete.jpg");
            Task<CapturedImage> reading;
            using(var writer=new FileStream(incomplete,FileMode.Create,FileAccess.Write,FileShare.None)) {
                writer.Write([0xff]); writer.Flush(); reading=inbox.Capture("owner",next.Id,"incomplete",default);
                await Task.Delay(40); check(!reading.IsCompleted,"locked incomplete write is not ingested");
                writer.Write([0xd8,0xff]); writer.Flush();
            }
            using(var complete=await reading) check(complete.Bytes.Length==3,"complete stable write ingested once");
            inbox.Pause("owner",next.Id); inbox.Start("owner",next);
            using(var reconnect=await inbox.Capture("owner",next.Id,"incomplete",default)) check(reconnect.Bytes.Length==3,"same authenticated session recovers unacknowledged image");
            inbox.Ack("owner",next.Id,"incomplete");
            platform.Connected=false;
            try { await inbox.Capture("owner",next.Id,"disconnected",default); throw new Exception("Disconnected accepted"); } catch(BridgeException e) { check(e.Message=="DEVICE_OFFLINE","disconnect cleanly fails without changing batch"); }
            platform.Connected=true; File.WriteAllBytes(Path.Combine(root,"reconnected.jpg"),[0xff,0xd8,0xff]);
            using(var reconnected=await inbox.Capture("owner",next.Id,"reconnected",default)) check(reconnected.Bytes.Length==3,"reconnected device works without reinstall");
            inbox.Ack("owner",next.Id,"reconnected");
        } finally { Directory.Delete(root,true); }
    }
    private sealed class Fixture:IScanSnapPlatform {
        public bool Connected=true;
        public bool SoftwareInstalled=>true;
        public string[] ConnectedDevices()=>Connected?["fixture"]:[];
        public IDisposable ShowCaptureDestination(string path,CancellationToken cancellation)=>throw new Exception("Manual filename prompt forbidden in inbox workflow");
        public CapturedImage DecodeImage(string path) { var bytes=File.ReadAllBytes(path); if(!bytes.SequenceEqual(new byte[]{0xff,0xd8,0xff}))throw new BridgeException("INVALID_IMAGE");return new(bytes,"image/jpeg",100,150); }
    }
}
