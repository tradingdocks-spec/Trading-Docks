/** Image acquisition only. Providers never recognize cards or write inventory. */
export type ScannerStatus = "disconnected" | "ready" | "capturing" | "jammed" | "error";
export type ScanCapabilities = { dpi: number[]; colorModes: string[]; sources: string[]; duplex: boolean; autoCrop: boolean; cancelCapture: boolean };
export type ScanSettings = { dpi: number; colorMode: string; source: string; duplex: boolean; autoCrop: boolean };
export type ScannerDevice = { id: string; name: string; simulated: boolean; manufacturer?: string; model?: string; connection?: string; backend?: string; scanCapabilities?: ScanCapabilities };
export type ScannerCapture = { captureId: string; file: File };
export type ScannerConfiguration = { delayMs?: number; scenario?: "success" | "failure" | "jam" | "duplicate" | "disconnect" | "slow"; fixtures?: File[]; settings?: ScanSettings };
export interface ScannerProvider {
  readonly capabilities: { detect: boolean; capture: boolean; cancelCapture: boolean; configure: boolean };
  detect(): Promise<ScannerDevice[]>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): ScannerStatus;
  getDeviceInfo(): ScannerDevice;
  capture(signal?: AbortSignal): Promise<ScannerCapture>;
  cancelCapture(): void;
  configure(configuration: ScannerConfiguration): void;
}

/** Development only. No device discovery, local network access or vendor SDK. */
export class EmulatorScannerProvider implements ScannerProvider {
  readonly capabilities = { detect: true, capture: true, cancelCapture: true, configure: true };
  private status: ScannerStatus = "disconnected";
  private configuration: ScannerConfiguration = { delayMs: 80, scenario: "success" };
  private sequence = 0;
  private cancel: AbortController | null = null;
  getDeviceInfo(): ScannerDevice { return { id: "development-emulator", name: "Simulated scanner — not hardware", simulated: true }; }
  async detect() { return [this.getDeviceInfo()]; }
  async connect() { this.status = "ready"; }
  async disconnect() { this.cancelCapture(); this.status = "disconnected"; }
  getStatus() { return this.status; }
  configure(configuration: ScannerConfiguration) {
    if (this.status === "capturing") throw new Error("Pause capture before changing scanner settings.");
    this.configuration = { ...this.configuration, ...configuration };
  }
  cancelCapture() { this.cancel?.abort(); }
  async capture(signal?: AbortSignal): Promise<ScannerCapture> {
    if (this.status !== "ready") throw new Error(this.status === "jammed" ? "Card jam — clear the scanner and reconnect." : "Scanner disconnected or not ready.");
    const fixtures = this.configuration.fixtures ?? [];
    if (!fixtures.length) throw new Error("Choose image fixtures in Scanner Settings first.");
    const controller = new AbortController();
    this.cancel = controller;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    this.status = "capturing";
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, this.configuration.scenario === "slow" ? 2000 : Math.max(0, Math.min(5000, this.configuration.delayMs ?? 80)));
        const cancel = () => { clearTimeout(timer); reject(new Error("Capture cancelled; batch retained.")); };
        if (controller.signal.aborted) cancel();
        else controller.signal.addEventListener("abort", cancel, { once: true });
      });
      if (this.configuration.scenario === "disconnect") { this.status = "disconnected"; throw new Error("Scanner disconnected. Captured cards remain in this batch."); }
      if (this.configuration.scenario === "jam") { this.status = "jammed"; throw new Error("Card jam — clear the scanner and reconnect."); }
      if (this.configuration.scenario === "failure") throw new Error("Scan failed. Retry or scan again; batch retained.");
      const index = this.configuration.scenario === "duplicate" ? 0 : this.sequence % fixtures.length;
      this.sequence += 1;
      return { captureId: `emulator-${this.sequence}`, file: fixtures[index] };
    } finally {
      signal?.removeEventListener("abort", abort);
      this.cancel = null;
      if (this.status === "capturing") this.status = "ready";
    }
  }
}
