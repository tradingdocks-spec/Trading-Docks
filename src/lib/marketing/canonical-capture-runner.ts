import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { buildCanonicalCaptureMetadata, type CanonicalCaptureRequest } from "./canonical-capture";
import { createCanonicalCaptureToken } from "./canonical-capture-auth";
import { CanonicalBrowserRuntimeError, resolveCanonicalBrowserRuntime } from "./canonical-capture-runtime";

export type CanonicalCaptureErrorCode = "BROWSER_MODULE_UNAVAILABLE" | "CHROMIUM_PACK_DOWNLOAD_FAILED" | "CHROMIUM_EXECUTABLE_UNAVAILABLE" | "CHROMIUM_EXECUTABLE_MISSING" | "BROWSER_LAUNCH_FAILED" | "CAPTURE_AUTH_REJECTED" | "CAPTURE_PAGE_TIMEOUT" | "CAPTURE_PAGE_NOT_READY" | "CAPTURE_DEPLOYMENT_PROTECTION_BLOCKED" | "TRUSTED_SOURCE_TOKEN_UNAVAILABLE" | "TRUSTED_SOURCE_REJECTED" | "SCREENSHOT_FAILED";
export class CanonicalCaptureError extends Error { constructor(public readonly code: CanonicalCaptureErrorCode, message: string) { super(message); this.name = "CanonicalCaptureError"; } }

function safeCaptureMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : JSON.stringify(error) ?? "Unknown capture error.";
  return message
    .replace(/https?:\/\/\S+/gi, "[remote resource]")
    .replace(/capture_token=[^&\s]+/gi, "capture_token=[redacted]")
    .replace(/MARKETING_CAPTURE_SECRET|SUPABASE_SERVICE_ROLE_KEY/gi, "[redacted variable]")
    .slice(0, 240);
}

function logCaptureFailure(code: CanonicalCaptureErrorCode, stage: string, error?: unknown) {
  console.error("[marketing-capture]", { code, stage, message: safeCaptureMessage(error) });
}

function safePageDiagnostic(value: unknown) {
  return String(value ?? "")
    .replace(/https?:\/\/\S+/gi, "[remote resource]")
    .replace(/capture_token=[^&\s]+/gi, "capture_token=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function isDeploymentProtectionPage(finalUrl: string, bodyText: string) {
  return /vercel\.com\/(?:login|protect|auth)/i.test(finalUrl)
    || /(?:deployment protection|log in to vercel|sign in to vercel|authentication required|sign in is required)/i.test(bodyText);
}

function targetRequiresTrustedSource(baseUrl: string) {
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "preview") return false;
  try { return new URL(baseUrl).hostname.endsWith(".vercel.app"); } catch { return false; }
}

export async function captureCanonicalPage(request: CanonicalCaptureRequest, options: { baseUrl: string; featureId: string; secret: string; trustedSourceToken?: string }) {
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
    const requiresTrustedSource = targetRequiresTrustedSource(baseUrl);
    if (requiresTrustedSource && !options.trustedSourceToken) {
      throw new CanonicalCaptureError("TRUSTED_SOURCE_TOKEN_UNAVAILABLE", "Vercel Trusted Source authorization is unavailable for this Preview capture.");
    }
    if (requiresTrustedSource && options.trustedSourceToken) {
      await page.setExtraHTTPHeaders({ "x-vercel-trusted-oidc-idp-token": options.trustedSourceToken });
    }
    let response;
    try {
      response = await page.goto(`${baseUrl}/internal/marketing-capture/${encodeURIComponent(request.feature)}/${encodeURIComponent(request.state)}?capture_token=${encodeURIComponent(token)}`, { waitUntil: "networkidle0", timeout: 45_000 });
    } catch (error) {
      logCaptureFailure("CAPTURE_PAGE_TIMEOUT", "navigation", error);
      throw new CanonicalCaptureError("CAPTURE_PAGE_TIMEOUT", "Canonical capture page timed out.");
    }
    const responseStatus = response?.status() ?? null;
    const finalUrl = page.url();
    const expectedHost = new URL(baseUrl).hostname;
    const pageDiagnostic = await page.evaluate(() => ({
      title: document.title,
      bodyPrefix: document.body?.innerText ?? "",
      hasReadyMarker: Boolean(document.querySelector('[data-marketing-capture-ready="true"]')),
      heading: document.querySelector("h1")?.textContent ?? "",
    })).catch(() => ({ title: "", bodyPrefix: "", hasReadyMarker: false, heading: "" }));
    const bodyText = safePageDiagnostic(pageDiagnostic.bodyPrefix);
    if (isDeploymentProtectionPage(finalUrl, bodyText)) {
      const protectionCode = requiresTrustedSource && options.trustedSourceToken ? "TRUSTED_SOURCE_REJECTED" : "CAPTURE_DEPLOYMENT_PROTECTION_BLOCKED";
      logCaptureFailure(protectionCode, "response", { responseStatus, finalUrl: safePageDiagnostic(finalUrl), title: safePageDiagnostic(pageDiagnostic.title), bodyPrefix: bodyText, hasReadyMarker: pageDiagnostic.hasReadyMarker });
      throw new CanonicalCaptureError(protectionCode, protectionCode === "TRUSTED_SOURCE_REJECTED" ? "Vercel rejected the Trusted Source authorization for this Preview capture." : "Canonical capture was blocked by Vercel deployment protection or authentication.");
    }
    if (new URL(finalUrl).hostname !== expectedHost) {
      const protectionCode = requiresTrustedSource && options.trustedSourceToken ? "TRUSTED_SOURCE_REJECTED" : "CAPTURE_DEPLOYMENT_PROTECTION_BLOCKED";
      logCaptureFailure(protectionCode, "response", { responseStatus, finalUrl: safePageDiagnostic(finalUrl), expectedHost, title: safePageDiagnostic(pageDiagnostic.title), bodyPrefix: bodyText, hasReadyMarker: pageDiagnostic.hasReadyMarker });
      throw new CanonicalCaptureError(protectionCode, protectionCode === "TRUSTED_SOURCE_REJECTED" ? "Vercel rejected the Trusted Source authorization for this Preview capture." : "Canonical capture reached an unexpected host instead of the configured capture deployment.");
    }
    if (responseStatus !== null && responseStatus >= 400) {
      logCaptureFailure("CAPTURE_AUTH_REJECTED", "response", { responseStatus, title: safePageDiagnostic(pageDiagnostic.title), bodyPrefix: bodyText, hasReadyMarker: pageDiagnostic.hasReadyMarker });
      throw new CanonicalCaptureError("CAPTURE_AUTH_REJECTED", `Canonical capture authorization failed (${responseStatus}).`);
    }
    if (!pageDiagnostic.heading || !pageDiagnostic.heading.toLowerCase().includes(request.feature.replaceAll("-", " ").toLowerCase())) {
      logCaptureFailure("CAPTURE_PAGE_NOT_READY", "page-content", { responseStatus, title: safePageDiagnostic(pageDiagnostic.title), bodyPrefix: bodyText, hasReadyMarker: pageDiagnostic.hasReadyMarker });
    }
    await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
    await page.waitForSelector("[data-marketing-capture-ready=\"true\"]", { timeout: 15_000 }).catch(() => {
      logCaptureFailure("CAPTURE_PAGE_NOT_READY", "ready-marker", { responseStatus, finalUrl: safePageDiagnostic(finalUrl), title: safePageDiagnostic(pageDiagnostic.title), bodyPrefix: bodyText, hasReadyMarker: pageDiagnostic.hasReadyMarker });
      throw new CanonicalCaptureError("CAPTURE_PAGE_NOT_READY", "Canonical capture page loaded but ready marker was not found.");
    });
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
