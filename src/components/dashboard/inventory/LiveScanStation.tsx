"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, ScanLine, Settings2 } from "lucide-react";
import type { ScannerProvider, ScannerConfiguration } from "@/lib/chaos-sort/scanner-provider";
import type { ChaosSortItem } from "@/lib/chaos-sort/domain";
import { liveScanStatus } from "@/lib/chaos-sort/live-intake";
import { TDButton } from "@/components/design-system/td-primitives";

export function LiveScanStation({ count, items, locked, blockedReason, batchId, onCapture, onBusy, onReview, onRemove, onUpload, onConfigured }: {
  count: number; items: ChaosSortItem[]; locked: boolean; batchId: string;
  blockedReason?: string;
  onCapture: (file: File, captureId: string, replaceId?: string) => Promise<void>;
  onBusy: (busy: boolean) => void; onReview: (id: string) => void;
  onRemove: (id: string) => void; onUpload: () => void; onConfigured: () => void;
}) {
  const provider = useRef<ScannerProvider | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [message, setMessage] = useState("");
  const [scenario, setScenario] = useState<ScannerConfiguration["scenario"]>("success");
  const [fixtureCount, setFixtureCount] = useState(0);
  const [testImage, setTestImage] = useState<string | null>(null);
  const testImageRef = useRef<string | null>(null);
  const jobs = useRef(new Set<Promise<void>>());
  const callbacks = useRef({ onCapture, onBusy, onConfigured });
  useEffect(() => { callbacks.current = { onCapture, onBusy, onConfigured }; }, [onCapture, onBusy, onConfigured]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; running.current = false; void provider.current?.disconnect(); if (testImageRef.current) URL.revokeObjectURL(testImageRef.current); };
  }, []);
  useEffect(() => { setMessage(""); setTestImage(null); if (testImageRef.current) { URL.revokeObjectURL(testImageRef.current); testImageRef.current = null; } }, [batchId]);
  const active = items.filter(item => item.humanState !== "removed");
  const latest = active.at(-1);

  async function connect() {
    try {
      // Deliberately compiled out of production. No flag can turn an emulator into hardware.
      if (process.env.NODE_ENV === "production") throw new Error("Physical scanner provider is not installed. Use Upload Images or CSV.");
      if (!provider.current) {
        const { EmulatorScannerProvider } = await import("@/lib/chaos-sort/scanner-provider");
        provider.current = new EmulatorScannerProvider();
      }
      await provider.current.connect(); setConnected(true); setDeviceName(provider.current.getDeviceInfo().name); setMessage("Simulated scanner ready. Choose image fixtures in Scanner Settings.");
      callbacks.current.onConfigured();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Connection failed."); }
  }
  function pause() { running.current = false; provider.current?.cancelCapture(); setMessage("Paused. Recognition already in progress may finish."); }
  async function capture(continuous: boolean, replaceId?: string, testOnly = false) {
    const scanner = provider.current;
    if (!scanner || running.current || busy || locked || (!testOnly && blockedReason) || (!replaceId && !testOnly && count >= 100)) return;
    running.current = true; setBusy(true); callbacks.current.onBusy(true); setMessage("");
    if (!testOnly) { if (testImageRef.current) URL.revokeObjectURL(testImageRef.current); testImageRef.current = null; setTestImage(null); }
    let accepted = count;
    try {
      do {
        if (jobs.current.size >= 8) await Promise.race(jobs.current);
        if (!running.current || (!replaceId && !testOnly && accepted >= 100)) break;
        setCapturing(true);
        const result = await scanner.capture();
        setCapturing(false);
        if (!running.current) break;
        if (testOnly) {
          if (testImageRef.current) URL.revokeObjectURL(testImageRef.current);
          testImageRef.current = URL.createObjectURL(result.file); setTestImage(testImageRef.current);
          setMessage("Test capture successful. No card added to this batch."); break;
        }
        if (!replaceId) accepted += 1;
        const job = callbacks.current.onCapture(result.file, result.captureId, replaceId).catch(error => {
          running.current = false;
          if (mounted.current) setMessage(error instanceof Error ? error.message : "Image intake failed. Pause and review.");
        });
        jobs.current.add(job); void job.finally(() => jobs.current.delete(job));
      } while (continuous && running.current);
      if (accepted >= 100 && !testOnly) setMessage("Batch full — 100 cards. Intake paused automatically.");
    } catch (error) {
      if (mounted.current) { setMessage(error instanceof Error ? error.message : "Capture failed."); setConnected(scanner.getStatus() !== "disconnected"); }
    } finally {
      setCapturing(false); running.current = false;
      await Promise.allSettled([...jobs.current]);
      if (mounted.current) { setBusy(false); callbacks.current.onBusy(false); }
    }
  }
  return <section aria-label="Live scanner station" className="rounded-2xl border border-td-accent/25 bg-td-surface p-4 space-y-4">
    <div className="flex flex-wrap justify-between gap-3">
      <div><h2 className="font-bold uppercase tracking-wider text-sm">Live Scanner</h2><p className="text-sm text-td-secondary">Scanner: {connected ? deviceName : "Not connected"}</p></div>
      <div className="flex flex-wrap gap-2">
        <TDButton size="sm" variant="secondary" onClick={connect} disabled={busy || process.env.NODE_ENV === "production"}>{connected ? "Reconnect" : "Connect Scanner"}</TDButton>
        <TDButton size="sm" variant="secondary" icon={<Settings2 size={15} />} onClick={() => setSettings(value => !value)} disabled={busy}>Scanner Settings</TDButton>
        <TDButton size="sm" variant="secondary" onClick={() => void capture(false, undefined, true)} disabled={!connected || busy || locked}>Test Scan</TDButton>
        {connected && <TDButton size="sm" variant="ghost" disabled={busy} onClick={async () => { await provider.current?.disconnect(); setConnected(false); setMessage("Scanner disconnected. Batch stays intact."); }}>Disconnect</TDButton>}
      </div>
    </div>
    {process.env.NODE_ENV === "production" && <p className="text-sm text-td-secondary">Direct scanner integration is not available yet. Browser JavaScript cannot control arbitrary TWAIN/WIA scanners. <button onClick={onUpload} className="underline">Use Upload Instead</button></p>}
    {settings && <div className="rounded-xl border p-3 space-y-3 text-sm">
      <p>A reviewed physical provider is required for hardware. Development simulation uses image fixtures, not a connected scanner.</p>
      {process.env.NODE_ENV !== "production" && <>
        <label className="block">Scanner image fixtures<input aria-label="Scanner image fixtures" className="block mt-2" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!connected || busy} onChange={event => {
          const files = Array.from(event.target.files ?? []).filter(file => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
          provider.current?.configure({ fixtures: files }); setFixtureCount(files.length);
        }} /></label>
        <label className="block">Simulation scenario <select aria-label="Simulation scenario" value={scenario} disabled={!connected || busy} onChange={event => { const value = event.target.value as ScannerConfiguration["scenario"]; setScenario(value); provider.current?.configure({ scenario: value }); }}>
          <option value="success">Successful capture</option><option value="failure">Capture failure</option><option value="jam">Card jam</option><option value="duplicate">Identical physical copies</option><option value="disconnect">Disconnect</option><option value="slow">Slow capture</option>
        </select></label><p>{fixtureCount} fixtures loaded</p>
      </>}
    </div>}
    <div className="grid gap-4 md:grid-cols-[180px_1fr]">
      <div className="min-h-48 rounded-xl border border-dashed flex items-center justify-center bg-black/10">
        {(testImage || latest?.sourceImageUrl) ? <img className="h-52 max-w-full object-contain" src={testImage || latest?.sourceImageUrl || ""} alt="Latest captured card" /> : <div className="text-center text-sm text-td-muted"><ScanLine className="mx-auto mb-3" />Place next card in scanner<br />Captured-image preview</div>}
      </div>
      <div className="space-y-3">
        <p className="text-3xl font-bold tabular-nums">{count} / 100 <span className="text-sm font-normal">physical cards</span></p>
        <p role="status">{capturing ? "CAPTURING" : busy ? "PROCESSING — capture pipeline active" : locked ? "Batch read only" : blockedReason || (count >= 100 ? "Batch Complete — 100 Cards" : "Paused / ready for next capture")}</p>
        {latest && <div><p className="font-bold">{latest.cardName || "Awaiting identification"}</p><p>{latest.setCode || "Set unknown"} #{latest.collectorNumber || "?"} · {latest.condition || "Condition unrecorded"} · {latest.finish || "Finish unrecorded"}</p><p className="text-sm">{latest.language || "Language unrecorded"} · {Math.round(latest.confidence * 100)}% confidence · {liveScanStatus(latest)}</p></div>}
        <div className="flex flex-wrap gap-2">
          <TDButton size="sm" icon={busy ? <Pause size={15} /> : <Play size={15} />} onClick={() => busy ? pause() : void capture(true)} disabled={locked || (!busy && (Boolean(blockedReason) || !connected || count >= 100 || !fixtureCount))}>{busy ? "Pause Scanner" : "Resume Scanner"}</TDButton>
          <TDButton size="sm" variant="secondary" onClick={() => void capture(false)} disabled={locked || Boolean(blockedReason) || busy || !connected || count >= 100 || !fixtureCount}>Scan One</TDButton>
          {latest && <><TDButton size="sm" variant="secondary" disabled={locked} onClick={() => onReview(latest.id)}>Correct / Review latest</TDButton><TDButton size="sm" variant="secondary" disabled={locked || Boolean(blockedReason) || busy || !connected || latest.processingState === "processing"} onClick={() => void capture(false, latest.id)}>Rescan</TDButton><TDButton size="sm" variant="ghost" disabled={locked || busy} onClick={() => onRemove(latest.id)}>Remove latest</TDButton></>}
        </div>
        {message && <p role="status" className="text-sm">{message}</p>}
        {!connected && <button className="text-sm underline" onClick={onUpload}>Use Upload Instead</button>}
      </div>
    </div>
    <div className="max-h-64 overflow-auto rounded-xl border" aria-label="Scanner queue">
      <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-td-surface"><tr><th className="p-2">#</th><th>Card</th><th>Status</th><th>Review</th></tr></thead><tbody>{active.map((item, index) => <tr key={item.id} className="border-t"><td className="p-2">{index + 1}</td><td>{item.cardName || "—"}{item.duplicateOfItemId ? " · duplicate image / separate copy" : ""}</td><td>{liveScanStatus(item)}</td><td><button className="underline p-2" onClick={() => onReview(item.id)}>Inspect</button></td></tr>)}</tbody></table>
    </div>
  </section>;
}
