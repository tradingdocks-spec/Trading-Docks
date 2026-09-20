import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { buildCanonicalCaptureMetadata, type CanonicalCaptureRequest } from "./canonical-capture";
import { createCanonicalCaptureToken } from "./canonical-capture-auth";
import { CanonicalBrowserRuntimeError, resolveCanonicalBrowserRuntime } from "./canonical-capture-runtime";

export type CanonicalCaptureErrorCode = "BROWSER_MODULE_UNAVAILABLE" | "CHROMIUM_PACK_DOWNLOAD_FAILED" | "CHROMIUM_EXECUTABLE_UNAVAILABLE" | "CHROMIUM_EXECUTABLE_MISSING" | "BROWSER_LAUNCH_FAILED" | "CAPTURE_AUTH_REJECTED" | "CAPTURE_PAGE_TIMEOUT" | "CAPTURE_PAGE_NOT_READY" | "SCREENSHOT_FAILED";
export class CanonicalCaptureError extends Error { constructor(public readonly code: CanonicalCaptureErrorCode, message: string) { super(message); this.name = "CanonicalCaptureError"; } }

function safeCaptureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown capture error.";
  return message
    .replace(/https?:\/\/\S+/gi, "[remote resource]")
    .replace(/capture_token=[^&\s]+/gi, "capture_token=[redacted]")
    .replace(/MARKETING_CAPTURE_SECRET|SUPABASE_SERVICE_ROLE_KEY/gi, "[redacted variable]")
    .slice(0, 240);
}

function logCaptureFailure(code: CanonicalCaptureErrorCode, stage: string, error?: unknown) {
  console.error("[marketing-capture]", { code, stage, message: safeCaptureMessage(error) });
}

export async function captureCanonicalPage(request: CanonicalCaptureRequest, options: { baseUrl: string; featureId: string; secret: string }) {
  let runtime;
  try { runtime = await resolveCanonicalBrowserRuntime(); } catch (error) {
    const code = error instanceof CanonicalBrowserRuntimeError ? error.code : "CHROMIUM_EXECUTABLE_UNAVAILABLE";
    logCaptureFailure(code, "runtime", error);
    throw new CanonicalCaptureError(code, error instanceof Error ? error.message : "Chromium runtime could not be resolved.");
  }
  let browser: Browser;
  try { browser = await puppeteer.launch({ args: runtime.args, defaultViewport: { width: request.width, height: request.height, deviceScaleFactor: 2 }, executablePath: runtime.executablePath, headless: runtime.headless }); } catch (error) {
    logCaptureFailure("BROWSER_LAUNCH_FAILED", "launch", error);
    throw new CanonicalCaptureError("BROWSER_LAUNCH_FAILED", `Browser launch failed: ${safeCaptureMessage(error)}`);
  }
  let page: Page | undefined;
  try {
    page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    const token = createCanonicalCaptureToken(request.feature, request.state, options.secret);
    const baseUrl = options.baseUrl.replace(/\/+$/, "");
    let response;
    try {
      response = await page.goto(`${baseUrl}/internal/marketing-capture/${encodeURIComponent(request.feature)}/${encodeURIComponent(request.state)}?capture_token=${encodeURIComponent(token)}`, { waitUntil: "networkidle0", timeout: 45_000 });
    } catch (error) {
      logCaptureFailure("CAPTURE_PAGE_TIMEOUT", "navigation", error);
      throw new CanonicalCaptureError("CAPTURE_PAGE_TIMEOUT", "Canonical capture page timed out.");
    }
    if (response && response.status() >= 400) {
      logCaptureFailure("CAPTURE_AUTH_REJECTED", "response", response.status());
      throw new CanonicalCaptureError("CAPTURE_AUTH_REJECTED", `Canonical capture authorization failed (${response.status()}).`);
    }
    await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
    await page.waitForSelector("[data-marketing-capture-ready=\"true\"]", { timeout: 15_000 }).catch(() => { throw new CanonicalCaptureError("CAPTURE_PAGE_NOT_READY", "Canonical capture page was not ready."); });
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => { image.addEventListener("load", () => resolve(), { once: true }); image.addEventListener("error", () => resolve(), { once: true }); }))); });
    await new Promise((resolve) => setTimeout(resolve, 250));
    const png = await page.screenshot({ type: "png", fullPage: true }).catch((error) => {
      logCaptureFailure("SCREENSHOT_FAILED", "screenshot", error);
      throw new CanonicalCaptureError("SCREENSHOT_FAILED", "Canonical product capture screenshot failed.");
    });
    return { png, metadata: buildCanonicalCaptureMetadata(request, options.featureId) };
  } finally {
    if (page) await page.close().catch(() => undefined);
    await browser.close();
  }
}
