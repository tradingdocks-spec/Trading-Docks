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
  const sharedScaffold = readFileSync(
    path.join(repoRoot, "src/components/dashboard/shared/PageScaffold.tsx"),
    "utf8",
  );
  const commonScaffold = readFileSync(
    path.join(repoRoot, "src/components/dashboard/common/PageScaffold.tsx"),
    "utf8",
  );

  assert.match(commonScaffold, /export \{ PageScaffold \} from "\.\.\/shared\/PageScaffold"/);
  assert.match(sharedScaffold, /Decision surface/);
  assert.match(sharedScaffold, /workspace records activity/);
  assert.match(sharedScaffold, /does not fabricate charts/);
  assert.doesNotMatch(sharedScaffold, /Connected workspace|Secure cloud sync|Performance baseline/);

  for (const file of files) {
    const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");

    assert.doesNotMatch(source, /placeholder/i, `${relative} exposes placeholder language`);
    assert.doesNotMatch(source, /Live workspace|Awaiting first workspace event|Connected workspace|Secure cloud sync/, `${relative} should not imply live data before events exist`);
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
  assert.doesNotMatch(pageHeader, /Connected workspace|Secure cloud save/);

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

test("dashboard design foundation uses Trading Docks workflow language", () => {
  const globals = readFileSync(path.join(repoRoot, "src/app/globals.css"), "utf8");
  const audit = readFileSync(path.join(repoRoot, "docs/PRODUCT_DESIGN_AUDIT.md"), "utf8");
  const navigation = readFileSync(path.join(repoRoot, "src/components/dashboard/navigation.ts"), "utf8");
  const shell = readFileSync(path.join(repoRoot, "src/components/dashboard/shell/TieredDashboardShell.tsx"), "utf8");
  const sidebar = readFileSync(path.join(repoRoot, "src/components/dashboard/shell/TieredSidebar.tsx"), "utf8");
  const mobileNav = readFileSync(path.join(repoRoot, "src/components/dashboard/shell/MobileBottomNav.tsx"), "utf8");
  const topbar = readFileSync(path.join(repoRoot, "src/components/dashboard/shell/Topbar.tsx"), "utf8");

  assert.match(globals, /--td-accent-warm/);
  assert.match(globals, /\.td-panel-strong/);
  assert.match(globals, /\.td-button-primary/);
  assert.match(audit, /TCG intelligence and operations system/);
  assert.match(audit, /Do not fabricate business, collection, order, price, or marketplace data/);
  assert.match(navigation, /label:\s*"Collection"/);
  assert.match(navigation, /label:\s*"Acquire"/);
  assert.match(navigation, /label:\s*"Sell"/);
  assert.match(navigation, /label:\s*"Intelligence"/);
  assert.match(navigation, /label:\s*"Operate"/);
  assert.match(navigation, /group\("crm",\s*"Relationships"/);
  assert.match(navigation, /group\("tools",\s*"Utilities"/);
  assert.match(shell, /bg-\[var\(--td-background-primary\)\]/);
  assert.match(shell, /data-dashboard-mobile-menu/);
  assert.match(globals, /body\[data-dashboard-mobile-menu="open"\]/);
  assert.match(globals, /touch-action:\s*none/);
  assert.match(sidebar, /TCG Intelligence OS/);
  assert.match(mobileNav, /grid-cols-5/);
  assert.match(mobileNav, /slice\(0,\s*4\)/);
  assert.match(mobileNav, /aria-expanded=\{menuOpen\}/);
  assert.match(topbar, /TCG intelligence/);
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

test("public redesign removes generic SaaS hero and pricing-card architecture", () => {
  const hero = readFileSync(path.join(repoRoot, "src/components/landing/Hero.tsx"), "utf8");
  const pricing = readFileSync(path.join(repoRoot, "src/components/landing/PricingSection.tsx"), "utf8");
  const planComparison = readFileSync(
    path.join(repoRoot, "src/app/dashboard/plans/TieredPlanComparison.tsx"),
    "utf8",
  );
  const header = readFileSync(path.join(repoRoot, "src/components/landing/Header.tsx"), "utf8");
  const footer = readFileSync(path.join(repoRoot, "src/components/landing/Footer.tsx"), "utf8");

  assert.match(hero, /CARD_LIFECYCLE/);
  assert.match(hero, /Follow every card from scan to sale/);
  assert.match(hero, /operating snapshot/);
  assert.doesNotMatch(hero, /DashboardPreview/);
  assert.doesNotMatch(hero, /rounded-full bg-blue|orbitField|floating dashboard/i);

  assert.match(pricing, /Organize/);
  assert.match(pricing, /Understand/);
  assert.match(pricing, /Sell/);
  assert.match(pricing, /Operate/);
  assert.match(pricing, /COMPARISON_ROWS/);
  assert.doesNotMatch(pricing, /PricingCard|Most popular|bg-gradient-to|Sparkles/);

  assert.match(planComparison, /Choose by workflow/);
  assert.match(planComparison, /Capability matrix/);
  assert.doesNotMatch(planComparison, /min-h-\[680px\]|What's included|rounded-\[28px\]/);

  assert.match(header, /PRODUCT_NAV/);
  assert.match(header, /Lifecycle/);
  assert.match(footer, /Card intelligence, inventory control, and operating workflows/);
  assert.doesNotMatch(footer, /Â©/);
});

test("deployed product and mobile QA matrix records routes viewports and real-device boundaries", () => {
  const qa = readFileSync(path.join(repoRoot, "docs/DEPLOYED_PRODUCT_MOBILE_QA.md"), "utf8");

  for (const route of [
    "/",
    "/pricing",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/update-password",
    "/dashboard",
    "/dashboard/inventory",
    "/dashboard/orders",
    "/dashboard/analytics",
    "/dashboard/customers",
    "/dashboard/deck-architect",
    "/dashboard/deck-vault",
    "/dashboard/settings",
    "/dashboard/admin",
  ]) {
    assert.match(qa, new RegExp(escapeRegExp(route)), `QA matrix should include ${route}`);
  }

  for (const viewport of [
    "375 x 812",
    "390 x 844",
    "430 x 932",
    "768 x 1024",
    "1024 x 768",
    "1280 x 800",
    "1440 x 900",
    "1920 x 1080",
  ]) {
    assert.match(qa, new RegExp(escapeRegExp(viewport)), `QA matrix should include ${viewport}`);
  }

  assert.match(qa, /Browser emulation must not be recorded as physical iPhone\/Android validation/);
  assert.match(qa, /Physical mobile readiness: NO-GO/);
  assert.match(qa, /body\[data-dashboard-mobile-menu="open"\]/);
});

test("remaining homepage sections use the unified Trading Docks product language", () => {
  const experience = readFileSync(path.join(repoRoot, "src/components/landing/ExperienceSection.tsx"), "utf8");
  const features = readFileSync(path.join(repoRoot, "src/components/landing/FeaturesSection.tsx"), "utf8");
  const workflow = readFileSync(path.join(repoRoot, "src/components/landing/WorkflowExperienceSection.tsx"), "utf8");
  const ecosystem = readFileSync(path.join(repoRoot, "src/components/landing/EcosystemSection.tsx"), "utf8");
  const plans = readFileSync(path.join(repoRoot, "src/components/landing/PlanJourneySection.tsx"), "utf8");
  const market = readFileSync(path.join(repoRoot, "src/components/landing/MarketSection.tsx"), "utf8");

  assert.match(experience, /WORKFLOW_BY_PERSONA/);
  assert.match(experience, /The same card lifecycle/);
  assert.match(features, /PRODUCT_AUTHORITIES/);
  assert.match(features, /DECISION_ROWS/);
  assert.match(workflow, /LIFECYCLE_TRACE/);
  assert.match(workflow, /A card should never become an orphaned row/);
  assert.match(ecosystem, /SOURCE_ROWS/);
  assert.match(ecosystem, /Catalog identity stays separate from owned inventory/);
  assert.match(plans, /Organize, understand, sell, operate/);
  assert.match(plans, /MEMBERSHIP_PLANS/);
  assert.match(market, /Product movement, not a fake stock ticker/);
  assert.match(market, /rankCards/);

  for (const source of [experience, features, workflow, ecosystem, plans, market]) {
    assert.doesNotMatch(source, /bg-gradient-to|rounded-\[2[468]px\]|rounded-3xl|Sparkles|td-spotlight-card/);
    assert.doesNotMatch(source, /(?:Ã|Â|â[€”]|�)/);
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
