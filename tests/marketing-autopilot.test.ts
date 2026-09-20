import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMarketingAutopilotPackage } from "../src/lib/marketing/marketing-autopilot.ts";
import { validateCanonicalCaptureRequest } from "../src/lib/marketing/canonical-capture.ts";
import { MARKETING_PRODUCT_REGISTRY } from "../src/lib/marketing/product-marketing-registry.ts";
import { describeMarketingCaptureTarget, resolveMarketingCaptureBaseUrl } from "../src/lib/marketing/canonical-capture-origin.ts";

const proof = { id: "capture-1", name: "Chaos Sort primary capture", featureIds: ["chaos-sort"], role: "primary", source: "canonical_product_capture", approved: true, marketingApproved: true, archived: false };

test("Marketing Autopilot builds a deterministic package from approved product data", () => {
  const result = buildMarketingAutopilotPackage(MARKETING_PRODUCT_REGISTRY, [proof], [], [], { audience: "local_game_store", objective: "awareness", channel: "multi_channel" });
  assert.equal(result.feature.slug, "chaos-sort");
  assert.equal(result.directions.length, 3);
  assert.equal(result.recommendedDirection, "product");
  assert.ok(result.copy.primaryHeadline);
  assert.ok(result.variants.some((item) => item.filename.includes("1080x1080")));
  assert.ok(result.autonomousActions.includes("no_email_send"));
});

test("Autopilot stays on the approved-claim and synthetic-data boundary", () => {
  const source = readFileSync("src/lib/marketing/marketing-autopilot.ts", "utf8");
  const route = readFileSync("src/app/api/admin/marketing/autopilot/route.ts", "utf8");
  assert.doesNotMatch(source, /marketing_prospects|inventory_items|orders|customers|payments/);
  assert.match(route, /requireServerPlatformRole\("admin"\)/);
  assert.match(route, /marketing_outbound_campaigns/);
  assert.match(route, /marketing_creative_briefs/);
  assert.match(source, /no_email_send/);
});

test("canonical capture has a browser runner and automatic Asset Vault registration boundary", () => {
  const runner = readFileSync("src/lib/marketing/canonical-capture-runner.ts", "utf8");
  const route = readFileSync("src/app/api/admin/marketing/intelligence/capture/route.ts", "utf8");
  const registration = readFileSync("src/lib/marketing/canonical-capture-registration.ts", "utf8");
  assert.match(runner, /puppeteer\.launch/);
  assert.match(runner, /document\.fonts\.ready/);
  assert.match(runner, /productRegion\.screenshot/);
  assert.match(route, /marketing-assets/);
  assert.match(registration, /upsert/);
  assert.match(route, /canonical_product_capture/);
});

test("Autopilot resolves missing product proof before persisting a campaign", () => {
  const route = readFileSync("src/app/api/admin/marketing/autopilot/route.ts", "utf8");
  assert.match(route, /resolveMarketingCaptureBaseUrl/);
  assert.match(route, /MARKETING_CAPTURE_SECRET/);
  assert.match(route, /Marketing capture signing is not configured\./);
  assert.match(route, /Marketing capture is not configured/);
  assert.match(route, /captureCanonicalPage/);
  assert.match(route, /registerCanonicalCapture/);
  assert.match(route, /resolveCanonicalFeatureId/);
  assert.match(route, /featureId/);
  assert.match(route, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(route, /role: "primary"/);
  assert.match(route, /status: "captured"/);
  assert.match(route, /BROWSER_MODULE_UNAVAILABLE/);
  assert.match(route, /CAPTURE_FAILED/);
  assert.match(route, /source: "canonical_product_capture"/);
  assert.match(route, /assetId: asset\.id/);
  assert.match(route, /creativeStudio:/);
  assert.doesNotMatch(route, /marketing_prospects|inventory_items|orders|customers|payments/);
  assert.match(route, /status: "existing_approved_proof_selected"/);
  assert.doesNotMatch(route, /MARKETING_CAPTURE_STORAGE_STATE/);
  assert.doesNotMatch(route, /required_before_export/);
  assert.ok(route.indexOf("captureCanonicalPage") < route.indexOf("marketing_outbound_campaigns"));
  assert.ok(route.indexOf("Canonical product capture is unavailable") < route.indexOf("marketing_outbound_campaigns"));
});

test("Autopilot GET stays lightweight and capture modules are lazy", () => {
  const route = readFileSync("src/app/api/admin/marketing/autopilot/route.ts", "utf8");
  const workspace = readFileSync("src/components/dashboard/admin/marketing/MarketingAutopilotWorkspace.tsx", "utf8");
  assert.doesNotMatch(route, /^import .*canonical-capture-(runner|registration)/m);
  assert.doesNotMatch(route, /^import .*canonical-capture["']/m);
  assert.match(route, /import\("@\/lib\/marketing\/canonical-capture-runner"\)/);
  assert.match(route, /import\("@\/lib\/marketing\/canonical-capture-registration"\)/);
  assert.match(route, /import\("@\/lib\/marketing\/canonical-capture"\)/);
  assert.match(route, /return NextResponse\.json\(\{ audiences, objectives, channels, pipeline:/);
  assert.ok(route.indexOf("return NextResponse.json({ audiences") < route.indexOf("import(\"@/lib/marketing/canonical-capture-runner\")"));
  assert.match(workspace, /useState\("local_game_store"\)/);
  assert.match(workspace, /useState\("awareness"\)/);
  assert.match(workspace, /useState\("instagram"\)/);
  assert.match(workspace, /Using the default campaign options/);
  assert.doesNotMatch(workspace, /Marketing Autopilot could not be loaded/);
});

test("production capture uses the signed route, ready marker, and pinned Chromium runtime", () => {
  const runner = readFileSync("src/lib/marketing/canonical-capture-runner.ts", "utf8");
  const runtime = readFileSync("src/lib/marketing/canonical-capture-runtime.ts", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  const shell = readFileSync("src/components/marketing/MarketingProductShell.tsx", "utf8");
  assert.match(runner, /capture_token=/);
  assert.match(runner, /data-marketing-capture-ready/);
  assert.match(runner, /document\.fonts\.ready/);
  assert.doesNotMatch(runner, /storageState/);
  assert.match(runtime, /@sparticuz\/chromium/);
  assert.match(packageJson, /"@sparticuz\/chromium": "153\.0\.0"/);
  assert.match(packageJson, /"node": "24\.x"/);
  assert.match(runtime, /runCanonicalBrowserSelfTest/);
  assert.match(shell, /data-marketing-capture-ready="true" data-marketing-product-capture="true"/);
});

test("capture target uses the current Vercel Preview deployment and production fallback", () => {
  const preview = { VERCEL_ENV: "preview", VERCEL_URL: "trading-docks-new.vercel.app", MARKETING_CAPTURE_BASE_URL: "https://stale-preview.vercel.app" };
  assert.equal(resolveMarketingCaptureBaseUrl(preview), "https://trading-docks-new.vercel.app");
  assert.deepEqual(describeMarketingCaptureTarget(preview), { environment: "preview", source: "VERCEL_URL", baseUrl: "https://trading-docks-new.vercel.app", hostMatchesCurrentDeployment: true });
  const production = { VERCEL_ENV: "production", VERCEL_URL: "trading-docks-prod.vercel.app", MARKETING_CAPTURE_BASE_URL: "https://tradingdocks.com" };
  assert.equal(resolveMarketingCaptureBaseUrl(production), "https://tradingdocks.com");
  assert.equal(describeMarketingCaptureTarget(production).source, "MARKETING_CAPTURE_BASE_URL");
  assert.equal(resolveMarketingCaptureBaseUrl({ VERCEL_ENV: "preview", MARKETING_CAPTURE_BASE_URL: "https://stale-preview.vercel.app" }), "https://stale-preview.vercel.app");
});

test("capture routes share the resolved origin and safe token-mismatch diagnostics", () => {
  const autopilot = readFileSync("src/app/api/admin/marketing/autopilot/route.ts", "utf8");
  const health = readFileSync("src/app/api/admin/marketing/autopilot/health/route.ts", "utf8");
  const intelligence = readFileSync("src/app/api/admin/marketing/intelligence/capture/route.ts", "utf8");
  const page = readFileSync("src/app/internal/marketing-capture/[feature]/[state]/page.tsx", "utf8");
  const runner = readFileSync("src/lib/marketing/canonical-capture-runner.ts", "utf8");
  assert.match(autopilot, /resolveMarketingCaptureBaseUrl/);
  assert.match(health, /describeMarketingCaptureTarget/);
  assert.match(intelligence, /resolveMarketingCaptureBaseUrl/);
  assert.match(page, /\[marketing-capture-auth\]|verifyCanonicalCaptureTokenDetailed/);
  assert.match(runner, /CAPTURE_TOKEN_INVALID_OR_MISMATCHED_DEPLOYMENT/);
  assert.match(health, /captureTarget/);
  assert.match(health, /x-vercel-trusted-oidc-idp-token/);
});

test("canonical capture uses the default browser page and closes capture resources", () => {
  const runner = readFileSync("src/lib/marketing/canonical-capture-runner.ts", "utf8");
  assert.match(runner, /browser\.newPage\(\)/);
  assert.doesNotMatch(runner, /createBrowserContext\(\)/);
  assert.doesNotMatch(runner, /createIncognitoBrowserContext\(\)/);
  assert.match(runner, /page\.close\(\)/);
  assert.match(runner, /browser\.close\(\)/);
});

test("Autopilot diagnostics expose safe health and capture controls", () => {
  const workspace = readFileSync("src/components/dashboard/admin/marketing/MarketingAutopilotWorkspace.tsx", "utf8");
  const health = readFileSync("src/app/api/admin/marketing/autopilot/health/route.ts", "utf8");
  assert.match(workspace, /Autopilot Health/);
  assert.match(workspace, /Refresh Health/);
  assert.match(workspace, /Run Browser Test/);
  assert.match(workspace, /Run Capture Test/);
  assert.match(workspace, /Run Token Test/);
  assert.match(workspace, /Run Capture Auth Test/);
  assert.match(workspace, /autopilot\/health/);
  assert.match(workspace, /browser_test/);
  assert.match(workspace, /capture_test/);
  assert.doesNotMatch(workspace, /MARKETING_CAPTURE_SECRET|SUPABASE_SERVICE_ROLE_KEY|capture_token/);
  assert.match(health, /body\?\.action === "browser_test"/);
  assert.match(health, /body\?\.action === "capture_test"/);
  assert.match(health, /body\?\.action === "token_test"/);
  assert.match(health, /body\?\.action === "capture_auth_test"/);
});

test("capture auth diagnostics use safe reason codes and never return token material", () => {
  const auth = readFileSync("src/lib/marketing/canonical-capture-auth.ts", "utf8");
  const page = readFileSync("src/app/internal/marketing-capture/[feature]/[state]/page.tsx", "utf8");
  const health = readFileSync("src/app/api/admin/marketing/autopilot/health/route.ts", "utf8");
  for (const code of ["VALID", "TOKEN_MISSING", "SECRET_MISSING", "FIXTURE_UNREGISTERED", "TOKEN_FORMAT_INVALID", "TOKEN_VERSION_INVALID", "SIGNATURE_LENGTH_INVALID", "SIGNATURE_INVALID", "PAYLOAD_INVALID", "FEATURE_MISMATCH", "STATE_MISMATCH", "TOKEN_EXPIRED", "NONCE_INVALID"]) assert.match(auth, new RegExp(`\\"${code}\\"`));
  assert.match(auth, /captureSecretFingerprint/);
  assert.match(page, /verifyCanonicalCaptureTokenDetailed/);
  assert.match(page, /\[marketing-capture-auth\]/);
  assert.match(page, /secretConfigured/);
  assert.match(health, /capture_auth_test/);
  assert.match(health, /x-vercel-trusted-oidc-idp-token/);
  assert.doesNotMatch(health, /return NextResponse\.json\(\{[^}]*token[,}]/s);
});

test("canonical capture keeps a server-rendered ready marker and safe page diagnostics", () => {
  const page = readFileSync("src/app/internal/marketing-capture/[feature]/[state]/page.tsx", "utf8");
  const shell = readFileSync("src/components/marketing/MarketingProductShell.tsx", "utf8");
  const runner = readFileSync("src/lib/marketing/canonical-capture-runner.ts", "utf8");
  assert.match(page, /ProductCaptureShell/);
  assert.match(shell, /data-marketing-capture-ready="true" data-marketing-product-capture="true"/);
  assert.match(runner, /document\.querySelector/);
  assert.match(runner, /data-marketing-capture-ready=.*true/);
  assert.match(runner, /CAPTURE_DEPLOYMENT_PROTECTION_BLOCKED/);
  assert.match(runner, /ready marker was not found/);
  assert.match(runner, /document\.title/);
  assert.match(runner, /bodyPrefix/);
  assert.doesNotMatch(runner, /console\.log\(.*capture_token/);
});

test("protected Preview capture forwards Vercel OIDC only from server to server", () => {
  const runner = readFileSync("src/lib/marketing/canonical-capture-runner.ts", "utf8");
  const health = readFileSync("src/app/api/admin/marketing/autopilot/health/route.ts", "utf8");
  const workspace = readFileSync("src/components/dashboard/admin/marketing/MarketingAutopilotWorkspace.tsx", "utf8");
  assert.match(runner, /getVercelOidcToken/);
  assert.match(health, /getVercelOidcToken/);
  assert.doesNotMatch(health, /x-vercel-oidc-token/);
  assert.match(runner, /x-vercel-trusted-oidc-idp-token/);
  assert.match(runner, /TRUSTED_SOURCE_TOKEN_UNAVAILABLE/);
  assert.match(runner, /TRUSTED_SOURCE_REJECTED/);
  assert.match(health, /trustedSourceToken/);
  assert.match(health, /sameProjectAuthorization/);
  assert.match(workspace, /Deployment Protection/);
  assert.doesNotMatch(workspace, /x-vercel-oidc-token|x-vercel-trusted-oidc-idp-token|VERCEL_OIDC_TOKEN/);
  assert.match(runner, /capture_token=/);
  assert.doesNotMatch(runner, /storageState|cookies\(/);
  assert.doesNotMatch(health, /VERCEL_AUTOMATION_BYPASS_SECRET/);
});

test("Autopilot renders and exports real PNG variants only after proof is loaded", () => {
  const route = readFileSync("src/app/api/admin/marketing/autopilot/route.ts", "utf8");
  const rendering = readFileSync("src/lib/marketing/marketing-autopilot-rendering.ts", "utf8");
  const exportRoute = readFileSync("src/app/api/admin/marketing/autopilot/export/route.ts", "utf8");
  assert.ok(route.indexOf("renderAutopilotVariants") < route.indexOf("marketing_outbound_campaigns"));
  assert.match(rendering, /renderCreativeSvg/);
  assert.match(rendering, /sharp\(/);
  assert.match(exportRoute, /JSZip/);
  assert.match(exportRoute, /campaign-copy\.md/);
  assert.match(exportRoute, /campaign-metadata\.json/);
  assert.match(exportRoute, /requireServerPlatformRole\("admin"\)/);
});

test("Autopilot diagnoses creative stages and keeps signed previews non-fatal", () => {
  const route = readFileSync("src/app/api/admin/marketing/autopilot/route.ts", "utf8");
  const preview = readFileSync("src/app/api/admin/marketing/assets/[id]/preview/route.ts", "utf8");
  const workspace = readFileSync("src/components/dashboard/admin/marketing/MarketingAutopilotWorkspace.tsx", "utf8");
  const exportRoute = readFileSync("src/app/api/admin/marketing/autopilot/export/route.ts", "utf8");
  for (const code of ["CREATIVE_RENDER_FAILED", "CREATIVE_UPLOAD_FAILED", "CREATIVE_REGISTRATION_FAILED", "CREATIVE_PREVIEW_URL_FAILED", "CAMPAIGN_PERSISTENCE_FAILED"]) assert.match(route, new RegExp(code));
  assert.match(route, /let previewUrl: string \| null/);
  assert.match(route, /previewFailures/);
  assert.match(route, /partialAssets/);
  assert.match(preview, /requireServerPlatformRole\("admin"\)/);
  assert.match(preview, /createSignedUrl/);
  assert.match(workspace, /Creative preview URL/);
  assert.match(workspace, /Refresh preview/);
  assert.match(workspace, /CREATIVE_PREVIEW_URL_FAILED/);
  assert.match(exportRoute, /storage_path/);
});

test("Autopilot forwards workflow education objective to package and campaign persistence", () => {
  const route = readFileSync("src/app/api/admin/marketing/autopilot/route.ts", "utf8");
  assert.match(route, /body\?\.objective/);
  assert.match(route, /objective, channel/);
  assert.match(route, /name: `\$\{packageData\.feature\.name\} · \$\{objective\}`/);
  assert.match(route, /objective,\s*cta:/s);
});

test("Autopilot health is admin-only and does not expose capture secrets", () => {
  const health = readFileSync("src/app/api/admin/marketing/autopilot/health/route.ts", "utf8");
  assert.match(health, /requireServerPlatformRole\("admin"\)/);
  assert.match(health, /nodeRuntime/);
  assert.match(health, /browserModules/);
  assert.match(health, /executablePathExists/);
  assert.match(health, /browserLaunch/);
  assert.match(health, /captureRoute/);
  assert.match(health, /storage/);
  assert.match(health, /renderer/);
  assert.match(health, /browser_test/);
  assert.match(health, /capture_test/);
  assert.doesNotMatch(health, /MARKETING_CAPTURE_SECRET[^\n]*value/);
  assert.match(health, /runCanonicalBrowserSelfTest/);
});

test("Autopilot capture accepts only registered synthetic feature states", () => {
  assert.throws(() => validateCanonicalCaptureRequest({ feature: "https://evil.example", state: "primary" }), /Unknown canonical marketing feature/);
  assert.throws(() => validateCanonicalCaptureRequest({ feature: "chaos-sort", state: "https://evil.example" }), /Unknown synthetic marketing capture state/);
});

test("Autopilot is a primary admin navigation surface", () => {
  const navigation = readFileSync("src/components/dashboard/navigation.ts", "utf8");
  assert.match(navigation, /Marketing Overview[\s\S]*Marketing Autopilot[\s\S]*Marketing Intelligence/);
  assert.match(navigation, /\/dashboard\/admin\/marketing\/autopilot/);
});

test("Vercel preserves the Chromium runtime and existing CSP directives", () => {
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(config, /serverExternalPackages:\s*\["@sparticuz\/chromium",\s*"puppeteer-core"\]/);
  assert.match(config, /outputFileTracingIncludes:[\s\S]*@sparticuz\/chromium\/bin\/\*\*\/\*/);
  assert.match(config, /script-src 'self' 'unsafe-inline' https:\/\/maps\.googleapis\.com https:\/\/maps\.gstatic\.com/);
  assert.match(config, /img-src 'self' data: blob: https:\/\/\*\.supabase\.co/);
  assert.match(config, /connect-src 'self' https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co/);
});
