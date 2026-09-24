import type { ScannerProvider, ScannerDevice, ScannerStatus, ScannerConfiguration, ScanSettings, ScanCapabilities, ScannerSession } from "./scanner-provider.ts";

export const BRIDGE_URL = "https://127.0.0.1:47391";
export const BRIDGE_PROTOCOL = 1;
type PendingRequest = { requestId: string; deviceId: string; settings: ScanSettings; requestedAt: number; sessionId?: string; preview?: boolean; binding?: { userId: string; workspaceId: string; batchId: string; workstationId: string; sessionId: string; destinationId: string } };
type Credential = { privateKey: CryptoKey; publicKey: string; credentialId?: string; expires?: string; workstationId?: string; selectedDevice?: string; liveSession?: ScannerSession; pendingRequest?: PendingRequest; cloudAcknowledged?: string };
type BridgeDevice = { id: string; displayName: string; manufacturer: string; model: string; connection: string; backend: string; capabilities: ScanCapabilities };
export type BridgeStorage = { get(): Promise<Credential | undefined>; set(value: Credential): Promise<void>; clear(): Promise<void> };
const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, "0")).join("");
const base64 = (buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));

// Structured-cloned, non-extractable CryptoKey: no bearer secret in localStorage.
export function workstationStorage(): BridgeStorage {
  async function db() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("td-scanner-bridge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("trust");
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  }
  async function action<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    const database = await db();
    try { return await new Promise<T>((resolve, reject) => { const transaction = database.transaction("trust", mode); const request = operation(transaction.objectStore("trust")); transaction.oncomplete = () => resolve(request.result as T); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); }); }
    finally { database.close(); }
  }
  return { get: () => action("readonly", store => store.get("workstation")), set: value => action("readwrite", store => store.put(value, "workstation")), clear: () => action("readwrite", store => store.delete("workstation")) };
}

const messages: Record<string, string> = {
  DEVICE_OFFLINE: "Scanner disconnected. Reconnect it or choose another device.", DEVICE_BUSY: "Scanner is busy. Wait for the current scan to finish.",
  PAPER_JAM: "Paper/card jam. Clear the scanner before trying again.", NO_MEDIA: "No card detected. Load a card and try again.",
  CAPTURE_INTERRUPTED: "We found an unfinished scan. The agent stopped before confirming acquisition. Resume to retry recovery, or discard this local attempt before scanning again.",
  RECOVERY_STORAGE_FAILED: "Unable to save the scan safely. Free disk space and resume; do not scan another card.",
  CAPTURE_FAILED: "Scan failed. Check the scanner and retry.", UNSUPPORTED_SETTING: "The scanner does not support this setting.",
  BRIDGE_DISCONNECTED: "Scanner Bridge is not reachable. Start it, check local-network permission and retry. Do not bypass HTTPS warnings.",
  UNPAIRED_OR_EXPIRED: "Workstation pairing expired or was revoked. Pair this workstation again.", INVALID_PROOF: "Workstation authentication failed. Unpair and pair again.",
  PAIR_EXPIRED_OR_INVALID: "Pairing code expired or is incorrect. Start pairing again.", PAIR_REJECTED: "Pairing was declined or already used.",
  RATE_LIMITED: "Scanner Bridge is receiving too many requests. Pause and retry shortly.", UPDATE_REQUIRED: "Scanner Bridge update required.",
};
export class ScannerBridgeError extends Error { readonly code: string; constructor(code: string) { super(messages[code] ?? code.replaceAll("_", " ")); this.code = code; } }
export function defaultScanSettings(caps: ScanCapabilities, highQuality = false): ScanSettings {
  const sorted = [...caps.dpi].sort((a, b) => a - b);
  return { dpi: highQuality ? sorted.at(-1)! : sorted.includes(300) ? 300 : sorted[0], colorMode: caps.colorModes.includes("color") ? "color" : caps.colorModes[0], source: caps.sources.includes("feeder") ? "feeder" : caps.sources[0], duplex: false, autoCrop: caps.autoCrop };
}
export class TradingDocksLocalScannerProvider implements ScannerProvider {
  readonly capabilities = { detect: true, capture: true, cancelCapture: true, configure: true };
  private status: ScannerStatus = "disconnected";
  private credential?: Credential;
  private device?: ScannerDevice;
  private settings?: ScanSettings;
  private activeCapture?: string;
  private cancelled = false;
  private pairing?: { id: string; challenge: string };
  private pendingAck?: string;
  private pendingRequest?: PendingRequest;
  private session?: ScannerSession;
  private durableRecovery = false;
  private captureAuthorization = false;
  private capturePermit?: string;
  private readonly storage: BridgeStorage;
  private readonly request: typeof fetch;
  constructor(storage: BridgeStorage = workstationStorage(), request: typeof fetch = (...args) => fetch(...args)) { this.storage = storage; this.request = request; }
  private async call<T>(path: string, data?: unknown, publicRequest = false): Promise<T> {
    const body = data === undefined ? "" : JSON.stringify(data);
    const method = data === undefined ? "GET" : "POST";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!publicRequest) {
      this.credential ??= await this.storage.get();
      if (!this.credential?.credentialId || !(Date.parse(this.credential.expires ?? "") > Date.now())) throw new ScannerBridgeError("UNPAIRED_OR_EXPIRED");
      const timestamp = String(Date.now()); const nonce = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
      const digest = hex(await crypto.subtle.digest("SHA-256", encoder.encode(body)));
      const proof = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, this.credential.privateKey, encoder.encode(`${method}\n${path}\n${timestamp}\n${nonce}\n${digest}`));
      Object.assign(headers, { "X-TD-Credential": this.credential.credentialId, "X-TD-Timestamp": timestamp, "X-TD-Nonce": nonce, "X-TD-Proof": base64(proof) });
    }
    let response: Response;
    try { response = await this.request(BRIDGE_URL + path, { method, headers, body: body || undefined, credentials: "omit", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(path === "/v1/pair/start" ? 125_000 : 15_000) }); }
    catch { this.status = "disconnected"; throw new ScannerBridgeError("BRIDGE_DISCONNECTED"); }
    const result = await response.json();
    if (!response.ok) throw new ScannerBridgeError(String(result.error ?? "CAPTURE_FAILED"));
    return result as T;
  }
  async health() {
    const result = await this.call<{ running: boolean; protocolVersion: number; bridgeVersion: string; automaticInbox?: boolean; durableRecovery?: boolean; captureAuthorization?: boolean; recoveryError?: string }>("/v1/health", undefined, true);
    if (result.protocolVersion !== BRIDGE_PROTOCOL) throw new ScannerBridgeError("UPDATE_REQUIRED");
    if (result.recoveryError) throw new Error("Scanner recovery needs attention. Local scans are preserved; open Scanner Settings before continuing.");
    this.durableRecovery = result.durableRecovery === true;
    this.captureAuthorization = result.captureAuthorization === true;
    return result;
  }
  async paired() { this.credential ??= await this.storage.get(); return Boolean(this.credential?.credentialId && Date.parse(this.credential.expires ?? "") > Date.now()); }
  async startPairing() {
    if (await this.hasPendingCapture()) throw new Error("Unfinished scans still belong to this computer. Recover them before replacing pairing.");
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
    this.credential = { privateKey: pair.privateKey, publicKey: base64(await crypto.subtle.exportKey("spki", pair.publicKey)) };
    const challenge = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
    const result = await this.call<{ id: string }>("/v1/pair/start", { challenge, publicKey: this.credential.publicKey }, true);
    this.pairing = { id: result.id, challenge };
  }
  async finishPairing(code: string) {
    if (!this.pairing || !this.credential) throw new ScannerBridgeError("PAIR_EXPIRED_OR_INVALID");
    const result = await this.call<{ credentialId: string; expires: string; workstationId: string }>("/v1/pair/finish", { ...this.pairing, code: code.replaceAll(" ", "") }, true);
    this.credential = { ...this.credential, ...result }; await this.storage.set(this.credential); this.pairing = undefined;
  }
  async unpair() { if (await this.hasPendingCapture()) throw new Error("Resume or explicitly discard the unfinished scan before forgetting this computer."); try { await this.call("/v1/unpair", {}); } finally { await this.storage.clear(); this.credential = undefined; await this.disconnect(); } }
  async detect() {
    if (this.durableRecovery && await this.paired()) {
      const renewed = await this.call<{ expires: string }>("/v2/pair/renew", {});
      this.credential!.expires = renewed.expires; await this.storage.set(this.credential!);
    }
    const result = await this.call<{ devices: BridgeDevice[] }>("/v1/devices");
    return result.devices.map(d => ({ id: d.id, name: d.displayName, simulated: false, manufacturer: d.manufacturer, model: d.model, connection: d.connection, backend: d.backend, scanCapabilities: d.capabilities }));
  }
  async rememberedDevice() { this.credential ??= await this.storage.get(); return this.credential?.selectedDevice; }
  async getWorkstationId() { this.credential ??= await this.storage.get(); if (!this.credential?.workstationId) throw new ScannerBridgeError("UNPAIRED_OR_EXPIRED"); return this.credential.workstationId; }
  private async authorizeCapture(captureId: string, purpose: "capture" | "ack" = "capture") {
    if (!this.captureAuthorization) return undefined;
    const session = this.session ?? this.credential?.liveSession;
    if (!session) throw new Error("Open the original cloud batch before resuming this scan.");
    const response = await fetch("/api/chaos-sort/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "authorize-capture", payload: { batchId: session.batchId, workstationId: session.workstationId, deviceId: session.deviceId, captureId, purpose: session.preview ? "preview" : purpose, previewSessionId: session.preview ? session.id : undefined } }), cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.authorization) throw new Error(result.error ?? "Cloud capture authorization unavailable.");
    return result.authorization as string;
  }
  async startSession(session: ScannerSession) {
    this.credential ??= await this.storage.get();
    if (!this.credential) throw new ScannerBridgeError("UNPAIRED_OR_EXPIRED");
    // Persisted only after the application durably accepted this capture. A lost
    // local ACK response must never replay a card or strand the next batch.
    if (this.credential.cloudAcknowledged) {
      await this.call(`/v1/capture/${this.credential.cloudAcknowledged}/ack`, { authorization: await this.authorizeCapture(this.credential.cloudAcknowledged, "ack") });
      this.credential.cloudAcknowledged = undefined; this.credential.pendingRequest = undefined;
      await this.storage.set(this.credential);
    }
    if (this.credential.pendingRequest && (this.credential.liveSession?.userId !== session.userId || (this.credential.liveSession?.id !== session.id && !this.credential.liveSession?.preview) || this.credential.liveSession?.workspaceId !== session.workspaceId || this.credential.liveSession?.batchId !== session.batchId || this.credential.liveSession?.deviceId !== session.deviceId || this.credential.liveSession?.workstationId !== session.workstationId || this.credential.liveSession?.destinationId !== session.destinationId)) throw new Error("We found an unfinished scan in another batch or workspace. Open its original batch to resume; it has not been uploaded here.");
    // A recovered Test Scan remains a preview, never a live batch capture.
    if (this.credential.pendingRequest && this.credential.liveSession?.preview) session = this.credential.liveSession;
    if (this.device?.backend === "SCANSNAP") {
      if (!(await this.health()).automaticInbox) throw new ScannerBridgeError("UPDATE_REQUIRED");
      await this.call("/v2/session", session);
    }
    this.session = session; this.pendingRequest = this.credential.pendingRequest;
    this.credential.liveSession = session; await this.storage.set(this.credential);
  }
  async pauseSession() { if (this.session && this.device?.backend === "SCANSNAP") await this.call(`/v2/session/${this.session.id}/pause`, {}); }
  async acknowledge(captureId: string) {
    if (!this.session) return;
    if (this.credential) { this.credential.cloudAcknowledged = captureId; await this.storage.set(this.credential); }
    await this.call(`/v1/capture/${captureId}/ack`, { authorization: await this.authorizeCapture(captureId, "ack") });
    this.pendingAck = undefined; this.pendingRequest = undefined;
    if (this.credential) { this.credential.pendingRequest = undefined; this.credential.cloudAcknowledged = undefined; await this.storage.set(this.credential); }
  }
  async hasPendingCapture() { this.credential ??= await this.storage.get(); return Boolean(this.credential?.pendingRequest || this.credential?.cloudAcknowledged); }
  async discardPendingCapture() {
    this.credential ??= await this.storage.get();
    const request = this.credential?.pendingRequest;
    if (!request || !this.durableRecovery || this.credential?.cloudAcknowledged) throw new Error("Resume cloud acknowledgement before discarding this scan.");
    const started = await this.call<{ captureId: string }>("/v1/capture", { ...request, authorization: await this.authorizeCapture(request.requestId) });
    await this.call(`/v2/capture/${started.captureId}/discard`, { authorization: await this.authorizeCapture(request.requestId) });
    this.pendingRequest = undefined; this.credential!.pendingRequest = undefined; await this.storage.set(this.credential!);
  }
  async recoverPendingCapture() {
    this.credential ??= await this.storage.get();
    this.pendingRequest ??= this.credential?.pendingRequest;
    if (!this.pendingRequest) return null;
    const preview = this.pendingRequest.preview === true;
    return { ...await this.capture(), preview };
  }
  async selectDevice(device: ScannerDevice) { this.device = device; this.settings = defaultScanSettings(device.scanCapabilities!); this.credential ??= await this.storage.get(); if (this.credential) { this.credential.selectedDevice = device.id; await this.storage.set(this.credential); } }
  async connect() { await this.health(); await this.call("/v1/status"); if (!this.device) throw new ScannerBridgeError("DEVICE_OFFLINE"); this.status = "ready"; }
  async disconnect() { this.cancelCapture(); this.status = "disconnected"; }
  getStatus() { return this.status; }
  getDeviceInfo() { if (!this.device) throw new ScannerBridgeError("DEVICE_OFFLINE"); return this.device; }
  configure(configuration: ScannerConfiguration) {
    if (this.status === "capturing") throw new ScannerBridgeError("DEVICE_BUSY");
    if (!configuration.settings || !this.device?.scanCapabilities) return;
    const s = configuration.settings, c = this.device.scanCapabilities;
    if (!c.dpi.includes(s.dpi) || !c.colorModes.includes(s.colorMode) || !c.sources.includes(s.source) || s.duplex && !c.duplex || s.autoCrop && !c.autoCrop) throw new ScannerBridgeError("UNSUPPORTED_SETTING");
    this.settings = s;
  }
  cancelCapture() { this.cancelled = true; if (this.activeCapture) void this.call(`/v1/capture/${this.activeCapture}/cancel`, {}).catch(() => { this.status = "disconnected"; }); }
  async capture(signal?: AbortSignal) {
    if (this.status !== "ready" || !this.device || !this.settings) throw new ScannerBridgeError("DEVICE_OFFLINE");
    this.cancelled = Boolean(signal?.aborted); this.status = "capturing";
    const abort = () => this.cancelCapture(); signal?.addEventListener("abort", abort, { once: true });
    try {
      if (this.cancelled) throw new Error("Capture cancelled; batch retained.");
      if (this.pendingAck && !this.session) {
        try { await this.call(`/v1/capture/${this.pendingAck}/ack`, {}); }
        catch (error) { if (!(error instanceof ScannerBridgeError) || !["CAPTURE_NOT_FOUND", "CAPTURE_NOT_READY"].includes(error.code)) throw error; }
        this.pendingAck = undefined;
      }
      this.pendingRequest ??= { requestId: crypto.randomUUID(), deviceId: this.device.id, settings: this.settings, requestedAt: Date.now(), ...(this.session && this.device.backend === "SCANSNAP" ? { sessionId: this.session.id } : {}), ...(this.session?.userId ? { preview: this.session.preview === true, binding: { userId: this.session.userId, workspaceId: this.session.workspaceId, batchId: this.session.batchId, workstationId: this.session.workstationId, sessionId: this.session.id, destinationId: this.session.destinationId } } : {}) };
      if (this.session && this.credential) { this.credential.pendingRequest = this.pendingRequest; await this.storage.set(this.credential); }
      this.capturePermit = await this.authorizeCapture(this.pendingRequest.requestId);
      const started = await this.call<{ captureId: string }>("/v1/capture", { ...this.pendingRequest, ...(this.capturePermit ? { authorization: this.capturePermit } : {}) });
      this.activeCapture = started.captureId;
      const deadline = Date.now() + 95_000;
      while (Date.now() < deadline) {
        if (this.cancelled) { await this.call(`/v1/capture/${started.captureId}/cancel`, {}); throw new Error("Capture cancelled; batch retained."); }
        const result = await this.call<{ status: string; error?: string; image?: string; mimeType: string; width: number; height: number }>(this.captureAuthorization ? `/v2/capture/${started.captureId}/read` : `/v1/capture/${started.captureId}`, this.captureAuthorization ? { authorization: this.capturePermit } : undefined);
        if (this.cancelled) { await this.call(`/v1/capture/${started.captureId}/cancel`, {}); this.pendingRequest = undefined; throw new Error("Capture cancelled; batch retained."); }
        if (result.status === "ready") {
          if (!result.image || result.image.length > 12_000_000 || !["image/jpeg", "image/png"].includes(result.mimeType) || result.width > 3000 || result.height > 3000) throw new ScannerBridgeError("IMAGE_LIMIT_EXCEEDED");
          const bytes = Uint8Array.from(atob(result.image), ch => ch.charCodeAt(0));
          if (bytes.length > 8 * 1024 * 1024) throw new ScannerBridgeError("IMAGE_LIMIT_EXCEEDED");
          const file = new File([bytes], `${started.captureId}.${result.mimeType === "image/png" ? "png" : "jpg"}`, { type: result.mimeType });
          this.pendingAck = started.captureId;
          // Once received, deliver exactly once even if the acknowledgement response is lost.
          if (!this.session) { try { await this.call(`/v1/capture/${started.captureId}/ack`, {}); this.pendingAck = undefined; } catch { /* Retry acknowledgement before any next capture. */ } this.pendingRequest = undefined; }
          return { captureId: started.captureId, file };
        }
        if (result.status === "interrupted") throw new ScannerBridgeError(result.error ?? "CAPTURE_INTERRUPTED");
        if (result.status !== "capturing") { this.pendingRequest = undefined; if (this.credential) { this.credential.pendingRequest = undefined; await this.storage.set(this.credential); } throw new ScannerBridgeError(result.error ?? "CAPTURE_FAILED"); }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      this.cancelCapture(); throw new ScannerBridgeError("CAPTURE_FAILED");
    } catch (error) {
      if (this.cancelled || error instanceof ScannerBridgeError && error.code === "CAPTURE_REQUEST_EXPIRED") this.pendingRequest = undefined;
      throw error;
    } finally { this.activeCapture = undefined; if (this.status === "capturing") this.status = "ready"; signal?.removeEventListener("abort", abort); }
  }
}
