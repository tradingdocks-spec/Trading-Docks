"use client";
import { useEffect, useRef, useState } from "react";
import { TradingDocksLocalScannerProvider, ScannerBridgeError, defaultScanSettings } from "@/lib/chaos-sort/local-scanner-provider";
import type { ScannerDevice, ScanSettings } from "@/lib/chaos-sort/scanner-provider";
import { TDButton } from "@/components/design-system/td-primitives";

export function ScannerBridgeControls({ disabled, active, onReady, onUnavailable }: { disabled: boolean; active: boolean; onReady: (provider: TradingDocksLocalScannerProvider) => void; onUnavailable: () => void }) {
  const bridge = useRef<TradingDocksLocalScannerProvider | null>(null);
  const [status, setStatus] = useState("Checking Scanner Bridge…");
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
    setStatus("Scanner selected — detected, physical certification pending"); callbacks.current.onReady(bridge.current!);
  }
  async function refresh() {
    if (!bridge.current) bridge.current = new TradingDocksLocalScannerProvider();
    setBusy(true);
    try {
      await bridge.current.health(); setFound(true);
      if (!await bridge.current.paired()) { setPaired(false); setStatus("Scanner Bridge found — pair this workstation"); return; }
      const list = await bridge.current.detect(); setDevices(list); setPaired(true);
      const remembered = await bridge.current.rememberedDevice();
      const device = list.find(d => d.id === remembered);
      if (device) await choose(device);
      else { setSelected(""); callbacks.current.onUnavailable(); setStatus(remembered ? "Previously selected scanner not found. Choose another scanner." : list.length ? "Paired — select a scanner" : "Paired — no supported scanners detected"); }
    } catch (error) { if (error instanceof ScannerBridgeError && ["UNPAIRED_OR_EXPIRED", "INVALID_PROOF"].includes(error.code)) setPaired(false); callbacks.current.onUnavailable(); setStatus(error instanceof Error ? error.message : "Bridge unavailable"); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (active) void refresh(); /* Detect once on entering Live Scan; never poll a user's network. */ }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  async function pair() {
    setBusy(true); setStatus("Confirm pairing in the local Scanner Bridge window, then enter its code here.");
    try { await bridge.current!.startPairing(); setPairing(true); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Pairing failed"); }
    finally { setBusy(false); }
  }
  async function finish() {
    setBusy(true);
    try { await bridge.current!.finishPairing(code); setPairing(false); setCode(""); await refresh(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Pairing failed"); }
    finally { setBusy(false); }
  }
  const device = devices.find(d => d.id === selected);
  function configure(next: ScanSettings, preset = "custom") { try { bridge.current!.configure({ settings: next }); setSettings(next); setProfile(preset); } catch (error) { setStatus(error instanceof Error ? error.message : "Unsupported setting"); } }
  return <div className="rounded-xl border p-3 space-y-3" aria-label="Scanner Bridge connection">
    <p role="status">{status}</p>
    {!found && <div><p className="font-semibold">Connect a physical scanner</p><p className="text-sm">Trading Docks Scanner Bridge lets this browser securely communicate with compatible Windows scanners. If installed, start it and check browser local-network permission.</p><TDButton size="sm" variant="secondary" disabled>Install Scanner Bridge — internal release pending</TDButton><p className="text-xs">An unsigned installer is not available for public download. Physical certification remains pending.</p></div>}
    <div className="flex flex-wrap gap-2">
      <TDButton size="sm" disabled={disabled || busy} onClick={() => void refresh()}>Refresh Devices</TDButton>
      {!paired && <TDButton size="sm" disabled={!found || disabled || busy} onClick={() => void pair()}>Pair this workstation</TDButton>}
      {paired && <TDButton size="sm" variant="ghost" disabled={disabled || busy} onClick={async () => { try { await bridge.current!.unpair(); } catch (error) { setStatus(error instanceof Error ? error.message : "Local trust cleared"); } setPaired(false); setSelected(""); setDevices([]); callbacks.current.onUnavailable(); }}>Unpair workstation</TDButton>}
    </div>
    {pairing && <div className="flex flex-wrap gap-2"><label>One-time pairing code<input className="block border rounded p-2" inputMode="numeric" autoComplete="off" maxLength={7} value={code} onChange={event => setCode(event.target.value)} /></label><TDButton disabled={disabled || busy || code.replaceAll(" ", "").length !== 6} onClick={() => void finish()}>Confirm pairing</TDButton></div>}
    <label className="block">Scanner<select aria-label="Installed scanner" className="block w-full border rounded p-2" value={selected} disabled={!paired || disabled || busy} onChange={async event => { const next = devices.find(d => d.id === event.target.value); if (!next) return; setBusy(true); try { await choose(next); } catch (error) { setStatus(error instanceof Error ? error.message : "Scanner disconnected"); callbacks.current.onUnavailable(); } finally { setBusy(false); } }}><option value="">{paired ? "Select a scanner" : "Pair this workstation first"}</option>{devices.map(d => <option key={d.id} value={d.id}>{d.name} · {d.connection} · Detected / untested</option>)}</select></label>
    <TDButton size="sm" variant="secondary" disabled={!device || !settings || disabled || busy} onClick={() => setShowSettings(v => !v)}>Scanner Settings</TDButton>
    {device && settings && <>
      <p className="text-xs">{device.backend} · <span>Detected — Untested</span></p>
      {device.scanCapabilities?.captureInstruction && <p role="note" className="text-sm">{device.scanCapabilities.captureInstruction}</p>}
      {!device.scanCapabilities?.externalSettings && <label className="block">Profile<select aria-label="Scanner profile" className="block border rounded p-2" disabled={disabled || busy} value={profile} onChange={event => configure(defaultScanSettings(device.scanCapabilities!, event.target.value === "quality"), event.target.value)}><option value="fast">Trading Cards — Fast</option><option value="quality">Trading Cards — High Quality</option>{profile === "custom" && <option value="custom">Custom scanner settings</option>}</select></label>}
      <p className="text-sm">{device.scanCapabilities?.externalSettings ? "Required profile: " : ""}{settings.dpi} DPI · {settings.colorMode} · {settings.source} · Single-sided{settings.autoCrop ? " · Auto crop" : ""}</p>
      {!device.scanCapabilities?.externalSettings && <p className="text-xs">V1 captures a 3 × 4 inch region. Align one card at the scanner origin. Automatic cropping and duplex are available only when reported by the bridge.</p>}
      {showSettings && device.scanCapabilities?.externalSettings && <p className="text-sm">Configure the required profile in the scanner application before capture. The bridge cannot apply or verify these driver settings. Save one image per capture using the local bridge window. Physical acceptance is pending.</p>}

      {showSettings && !device.scanCapabilities?.externalSettings && <fieldset disabled={disabled || busy} className="flex flex-wrap gap-3"><label>DPI<select aria-label="Scanner DPI" value={settings.dpi} onChange={e => configure({ ...settings, dpi: Number(e.target.value) })}>{device.scanCapabilities!.dpi.map(d => <option key={d}>{d}</option>)}</select></label><label>Source<select aria-label="Scanner source" value={settings.source} onChange={e => configure({ ...settings, source: e.target.value })}>{device.scanCapabilities!.sources.map(s => <option key={s}>{s}</option>)}</select></label><label>Color<select aria-label="Scanner color" value={settings.colorMode} onChange={e => configure({ ...settings, colorMode: e.target.value })}>{device.scanCapabilities!.colorModes.map(c => <option key={c}>{c}</option>)}</select></label>{device.scanCapabilities!.autoCrop && <label><input type="checkbox" checked={settings.autoCrop} onChange={e => configure({ ...settings, autoCrop: e.target.checked })} />Auto crop</label>}{device.scanCapabilities!.duplex && <label><input type="checkbox" checked={settings.duplex} onChange={e => configure({ ...settings, duplex: e.target.checked })} />Duplex</label>}</fieldset>}
    </>}
  </div>;
}
