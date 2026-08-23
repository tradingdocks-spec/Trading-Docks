import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";

import {
  CONFIGURED_QA_ACCOUNTS,
  REPRESENTATIVE_QA_ACCOUNT,
  type QaAccount,
} from "./auth-state";
import {
  expectNoDocumentOverflow,
  expectNoUnexpectedBrowserErrors,
  gotoAndAssertLoaded,
  monitorPageErrors,
} from "./helpers";

const AUTH_REQUIRED_MESSAGE =
  "Set PLAYWRIGHT_AUTH_EMAIL/PLAYWRIGHT_AUTH_PASSWORD or a tier-specific Playwright QA account to run authenticated browser QA.";

const CORE_AUTHENTICATED_ROUTES = [
  { path: "/dashboard", label: "Dashboard home" },
  { path: "/dashboard/inventory", label: "Inventory" },
  { path: "/dashboard/orders", label: "Orders" },
  { path: "/dashboard/analytics", label: "Analytics" },
  { path: "/dashboard/customers", label: "Customers / CRM" },
  { path: "/dashboard/deck-architect", label: "Deck Architect" },
  { path: "/dashboard/deck-vault", label: "Deck Vault" },
  { path: "/dashboard/tools/csv-converter", label: "CSV / Imports" },
  { path: "/dashboard/settings", label: "Settings" },
  { path: "/dashboard/plans", label: "Billing / Plans" },
] as const;

const ACCOUNT_ROUTE_EXPECTATIONS: Partial<Record<QaAccount["tier"], RegExp[]>> = {
  free: [/dashboard/i, /inventory|collection/i, /deck/i, /settings/i, /plans/i],
  collector: [/dashboard/i, /inventory|collection/i, /deck/i, /portfolio|binder|wishlist/i],
  seller: [/dashboard/i, /inventory/i, /purchasing|deal desk|orders|marketplaces/i],
  store: [/dashboard/i, /inventory/i, /orders|customers|operations|card shows/i],
  owner: [/admin|command center|system|catalog/i],
};

async function openAuthenticatedPage(
  browser: Browser,
  account: QaAccount,
) {
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
    storageState: account.statePath,
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  return { context, page };
}

async function assertAuthenticatedShell(page: Page) {
  await expect(page.locator("main").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /open account menu/i })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: /dashboard navigation|mobile dashboard navigation/i }).first(),
  ).toBeVisible();
}

function shouldRunRouteMatrix(testInfo: TestInfo) {
  return [
    "desktop-chromium-1440",
    "tablet-chromium-768",
    "mobile-chromium-430",
  ].includes(testInfo.project.name);
}

if (!REPRESENTATIVE_QA_ACCOUNT) {
  test.describe("authenticated dashboard browser QA", () => {
    test("requires environment-provided QA credentials", () => {
      test.skip(true, AUTH_REQUIRED_MESSAGE);
    });
  });
} else {
  const representativeAccount = REPRESENTATIVE_QA_ACCOUNT;

  test.describe("authenticated dashboard browser QA", () => {
    test("dashboard shell renders account controls and sign-out affordance", async ({
      browser,
    }) => {
      const { context, page } = await openAuthenticatedPage(browser, representativeAccount);
      const monitor = monitorPageErrors(page);

      try {
        await gotoAndAssertLoaded(page, "/dashboard");
        await assertAuthenticatedShell(page);

        await page.getByRole("button", { name: /open account menu/i }).click();
        await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
        await expectNoDocumentOverflow(page);
        await expectNoUnexpectedBrowserErrors(monitor);
      } finally {
        await context.close();
      }
    });

    test("mobile dashboard drawer opens navigates closes and restores page interaction", async ({
      browser,
      isMobile,
    }) => {
      test.skip(!isMobile, "mobile dashboard drawer is only rendered for mobile projects");

      const { context, page } = await openAuthenticatedPage(browser, representativeAccount);
      const monitor = monitorPageErrors(page);

      try {
        await gotoAndAssertLoaded(page, "/dashboard");
        await page.getByRole("button", { name: /open all dashboard menus/i }).click();
        await expect(page.locator("body")).toHaveAttribute("data-dashboard-mobile-menu", "open");
        await expect(page.getByRole("button", { name: /close sidebar/i }).first()).toBeVisible();

        const sidebar = page.getByRole("navigation", { name: /dashboard navigation/i });
        await expect(sidebar).toBeVisible();
        await sidebar.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });

        const settingsLink = sidebar.getByRole("link", { name: /settings/i }).first();
        await settingsLink.click();
        await page.waitForURL(/\/dashboard\/settings(?:$|[/?#])/, { timeout: 20_000 });
        await expect(page.locator("body")).not.toHaveAttribute("data-dashboard-mobile-menu", "open");

        await page.getByRole("button", { name: /open all dashboard menus/i }).click();
        await expect(page.locator("body")).toHaveAttribute("data-dashboard-mobile-menu", "open");
        await page.getByRole("button", { name: /close sidebar/i }).first().click();
        await expect(page.locator("body")).not.toHaveAttribute("data-dashboard-mobile-menu", "open");

        await page.getByRole("button", { name: /open all dashboard menus/i }).click();
        await page.mouse.click(390, 20);
        await expect(page.locator("body")).not.toHaveAttribute("data-dashboard-mobile-menu", "open");
        await expectNoDocumentOverflow(page);
        await expectNoUnexpectedBrowserErrors(monitor);
      } finally {
        await context.close();
      }
    });

    for (const route of CORE_AUTHENTICATED_ROUTES) {
      test(`${route.label} route renders for representative authenticated account`, async ({
        browser,
      }, testInfo) => {
        test.skip(!shouldRunRouteMatrix(testInfo), "Core authenticated route matrix runs at 1440, 768, and 430 widths.");

        const { context, page } = await openAuthenticatedPage(browser, representativeAccount);
        const monitor = monitorPageErrors(page);

        try {
          await gotoAndAssertLoaded(page, route.path);
          await assertAuthenticatedShell(page);
          await expectNoDocumentOverflow(page);
          await expectNoUnexpectedBrowserErrors(monitor);
        } finally {
          await context.close();
        }
      });
    }

    test("Settings Data & Privacy beta actions are reachable but non-destructive", async ({
      browser,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chromium-1440", "Settings workflow smoke runs once on desktop Chromium.");

      const { context, page } = await openAuthenticatedPage(browser, representativeAccount);
      const monitor = monitorPageErrors(page);

      try {
        await gotoAndAssertLoaded(page, "/dashboard/settings");
        await page.getByRole("button", { name: /data & privacy/i }).click();
        await expect(page.getByText("Support-assisted", { exact: true }).first()).toBeVisible();
        await expect(page.getByRole("link", { name: /download inventory backup/i })).toHaveAttribute(
          "href",
          "/dashboard/tools/csv-converter",
        );
        await expect(page.getByRole("link", { name: /request account deletion/i })).toHaveAttribute(
          "href",
          /^mailto:/,
        );
        await expectNoDocumentOverflow(page);
        await expectNoUnexpectedBrowserErrors(monitor);
      } finally {
        await context.close();
      }
    });

    test("Deck Architect potential commander search keeps the authenticated session", async ({
      browser,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chromium-1440", "Deck Architect potential search runs once on desktop Chromium.");

      const { context, page } = await openAuthenticatedPage(browser, representativeAccount);
      const monitor = monitorPageErrors(page);
      const searchResponses: Array<{ url: string; status: number }> = [];

      page.on("response", (response) => {
        if (response.url().includes("/api/deck-vault/card-search")) {
          searchResponses.push({ url: response.url(), status: response.status() });
        }
      });

      async function searchPotentialCommander(name: string, expected: RegExp) {
        await page.getByRole("button", { name: /potential/i }).click();
        const search = page.locator('input[placeholder="Search supported catalog"]');
        await search.fill(name);
        await expect(page.getByText("Sign in is required.")).toHaveCount(0);
        await expect(page.getByText(expected).first()).toBeVisible({ timeout: 20_000 });
        const latest = searchResponses.at(-1);
        expect(latest?.status, `${name} card-search status`).toBeLessThan(400);
      }

      try {
        await gotoAndAssertLoaded(page, "/dashboard/deck-architect");
        await assertAuthenticatedShell(page);
        await expect(page.getByText(/collection snapshot/i)).toBeVisible();
        await page.getByRole("button", { name: /Start building/i }).click();

        await searchPotentialCommander("Winota", /Winota, Joiner of Forces/i);
        await searchPotentialCommander("Krenko, Mob Boss", /Krenko, Mob Boss/i);

        await expectNoDocumentOverflow(page);
        await expectNoUnexpectedBrowserErrors(monitor);
      } finally {
        await context.close();
      }
    });
  });
}

const configuredTierAccounts = CONFIGURED_QA_ACCOUNTS.filter((entry) => entry.tier !== "default");

if (configuredTierAccounts.length > 0) {
  test.describe("tier-specific authenticated navigation QA", () => {
    for (const account of configuredTierAccounts) {
      test(`${account.label} navigation exposes expected browser-level surface`, async ({
        browser,
      }, testInfo) => {
        test.skip(testInfo.project.name !== "desktop-chromium-1440", "Tier navigation matrix runs once on desktop Chromium.");

        const { context, page } = await openAuthenticatedPage(browser, account);
        const monitor = monitorPageErrors(page);

        try {
          await gotoAndAssertLoaded(page, "/dashboard");
          await assertAuthenticatedShell(page);
          const expectations = ACCOUNT_ROUTE_EXPECTATIONS[account.tier] ?? [];
          for (const expectedLink of expectations) {
            await expect(
              page
                .getByRole("navigation", { name: /dashboard navigation/i })
                .getByRole("link", { name: expectedLink })
                .first(),
            ).toBeVisible();
          }
          await expectNoDocumentOverflow(page);
          await expectNoUnexpectedBrowserErrors(monitor);
        } finally {
          await context.close();
        }
      });
    }
  });
}
