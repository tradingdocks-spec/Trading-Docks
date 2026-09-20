import { NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { validateCanonicalCaptureRequest } from "@/lib/marketing/canonical-capture";
import { captureSecretFingerprint, createCanonicalCaptureToken, verifyCanonicalCaptureTokenDetailed } from "@/lib/marketing/canonical-capture-auth";
import { describeMarketingCaptureTarget, resolveMarketingCaptureBaseUrl } from "@/lib/marketing/canonical-capture-origin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type StageStatus = { status: "ready" | "error" | "not_run"; code?: string; message?: string };

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown diagnostic error.";
  return message
    .replace(/https?:\/\/\S+/gi, "[remote resource]")
    .replace(/capture_token=[^&\s]+/gi, "capture_token=[redacted]")
    .replace(/v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted token]")
    .replace(/MARKETING_CAPTURE_SECRET|SUPABASE_SERVICE_ROLE_KEY|MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY/gi, "[redacted variable]")
    .slice(0, 240);
}

function authDiagnosticCode(code: string) {
  if (code === "SIGNATURE_INVALID" || code === "SIGNATURE_LENGTH_INVALID" || code === "TOKEN_FORMAT_INVALID") return "CAPTURE_TOKEN_SIGNATURE_INVALID";
  if (code === "TOKEN_EXPIRED") return "CAPTURE_TOKEN_EXPIRED";
  if (code === "FEATURE_MISMATCH") return "CAPTURE_TOKEN_FEATURE_MISMATCH";
  if (code === "STATE_MISMATCH") return "CAPTURE_TOKEN_STATE_MISMATCH";
  return code;
}

async function resolveTrustedSourceTokenForTarget(baseUrl: string) {
  if (!previewRequiresTrustedSource(baseUrl)) return undefined;
  try {
    const token = await getVercelOidcToken();
    if (!token) throw new Error("Vercel OIDC token was empty.");
    return token;
  } catch {
    throw Object.assign(new Error("Vercel Trusted Source authorization is unavailable for this Preview capture."), { code: "TRUSTED_SOURCE_TOKEN_UNAVAILABLE" });
  }
}

function diagnosticError(error: unknown, fallbackCode: string): StageStatus {
  const candidate = error as { code?: unknown } | null;
  return {
    status: "error",
    code: typeof candidate?.code === "string" ? candidate.code : fallbackCode,
    message: safeMessage(error),
  };
}

function previewRequiresTrustedSource(baseUrl: string | null) {
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "preview" || !baseUrl) return false;
  try { return new URL(baseUrl).hostname.endsWith(".vercel.app"); } catch { return false; }
}

async function trustedSourceStatus(required: boolean) {
  if (!required) return { status: "not_run" as const };
  try {
    const token = await getVercelOidcToken();
    return token ? { status: "ready" as const } : { status: "error" as const, code: "TRUSTED_SOURCE_TOKEN_UNAVAILABLE" };
  } catch {
    return { status: "error" as const, code: "TRUSTED_SOURCE_TOKEN_UNAVAILABLE" };
  }
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

export async function GET() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const captureTarget = describeMarketingCaptureTarget();
  const captureConfiguration = {
    baseUrlConfigured: Boolean(resolveMarketingCaptureBaseUrl()),
    signingSecretConfigured: Boolean(process.env.MARKETING_CAPTURE_SECRET),
  };
  const trustedSourceRequired = previewRequiresTrustedSource(captureTarget.baseUrl);
  const trustedSource = await trustedSourceStatus(trustedSourceRequired);
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
    captureTarget: { environment: captureTarget.environment, source: captureTarget.source, hostMatchesCurrentDeployment: captureTarget.hostMatchesCurrentDeployment },
    deploymentProtection: {
      trustedSourceToken: trustedSource,
      sameProjectAuthorization: trustedSource,
    },
    storage: { status: "not_run", code: "STORAGE_CHECK_REQUIRES_EXPLICIT_SMOKE_TEST" },
    renderer: { status: "ready", code: "DETERMINISTIC_RENDERER_AVAILABLE" },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string } | null;

  if (body?.action === "token_test") {
    const feature = "chaos-sort";
    const state = "primary";
    const secret = process.env.MARKETING_CAPTURE_SECRET;
    if (!secret) return NextResponse.json({ ok: false, stage: "tokenAuth", code: "SECRET_MISSING", message: "Marketing capture signing is not configured." }, { status: 503 });
    const token = createCanonicalCaptureToken(feature, state, secret);
    const result = verifyCanonicalCaptureTokenDetailed(token, feature, state, secret);
    if (result.code !== "VALID") return NextResponse.json({ ok: false, stage: "tokenAuth", code: authDiagnosticCode(result.code), authDiagnostic: result.code }, { status: 503 });
    return NextResponse.json({ ok: true, stage: "tokenAuth", feature, state, secretFingerprint: captureSecretFingerprint(secret), result: result.code });
  }

  if (body?.action === "capture_auth_test") {
    const captureTarget = describeMarketingCaptureTarget();
    const baseUrl = captureTarget.baseUrl;
    const secret = process.env.MARKETING_CAPTURE_SECRET;
    if (!baseUrl || !secret) return NextResponse.json({ ok: false, stage: "captureAuth", code: "CAPTURE_CONFIGURATION_MISSING", message: "Marketing capture origin and signing secret are required." }, { status: 503 });
    if (process.env.VERCEL_ENV === "preview" && !captureTarget.hostMatchesCurrentDeployment) return NextResponse.json({ ok: false, stage: "captureAuth", code: "CAPTURE_DEPLOYMENT_MISMATCH", message: "The capture target does not match the current Preview deployment." }, { status: 503 });
    const feature = "chaos-sort";
    const state = "primary";
    const token = createCanonicalCaptureToken(feature, state, secret);
    const localResult = verifyCanonicalCaptureTokenDetailed(token, feature, state, secret);
    if (localResult.code !== "VALID") return NextResponse.json({ ok: false, stage: "captureAuth", code: authDiagnosticCode(localResult.code), authDiagnostic: localResult.code }, { status: 503 });
    try {
      const trustedSourceToken = await resolveTrustedSourceTokenForTarget(baseUrl);
      const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/internal/marketing-capture/${feature}/${state}?capture_token=${encodeURIComponent(token)}`, {
        redirect: "manual",
        headers: trustedSourceToken ? { "x-vercel-trusted-oidc-idp-token": trustedSourceToken } : undefined,
      });
      const redirectLocation = response.headers.get("location");
      const finalHost = redirectLocation ? new URL(redirectLocation, baseUrl).hostname : new URL(response.url || baseUrl).hostname;
      if (finalHost !== new URL(baseUrl).hostname) return NextResponse.json({ ok: false, stage: "captureAuth", code: trustedSourceToken ? "TRUSTED_SOURCE_REJECTED" : "CAPTURE_DEPLOYMENT_PROTECTION_BLOCKED", responseStatus: response.status, finalHost }, { status: 503 });
      if (response.status !== 200) {
        const code = response.status === 404 ? "CAPTURE_TOKEN_INVALID_OR_MISMATCHED_DEPLOYMENT" : trustedSourceToken && (response.status === 401 || response.status === 403) ? "TRUSTED_SOURCE_REJECTED" : "CAPTURE_AUTH_REJECTED";
        return NextResponse.json({ ok: false, stage: "captureAuth", code, responseStatus: response.status, finalHost }, { status: 503 });
      }
      return NextResponse.json({ ok: true, stage: "captureAuth", responseStatus: response.status, finalHost, authDiagnostic: "VALID", trustedSource: trustedSourceToken ? { status: "ready" } : { status: "not_run" }, issuerDeploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null });
    } catch (error) {
      return NextResponse.json({ ok: false, stage: "captureAuth", ...diagnosticError(error, "CAPTURE_AUTH_REJECTED") }, { status: 503 });
    }
  }

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
    const captureTarget = describeMarketingCaptureTarget();
    const baseUrl = captureTarget.baseUrl;
    const secret = process.env.MARKETING_CAPTURE_SECRET;
    if (!baseUrl || !secret) return NextResponse.json({ ok: false, stage: "configuration", code: "CAPTURE_CONFIGURATION_MISSING", message: "Marketing capture origin and signing secret are required." }, { status: 503 });
    try {
      const [{ captureCanonicalPage }, { registerCanonicalCapture, resolveCanonicalFeatureId }, { validateCanonicalCaptureRequest: validate }] = await Promise.all([
        import("@/lib/marketing/canonical-capture-runner"),
        import("@/lib/marketing/canonical-capture-registration"),
        import("@/lib/marketing/canonical-capture"),
      ]);
      const requestData = validate({ feature: "chaos-sort", state: "primary", viewport: "desktop", role: "primary", width: 1440, height: 1000 });
      const featureId = await resolveCanonicalFeatureId("chaos-sort");
      if (!featureId) return NextResponse.json({ ok: false, stage: "captureRoute", code: "CAPTURE_FEATURE_UNAVAILABLE", message: "The canonical capture feature is not initialized." }, { status: 503 });
      const captured = await captureCanonicalPage(requestData, { baseUrl, featureId, secret });
      const png = Buffer.from(captured.png);
      const dimensions = png.length >= 8 && png.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
        ? await (await import("sharp")).default(png).metadata()
        : null;
      const asset = await registerCanonicalCapture(captured.metadata, png); return NextResponse.json({ ok: true, stage: "captureRoute", responseStatus: 200, signedTokenAccepted: true, trustedSource: { status: "ready" }, pngBytes: png.length, pngMagicValid: Boolean(dimensions), width: dimensions?.width ?? null, height: dimensions?.height ?? null, storageUpload: { status: "ready" }, assetRegistration: { status: "ready" }, assetId: asset.id });
    } catch (error) {
      const diagnostic = diagnosticError(error, "CAPTURE_ROUTE_FAILED");
      return NextResponse.json({ ok: false, stage: "captureRoute", ...diagnostic }, { status: 503 });
    }
  }

  return NextResponse.json({ ok: false, code: "UNKNOWN_HEALTH_ACTION", message: "Use token_test, capture_auth_test, browser_test, or capture_test." }, { status: 400 });
}
