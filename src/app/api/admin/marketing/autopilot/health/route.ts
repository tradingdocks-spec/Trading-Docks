import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { validateCanonicalCaptureRequest } from "@/lib/marketing/canonical-capture";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type StageStatus = { status: "ready" | "error" | "not_run"; code?: string; message?: string };

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown diagnostic error.";
  return message
    .replace(/https?:\/\/\S+/gi, "[remote resource]")
    .replace(/capture_token=[^&\s]+/gi, "capture_token=[redacted]")
    .replace(/MARKETING_CAPTURE_SECRET|SUPABASE_SERVICE_ROLE_KEY|MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY/gi, "[redacted variable]")
    .slice(0, 240);
}

function diagnosticError(error: unknown, fallbackCode: string): StageStatus {
  const candidate = error as { code?: unknown } | null;
  return {
    status: "error",
    code: typeof candidate?.code === "string" ? candidate.code : fallbackCode,
    message: safeMessage(error),
  };
}

function previewRequiresTrustedSource(baseUrl: string | undefined) {
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "preview" || !baseUrl) return false;
  try { return new URL(baseUrl).hostname.endsWith(".vercel.app"); } catch { return false; }
}

async function runBrowserDiagnostic() {
  let puppeteerReady = true;
  let chromiumReady = true;
  let moduleError: unknown = null;
  try {
    await import("puppeteer-core");
  } catch (error) {
    puppeteerReady = false;
    moduleError = error;
  }
  try {
    await import("@sparticuz/chromium");
  } catch (error) {
    chromiumReady = false;
    moduleError ??= error;
  }
  if (moduleError) {
    return {
      browserModules: {
        puppeteerCore: puppeteerReady ? { status: "ready" as const } : diagnosticError(moduleError, "BROWSER_MODULE_UNAVAILABLE"),
        sparticuzChromium: chromiumReady ? { status: "ready" as const } : diagnosticError(moduleError, "BROWSER_MODULE_UNAVAILABLE"),
      },
      chromium: { packUrlConfigured: Boolean(process.env.MARKETING_CHROMIUM_PACK_URL), executableResolved: false, executablePathExists: false, resolutionMs: null },
      browserLaunch: { status: "not_run" as const, code: "BROWSER_MODULE_UNAVAILABLE" },
    };
  }
  try {
    const runtimeModule = await import("@/lib/marketing/canonical-capture-runtime");
    const result = await runtimeModule.runCanonicalBrowserSelfTest();
    return {
      browserModules: { puppeteerCore: { status: "ready" }, sparticuzChromium: { status: "ready" } },
      chromium: {
        packUrlConfigured: runtimeModule.chromiumPackConfiguration().packUrlConfigured,
        executableResolved: true,
        executablePathExists: true,
        resolutionMs: result.resolutionMs,
      },
      browserLaunch: { status: "ready", durationMs: result.durationMs, pngBytes: result.pngBytes },
    };
  } catch (error) {
    const code = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "BROWSER_LAUNCH_FAILED";
    const chromiumFailure = code.startsWith("CHROMIUM_");
    return {
      browserModules: {
        puppeteerCore: { status: "ready" as const },
        sparticuzChromium: { status: chromiumFailure ? "error" as const : "ready" as const, ...(chromiumFailure ? { code, message: safeMessage(error) } : {}) },
      },
      chromium: { packUrlConfigured: Boolean(process.env.MARKETING_CHROMIUM_PACK_URL), executableResolved: !chromiumFailure, executablePathExists: !chromiumFailure, resolutionMs: null },
      browserLaunch: chromiumFailure ? { status: "not_run" as const, code } : diagnosticError(error, "BROWSER_LAUNCH_FAILED"),
    };
  }
}

export async function GET(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const captureConfiguration = {
    baseUrlConfigured: Boolean(process.env.MARKETING_CAPTURE_BASE_URL),
    signingSecretConfigured: Boolean(process.env.MARKETING_CAPTURE_SECRET),
  };
  const trustedSourceTokenAvailable = Boolean(request.headers.get("x-vercel-oidc-token"));
  const trustedSourceRequired = previewRequiresTrustedSource(process.env.MARKETING_CAPTURE_BASE_URL);
  let captureRoute: StageStatus = { status: "ready", code: "SYNTHETIC_ROUTE_VALID" };
  try {
    validateCanonicalCaptureRequest({ feature: "chaos-sort", state: "primary" });
  } catch (error) {
    captureRoute = diagnosticError(error, "CAPTURE_ROUTE_UNAVAILABLE");
  }

  const browser = await runBrowserDiagnostic();
  return NextResponse.json({
    nodeRuntime: process.version,
    captureConfiguration,
    browserModules: browser.browserModules,
    chromium: browser.chromium,
    browserLaunch: browser.browserLaunch,
    captureRoute: { ...captureRoute, responseStatus: null },
    deploymentProtection: {
      trustedSourceToken: { status: trustedSourceRequired ? (trustedSourceTokenAvailable ? "ready" : "error") : "not_run", code: trustedSourceRequired && !trustedSourceTokenAvailable ? "TRUSTED_SOURCE_TOKEN_UNAVAILABLE" : undefined },
      sameProjectAuthorization: { status: trustedSourceRequired ? (trustedSourceTokenAvailable ? "ready" : "error") : "not_run", code: trustedSourceRequired && !trustedSourceTokenAvailable ? "TRUSTED_SOURCE_TOKEN_UNAVAILABLE" : undefined },
    },
    storage: { status: "not_run", code: "STORAGE_CHECK_REQUIRES_EXPLICIT_SMOKE_TEST" },
    renderer: { status: "ready", code: "DETERMINISTIC_RENDERER_AVAILABLE" },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string } | null;

  if (body?.action === "browser_test") {
    try {
      const runtimeModule = await import("@/lib/marketing/canonical-capture-runtime");
      const result = await runtimeModule.runCanonicalBrowserSelfTest();
      return NextResponse.json({ ok: true, stage: "browserLaunch", durationMs: result.durationMs, pngBytes: result.pngBytes, resolutionMs: result.resolutionMs });
    } catch (error) {
      const diagnostic = diagnosticError(error, "BROWSER_LAUNCH_FAILED");
      return NextResponse.json({ ok: false, stage: "browserLaunch", ...diagnostic }, { status: 503 });
    }
  }

  if (body?.action === "capture_test") {
    const baseUrl = process.env.MARKETING_CAPTURE_BASE_URL;
    const secret = process.env.MARKETING_CAPTURE_SECRET;
    if (!baseUrl || !secret) return NextResponse.json({ ok: false, stage: "configuration", code: "CAPTURE_CONFIGURATION_MISSING", message: "Marketing capture base URL and signing secret are required." }, { status: 503 });
    try {
      const [{ captureCanonicalPage }, { resolveCanonicalFeatureId }, { validateCanonicalCaptureRequest: validate }] = await Promise.all([
        import("@/lib/marketing/canonical-capture-runner"),
        import("@/lib/marketing/canonical-capture-registration"),
        import("@/lib/marketing/canonical-capture"),
      ]);
      const requestData = validate({ feature: "chaos-sort", state: "primary", viewport: "desktop", role: "primary", width: 1440, height: 1000 });
      const featureId = await resolveCanonicalFeatureId("chaos-sort");
      if (!featureId) return NextResponse.json({ ok: false, stage: "captureRoute", code: "CAPTURE_FEATURE_UNAVAILABLE", message: "The canonical capture feature is not initialized." }, { status: 503 });
      const trustedSourceToken = request.headers.get("x-vercel-oidc-token") ?? undefined;
      const captured = await captureCanonicalPage(requestData, { baseUrl, featureId, secret, trustedSourceToken });
      const png = Buffer.from(captured.png);
      const dimensions = png.length >= 8 && png.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
        ? await (await import("sharp")).default(png).metadata()
        : null;
      return NextResponse.json({ ok: true, stage: "captureRoute", responseStatus: 200, signedTokenAccepted: true, trustedSource: { status: "ready" }, pngBytes: png.length, pngMagicValid: Boolean(dimensions), width: dimensions?.width ?? null, height: dimensions?.height ?? null });
    } catch (error) {
      const diagnostic = diagnosticError(error, "CAPTURE_ROUTE_FAILED");
      return NextResponse.json({ ok: false, stage: "captureRoute", ...diagnostic }, { status: 503 });
    }
  }

  return NextResponse.json({ ok: false, code: "UNKNOWN_HEALTH_ACTION", message: "Use browser_test or capture_test." }, { status: 400 });
}
