"use client";
import { useEffect, useRef, useState } from "react";
import { TradingDocksLocalScannerProvider, ScannerBridgeError, defaultScanSettings } from "@/lib/chaos-sort/local-scanner-provider";
import type { ScannerDevice, ScanSettings } from "@/lib/chaos-sort/scanner-provider";
import { TDButton } from "@/components/design-system/td-primitives";

export function ScannerBridgeControls({ disabled, active, onReady, onUnavailable }: { disabled: boolean; active: boolean; onReady: (provider: TradingDocksLocalScannerProvider) => void; onUnavailable: () => void }) {
  const bridge = useRef<TradingDocksLocalScannerProvider | null>(null);
  const [diagnostic, setDiagnostic] = useState("");
  const refreshing = useRef(false);
  const operation = useRef({ disabled, pairing: false });
  useEffect(() => { operation.current.disabled = disabled; }, [disabled]);
  const [status, setStatus] = useState("Connecting…");
  const [found, setFound] = useState(false);
  const [paired, setPaired] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<ScannerDevice[]>([]);
  const [selected, setSelected] = useState("");
  const [settings, setSettings] = useState<ScanSettings>();
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useState("fast");
  const callbacks = useRef({ onReady, onUnavailable });
  useEffect(() => { callbacks.current = { onReady, onUnavailable }; }, [onReady, onUnavailable]);
  async function choose(device: ScannerDevice) {
    await bridge.current!.selectDevice(device); await bridge.current!.connect();
    setSelected(device.id); setSettings(defaultScanSettings(device.scanCapabilities!)); setProfile("fast");
    setStatus("Ready"); callbacks.current.onReady(bridge.current!);
  }
  async function refresh() {
    if (refreshing.current || operation.current.disabled || operation.current.pairing) return;
    refreshing.current = true;
    if (!bridge.current) bridge.current = new TradingDocksLocalScannerProvider();
    setBusy(true);
    try {
      await bridge.current.health(); setFound(true);
      if (!await bridge.current.paired()) { setPaired(false); setStatus("Needs setup — pair this computer"); return; }
      const list = await bridge.current.detect(); setDevices(list); setPaired(true);
      const remembered = await bridge.current.rememberedDevice();
      const device = list.find(d => d.id === remembered);
      if (device && bridge.current.getStatus() !== "ready") await choose(device);
      else if (device) { setSelected(device.id); setStatus("Ready"); callbacks.current.onReady(bridge.current!); }
      else { setSelected(""); callbacks.current.onUnavailable(); setStatus(remembered ? "Previously selected scanner not found. Choose another scanner." : list.length ? "Paired — select a scanner" : "Paired — no supported scanners detected"); }
    } catch (error) { if (error instanceof ScannerBridgeError && ["UNPAIRED_OR_EXPIRED", "INVALID_PROOF"].includes(error.code)) setPaired(false); callbacks.current.onUnavailable(); setDiagnostic(error instanceof Error ? error.message : "Agent unavailable"); setStatus("Scanner disconnected"); }
    finally { refreshing.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!active) return;
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 10000);
    const retry = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("online", retry); document.addEventListener("visibilitychange", retry);
    return () => { clearInterval(timer); window.removeEventListener("online", retry); document.removeEventListener("visibilitychange", retry); };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  async function pair() {
    operation.current.pairing = true; setBusy(true); setStatus("Approve this computer in the local pairing prompt, then enter its code.");
    try { await bridge.current!.startPairing(); setPairing(true); }
    catch (error) { operation.current.pairing = false; setStatus(error instanceof Error ? error.message : "Pairing failed"); }
    finally { setBusy(false); }
  }
  async function finish() {
    setBusy(true);
    try { await bridge.current!.finishPairing(code); setPairing(false); operation.current.pairing = false; setCode(""); await refresh(); }
    catch (error) { operation.current.pairing = false; setStatus(error instanceof Error ? error.message : "Pairing failed"); }
    finally { setBusy(false); }
  }
  const device = devices.find(d => d.id === selected);
  function configure(next: ScanSettings, preset = "custom") { try { bridge.current!.configure({ settings: next }); setSettings(next); setProfile(preset); } catch (error) { setStatus(error instanceof Error ? error.message : "Unsupported setting"); } }
  return <div className="rounded-xl border p-3 space-y-3" aria-label="Scanner Bridge connection">
    <p role="status">{status}</p>
    {!found && <p className="text-sm">Needs setup. Start the installed Scanner Agent and allow the browser's local-network connection. Do not bypass certificate warnings.</p>}
    {!paired && <TDButton size="sm" disabled={!found || disabled || busy} onClick={() => void pair()}>Pair this workstation</TDButton>}
    {pairing && <div className="flex flex-wrap gap-2"><label>One-time pairing code<input className="block border rounded p-2" inputMode="numeric" autoComplete="off" maxLength={7} value={code} onChange={event => setCode(event.target.value)} /></label><TDButton disabled={disabled || busy || code.replaceAll(" ", "").length !== 6} onClick={() => void finish()}>Confirm pairing</TDButton></div>}
    <label className="block">Scanner<select aria-label="Installed scanner" className="block w-full border rounded p-2" value={selected} disabled={!paired || disabled || busy} onChange={async event => { const next = devices.find(d => d.id === event.target.value); if (!next) return; setBusy(true); try { await choose(next); } catch (error) { setStatus(error instanceof Error ? error.message : "Scanner disconnected"); callbacks.current.onUnavailable(); } finally { setBusy(false); } }}><option value="">{paired ? "Select a scanner" : "Pair this workstation first"}</option>{devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <TDButton size="sm" variant="secondary" disabled={disabled || busy} onClick={() => setShowSettings(v => !v)}>Scanner Settings</TDButton>
    {showSettings && <details><summary>Advanced</summary>
      <p>{diagnostic || status}</p><p>{device?.backend} · {device?.connection} · Detected; physical verification is recorded separately.</p>
      <TDButton size="sm" disabled={disabled || busy} onClick={() => void refresh()}>Refresh Devices</TDButton>
      {paired && <TDButton size="sm" variant="ghost" disabled={disabled || busy} onClick={async () => { if (!window.confirm("Forget this computer? Unfinished scans remain protected and will not move to another batch.")) return; try { await bridge.current!.unpair(); setPaired(false); setSelected(""); setDevices([]); callbacks.current.onUnavailable(); setStatus("Needs setup — pair this computer"); } catch (error) { setDiagnostic(error instanceof Error ? error.message : "Unable to forget this computer"); } }}>Forget this computer</TDButton>}
    </details>}
    {showSettings && device && settings && <>
      {device.scanCapabilities?.setupRequired && <p role="status">Needs setup. Complete the scanner's one-time output profile before scanning.</p>}
      {device.scanCapabilities?.externalSettings && <p>Use the configured Trading Docks card profile. Arm capture here, then press the scanner's physical Scan button. No per-card file selection is needed.</p>}
      {!device.scanCapabilities?.externalSettings && <label>Profile<select aria-label="Scanner profile" disabled={disabled || busy} value={profile} onChange={event => configure(defaultScanSettings(device.scanCapabilities!, event.target.value === "quality"), event.target.value)}><option value="fast">Trading Cards — Fast</option><option value="quality">Trading Cards — High Quality</option>{profile === "custom" && <option value="custom">Custom scanner settings</option>}</select></label>}
      {showSettings && !device.scanCapabilities?.externalSettings && <fieldset disabled={disabled || busy} className="flex flex-wrap gap-3"><label>DPI<select aria-label="Scanner DPI" value={settings.dpi} onChange={e => configure({ ...settings, dpi: Number(e.target.value) })}>{device.scanCapabilities!.dpi.map(d => <option key={d}>{d}</option>)}</select></label><label>Source<select aria-label="Scanner source" value={settings.source} onChange={e => configure({ ...settings, source: e.target.value })}>{device.scanCapabilities!.sources.map(s => <option key={s}>{s}</option>)}</select></label><label>Color<select aria-label="Scanner color" value={settings.colorMode} onChange={e => configure({ ...settings, colorMode: e.target.value })}>{device.scanCapabilities!.colorModes.map(c => <option key={c}>{c}</option>)}</select></label>{device.scanCapabilities!.autoCrop && <label><input type="checkbox" checked={settings.autoCrop} onChange={e => configure({ ...settings, autoCrop: e.target.checked })} />Auto crop</label>}{device.scanCapabilities!.duplex && <label><input type="checkbox" checked={settings.duplex} onChange={e => configure({ ...settings, duplex: e.target.checked })} />Duplex</label>}</fieldset>}
    </>}
  </div>;
}
