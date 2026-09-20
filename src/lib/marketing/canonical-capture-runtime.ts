import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { existsSync, statSync } from "node:fs";

export type CanonicalBrowserRuntimeErrorCode =
  | "BROWSER_MODULE_UNAVAILABLE"
  | "CHROMIUM_PACK_DOWNLOAD_FAILED"
  | "CHROMIUM_EXECUTABLE_UNAVAILABLE"
  | "CHROMIUM_EXECUTABLE_MISSING"
  | "BROWSER_LAUNCH_FAILED"
  | "SCREENSHOT_FAILED";

export class CanonicalBrowserRuntimeError extends Error {
  constructor(public readonly code: CanonicalBrowserRuntimeErrorCode, message: string) {
    super(message);
    this.name = "CanonicalBrowserRuntimeError";
  }
}

export type CanonicalBrowserRuntime = {
  kind: "local" | "vercel";
  executablePath: string;
  args: string[];
  headless: "shell" | true;
  resolutionMs: number;
};

function safeRuntimeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown Chromium runtime error.";
  return message
    .replace(/https?:\/\/\S+/gi, "[remote resource]")
    .replace(/MARKETING_CAPTURE_SECRET|SUPABASE_SERVICE_ROLE_KEY|MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY/gi, "[redacted variable]")
    .slice(0, 240);
}

function assertExecutable(executablePath: string) {
  if (!existsSync(executablePath)) {
    throw new CanonicalBrowserRuntimeError("CHROMIUM_EXECUTABLE_MISSING", "Chromium executable was not found after resolution.");
  }
  try {
    if (!statSync(executablePath).isFile()) {
      throw new CanonicalBrowserRuntimeError("CHROMIUM_EXECUTABLE_MISSING", "Chromium executable path is not a file.");
    }
  } catch (error) {
    if (error instanceof CanonicalBrowserRuntimeError) throw error;
    throw new CanonicalBrowserRuntimeError("CHROMIUM_EXECUTABLE_MISSING", "Chromium executable could not be inspected.");
  }
}

export async function resolveCanonicalBrowserRuntime(env: NodeJS.ProcessEnv = process.env): Promise<CanonicalBrowserRuntime> {
  const startedAt = Date.now();
  const localExecutable = env.PUPPETEER_EXECUTABLE_PATH ?? env.CHROME_BIN;
  if (localExecutable && env.VERCEL !== "1") {
    assertExecutable(localExecutable);
    return { kind: "local", executablePath: localExecutable, args: [], headless: true, resolutionMs: Date.now() - startedAt };
  }
  if (env.VERCEL !== "1" && env.NODE_ENV !== "production") {
    throw new CanonicalBrowserRuntimeError("CHROMIUM_EXECUTABLE_UNAVAILABLE", "Local capture requires PUPPETEER_EXECUTABLE_PATH or CHROME_BIN.");
  }

  let executablePath: string;
  try {
    executablePath = await chromium.executablePath();
  } catch (error) {
    throw new CanonicalBrowserRuntimeError("CHROMIUM_PACK_DOWNLOAD_FAILED", `Chromium runtime resolution failed: ${safeRuntimeMessage(error)}`);
  }
  if (!executablePath) {
    throw new CanonicalBrowserRuntimeError("CHROMIUM_EXECUTABLE_UNAVAILABLE", "Chromium executable path was not resolved.");
  }
  assertExecutable(executablePath);
  return {
    kind: "vercel",
    executablePath,
    args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
    headless: "shell",
    resolutionMs: Date.now() - startedAt,
  };
}

export function chromiumPackConfiguration(env: NodeJS.ProcessEnv = process.env) {
  return {
    package: "@sparticuz/chromium",
    packUrlConfigured: Boolean(env.MARKETING_CHROMIUM_PACK_URL),
  };
}

export async function runCanonicalBrowserSelfTest() {
  const runtime = await resolveCanonicalBrowserRuntime();
  const startedAt = Date.now();
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    try {
      browser = await puppeteer.launch({
        args: runtime.args,
        defaultViewport: { width: 320, height: 240, deviceScaleFactor: 1 },
        executablePath: runtime.executablePath,
        headless: runtime.headless,
      });
    } catch (error) {
      throw new CanonicalBrowserRuntimeError("BROWSER_LAUNCH_FAILED", `Browser launch failed: ${safeRuntimeMessage(error)}`);
    }
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body><main data-self-test-ready=\"true\">Trading Docks browser self-test</main></body></html>");
    const png = await page.screenshot({ type: "png" }).catch((error) => {
      throw new CanonicalBrowserRuntimeError("SCREENSHOT_FAILED", `Browser self-test screenshot failed: ${safeRuntimeMessage(error)}`);
    });
    return { durationMs: Date.now() - startedAt, pngBytes: png.length, executablePath: runtime.executablePath, resolutionMs: runtime.resolutionMs };
  } finally {
    await browser?.close();
  }
}
