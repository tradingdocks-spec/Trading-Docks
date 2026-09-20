import { chromium } from "@playwright/test";
import { buildCanonicalCaptureMetadata, type CanonicalCaptureRequest } from "./canonical-capture";

export async function captureCanonicalPage(request: CanonicalCaptureRequest, options: { baseUrl: string; featureId: string; storageState?: string }) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      storageState: options.storageState,
      deviceScaleFactor: 2,
      viewport: { width: request.width, height: request.height },
    });
    const page = await context.newPage();
    await page.goto(`${options.baseUrl}/internal/marketing-capture/${encodeURIComponent(request.feature)}/${encodeURIComponent(request.state)}`, { waitUntil: "networkidle" });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.waitForTimeout(250);
    const png = await page.screenshot({ type: "png", fullPage: true });
    await context.close();
    return { png, metadata: buildCanonicalCaptureMetadata(request, options.featureId) };
  } finally {
    await browser.close();
  }
}
