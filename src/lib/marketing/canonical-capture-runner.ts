import puppeteer from "puppeteer-core";
import { buildCanonicalCaptureMetadata, type CanonicalCaptureRequest } from "./canonical-capture";
import { createCanonicalCaptureToken } from "./canonical-capture-auth";
import { resolveCanonicalBrowserRuntime } from "./canonical-capture-runtime";

export type CanonicalCaptureErrorCode = "BROWSER_MODULE_UNAVAILABLE" | "CHROMIUM_EXECUTABLE_UNAVAILABLE" | "BROWSER_LAUNCH_FAILED" | "CAPTURE_AUTH_REJECTED" | "CAPTURE_PAGE_TIMEOUT" | "CAPTURE_PAGE_NOT_READY" | "SCREENSHOT_FAILED";
export class CanonicalCaptureError extends Error { constructor(public readonly code: CanonicalCaptureErrorCode, message: string) { super(message); this.name = "CanonicalCaptureError"; } }

export async function captureCanonicalPage(request: CanonicalCaptureRequest, options: { baseUrl: string; featureId: string; secret: string }) {
  let runtime;
  try { runtime = await resolveCanonicalBrowserRuntime(); } catch {
    console.error("[marketing-capture]", { code: "CHROMIUM_EXECUTABLE_UNAVAILABLE", stage: "runtime" });
    throw new CanonicalCaptureError("CHROMIUM_EXECUTABLE_UNAVAILABLE", "Canonical product capture is unavailable in this deployment environment.");
  }
  let browser;
  try { browser = await puppeteer.launch({ args: runtime.args, defaultViewport: { width: request.width, height: request.height, deviceScaleFactor: 2 }, executablePath: runtime.executablePath, headless: runtime.headless }); } catch {
    console.error("[marketing-capture]", { code: "BROWSER_LAUNCH_FAILED", stage: "launch" });
    throw new CanonicalCaptureError("BROWSER_LAUNCH_FAILED", "Canonical product capture is unavailable in this deployment environment.");
  }
  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const token = createCanonicalCaptureToken(request.feature, request.state, options.secret);
    const baseUrl = options.baseUrl.replace(/\/+$/, "");
    let response;
    try {
      response = await page.goto(`${baseUrl}/internal/marketing-capture/${encodeURIComponent(request.feature)}/${encodeURIComponent(request.state)}?capture_token=${encodeURIComponent(token)}`, { waitUntil: "networkidle0", timeout: 45_000 });
    } catch {
      console.error("[marketing-capture]", { code: "CAPTURE_PAGE_TIMEOUT", stage: "navigation" });
      throw new CanonicalCaptureError("CAPTURE_PAGE_TIMEOUT", "Canonical capture page timed out.");
    }
    if (response && response.status() >= 400) throw new CanonicalCaptureError("CAPTURE_AUTH_REJECTED", "Canonical capture authorization failed.");
    await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
    await page.waitForSelector("[data-marketing-capture-ready=\"true\"]", { timeout: 15_000 }).catch(() => { throw new CanonicalCaptureError("CAPTURE_PAGE_NOT_READY", "Canonical capture page was not ready."); });
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => { image.addEventListener("load", () => resolve(), { once: true }); image.addEventListener("error", () => resolve(), { once: true }); }))); });
    await new Promise((resolve) => setTimeout(resolve, 250));
    const png = await page.screenshot({ type: "png", fullPage: true }).catch(() => { throw new CanonicalCaptureError("SCREENSHOT_FAILED", "Canonical product capture screenshot failed."); });
    await context.close();
    return { png, metadata: buildCanonicalCaptureMetadata(request, options.featureId) };
  } finally {
    await browser.close();
  }
}
