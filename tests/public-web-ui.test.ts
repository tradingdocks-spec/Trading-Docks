import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PUBLIC_WEB_ROOTS = [
  "src/app/page.tsx",
  "src/app/pricing/page.tsx",
  "src/app/sign-in/page.tsx",
  "src/app/sign-up/page.tsx",
  "src/app/forgot-password/page.tsx",
  "src/app/update-password/page.tsx",
  "src/components/landing",
];

const DASHBOARD_UI_ROOTS = [
  "src/components/dashboard/common/PageScaffold.tsx",
  "src/components/dashboard/shared/PageScaffold.tsx",
];

test("public web surface avoids dead signup links invalid sizing utilities and mojibake", () => {
  const files = PUBLIC_WEB_ROOTS.flatMap((entry) => listSourceFiles(path.join(repoRoot, entry)));

  assert.ok(files.length > 10, "expected public web surface files");

  for (const file of files) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");

    assert.doesNotMatch(source, /\/signup(?:\?|["'`/#])/i, `${relative} links to the inactive /signup route`);
    assert.doesNotMatch(source, /\bh-13\b/, `${relative} uses invalid Tailwind height utility h-13`);
    assert.doesNotMatch(source, /(?:Ã|Â|â[€”]|�)/, `${relative} contains visible encoding artifacts`);
  }
});

test("public web metadata is production-ready and auth utility pages stay out of search", () => {
  const layout = readFileSync(path.join(repoRoot, "src/app/layout.tsx"), "utf8");
  assert.match(layout, /metadataBase:\s*new URL\("https:\/\/www\.tradingdocks\.com"\)/);
  assert.match(layout, /openGraph:\s*{/);
  assert.match(layout, /twitter:\s*{/);
  assert.match(layout, /alternates:\s*{/);

  const noindexRoutes = [
    "src/app/sign-in/page.tsx",
    "src/app/forgot-password/page.tsx",
    "src/app/update-password/page.tsx",
  ];

  for (const route of noindexRoutes) {
    const source = readFileSync(path.join(repoRoot, route), "utf8");
    assert.match(source, /robots:\s*{[\s\S]*index:\s*false/, `${route} should not be indexed`);
  }

  const signUp = readFileSync(path.join(repoRoot, "src/app/sign-up/page.tsx"), "utf8");
  assert.match(signUp, /title:\s*"Create Your Workspace"/);
  assert.doesNotMatch(signUp, /index:\s*false/, "sign-up should remain a crawlable conversion route");
});

test("dashboard scaffolds use production empty-state copy", () => {
  const files = DASHBOARD_UI_ROOTS.flatMap((entry) => listSourceFiles(path.join(repoRoot, entry)));

  for (const file of files) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");

    assert.doesNotMatch(source, /placeholder/i, `${relative} exposes placeholder language`);
    assert.match(source, /workspace records activity/, `${relative} should describe the real empty state`);
    assert.match(source, /No trend data yet/, `${relative} should avoid decorative fake charts`);
    assert.doesNotMatch(source, /Live workspace|Awaiting first workspace event/, `${relative} should not imply live data before events exist`);
    assert.doesNotMatch(source, /48 \+ index/, `${relative} should not render fake progress bars`);
  }
});

test("automation workspace exposes a complete beta empty state", () => {
  const source = readFileSync(path.join(repoRoot, "src/app/dashboard/automation/page.tsx"), "utf8");

  assert.match(source, /PageScaffold/);
  assert.match(source, /Active workflows/);
  assert.match(source, /Pending runs/);
  assert.match(source, /Review buying rules/);
  assert.doesNotMatch(source, /WorkspaceFrame|PageHeader/);
});

test("customer CRM empty state avoids dead import CTAs", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/components/dashboard/business/CustomerCrmWorkspace.tsx"),
    "utf8",
  );

  assert.match(source, /Add first customer/);
  assert.match(source, /Bulk customer import is intentionally unavailable/);
  assert.doesNotMatch(source, /CSV import is coming next|Import CSV <span|Soon/);
});

test("business beta pages do not expose dead primary actions", () => {
  const pageHeader = readFileSync(
    path.join(repoRoot, "src/components/dashboard/common/PageHeader.tsx"),
    "utf8",
  );
  const unimplementedActionPages = [
    "src/components/dashboard/business/TasksWorkspace.tsx",
    "src/components/dashboard/business/ReportsWorkspace.tsx",
    "src/components/dashboard/business/VendorsWorkspace.tsx",
    "src/components/dashboard/business/SuppliesWorkspace.tsx",
    "src/components/dashboard/business/PayrollWorkspace.tsx",
  ];
  const implementedActionPages = [
    "src/components/dashboard/business/CalendarWorkspace.tsx",
    "src/components/dashboard/business/CustomerCrmWorkspace.tsx",
    "src/components/dashboard/business/EmployeesWorkspace.tsx",
    "src/components/dashboard/business/TournamentsWorkspace.tsx",
  ];

  assert.match(pageHeader, /actionLabel && onAction/);
  assert.doesNotMatch(pageHeader, /Live workspace/);
  assert.match(pageHeader, /Connected workspace/);

  for (const route of unimplementedActionPages) {
    const source = readFileSync(path.join(repoRoot, route), "utf8");
    assert.doesNotMatch(source, /actionLabel=/, `${route} should not expose a dead header action`);
    assert.doesNotMatch(source, /\(\[\]\s+as|\[\]\)\.map/, `${route} should not keep template array mapping`);
  }

  for (const route of implementedActionPages) {
    const source = readFileSync(path.join(repoRoot, route), "utf8");
    assert.match(source, /actionLabel=/, `${route} should keep its implemented header action`);
    assert.match(source, /onAction=/, `${route} should wire its implemented header action`);
  }
});

test("modular dashboard presents a premium command-center hierarchy", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/components/dashboard/workspace/ModularWorkspace.tsx"),
    "utf8",
  );

  assert.match(source, /Trading Docks HQ/);
  assert.match(source, /State of workspace/);
  assert.match(source, /Next best actions/);
  assert.match(source, /Dashboard builder/);
  assert.match(source, /Start with real inventory value/);
  assert.match(source, /Unlock \{definition\.title\}/);
  assert.doesNotMatch(source, /Your Trading Docks workspace/);
  assert.doesNotMatch(source, /starter module|pro module|business module/i);
  assert.doesNotMatch(source, /Available on \{definition\.plan\}/);
});

test("landing page preview data uses realistic sample states instead of template placeholders", () => {
  const landingData = readFileSync(path.join(repoRoot, "src/components/landing/landing-data.ts"), "utf8");
  const dashboardPreview = readFileSync(path.join(repoRoot, "src/components/landing/DashboardPreview.tsx"), "utf8");
  const experiencePreview = readFileSync(path.join(repoRoot, "src/components/landing/ExperienceSection.tsx"), "utf8");
  const marketFallbacks = readFileSync(path.join(repoRoot, "src/lib/market-engine/fallbacks.ts"), "utf8");

  assert.match(landingData, /LANDING_DEMO_WORKSPACES/);
  assert.match(landingData, /Example seller account/);
  assert.match(landingData, /Sample store data/);
  assert.match(landingData, /Demo workspace/);
  assert.match(dashboardPreview, /HERO_DEMO_WORKSPACE/);
  assert.match(experiencePreview, /LANDING_DEMO_WORKSPACES/);
  assert.match(marketFallbacks, /Sample market snapshot/);

  for (const source of [landingData, dashboardPreview, experiencePreview, marketFallbacks]) {
    assert.doesNotMatch(source, /Updated moments ago|Live product simulation|Across watched cards|Live workspace simulation/);
    assert.doesNotMatch(source, /284,860|22,640|84,216|128,420/);
  }
});

test("create account page keeps signup primary and low-friction", () => {
  const signUp = readFileSync(path.join(repoRoot, "src/app/sign-up/page.tsx"), "utf8");
  const authActions = readFileSync(path.join(repoRoot, "src/app/actions/auth.ts"), "utf8");
  const submitButton = readFileSync(path.join(repoRoot, "src/components/auth/SignUpSubmitButton.tsx"), "utf8");
  const passwordField = readFileSync(path.join(repoRoot, "src/components/auth/PasswordField.tsx"), "utf8");

  assert.match(signUp, /Create your Trading Docks account/);
  assert.match(signUp, /Your workspace takes less than a minute to set up\./);
  assert.match(signUp, /Collect, sell, and grow/);
  assert.match(signUp, /from one workspace\./);
  assert.match(signUp, /No credit card required/);
  assert.match(signUp, /href="\/terms"/);
  assert.match(signUp, /href="\/privacy"/);
  assert.match(signUp, /Already have an account\?/);
  assert.match(signUp, /showMinLengthRequirement/);
  assert.match(passwordField, /8\+ characters/);
  assert.match(authActions, /password\.length < 8/);
  assert.match(submitButton, /useFormStatus/);
  assert.match(submitButton, /form\.checkValidity\(\)/);
  assert.match(submitButton, /disabled=\{pending \|\| !isValid\}/);
  assert.doesNotMatch(signUp, /Continue with Google|Continue with Apple/);
  assert.doesNotMatch(signUp, /className="[^"]*h-10[^"]*w-full[^"]*"[\s\S]{0,120}>\s*Sign in\s*<\/Link>/);
});

function listSourceFiles(target: string): string[] {
  const stat = statSync(target);
  if (stat.isFile()) return target.endsWith(".tsx") || target.endsWith(".ts") ? [target] : [];

  const files: string[] = [];
  for (const entry of readdirSync(target)) {
    files.push(...listSourceFiles(path.join(target, entry)));
  }
  return files;
}
