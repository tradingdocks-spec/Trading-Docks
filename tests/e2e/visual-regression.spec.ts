import { expect, test, type Browser, type Page } from "@playwright/test";

import { REPRESENTATIVE_QA_ACCOUNT, type QaAccount } from "./auth-state";
import {
  expectNoUnexpectedBrowserErrors,
  gotoAndAssertLoaded,
  monitorPageErrors,
} from "./helpers";

async function openAuthenticatedPage(browser: Browser, account: QaAccount) {
  const device = test.info().project.use;
  const context = await browser.newContext({
    viewport: device.viewport,
    isMobile: device.isMobile,
    hasTouch: device.hasTouch,
    deviceScaleFactor: device.deviceScaleFactor,
    userAgent: device.userAgent,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://127.0.0.1:4173",
    ignoreHTTPSErrors: ["127.0.0.1", "localhost"].includes(new URL(process.env.PLAYWRIGHT_BASE_URL ?? "https://127.0.0.1:4173").hostname),
    storageState: account.statePath,
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  return { context, page };
}

async function waitForPublicHomepageVisualState(page: Page) {
  await expect(page.locator("#market")).toBeVisible();
  await expect(page.locator("#market [data-card-id]")).toHaveCount(5);
  await expect(page.locator("#market")).toContainText("Illustrative sample");
  // Full-page screenshots do not trigger loading of offscreen lazy images.
  for (const image of await page.locator('#market img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0), { timeout: 30000 }).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe("stable visual baselines", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  });

  test("homepage desktop visual shell remains stable", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium-1440", "single desktop baseline project");

    const monitor = monitorPageErrors(page);
    await gotoAndAssertLoaded(page, "/");
    await waitForPublicHomepageVisualState(page);
    await expect(page).toHaveScreenshot("homepage-desktop.png", {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.03,
    });
    await expectNoUnexpectedBrowserErrors(monitor);
  });

  test("homepage mobile visual shell remains stable", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-webkit-390", "single mobile baseline project");

    const monitor = monitorPageErrors(page);
    await gotoAndAssertLoaded(page, "/");
    await waitForPublicHomepageVisualState(page);
    await expect(page).toHaveScreenshot("homepage-mobile.png", {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.03,
    });
    await expectNoUnexpectedBrowserErrors(monitor);
  });

  test("pricing desktop visual shell remains stable", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium-1440", "single pricing baseline project");

    const monitor = monitorPageErrors(page);
    await gotoAndAssertLoaded(page, "/pricing");
    await expect(page).toHaveScreenshot("pricing-desktop.png", {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.03,
    });
    await expectNoUnexpectedBrowserErrors(monitor);
  });

  if (REPRESENTATIVE_QA_ACCOUNT) {
    test("authenticated dashboard desktop visual shell remains stable", async ({
      browser,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chromium-1440", "single authenticated desktop baseline project");

      const account = REPRESENTATIVE_QA_ACCOUNT;
      const { context, page } = await openAuthenticatedPage(browser, account);
      const monitor = monitorPageErrors(page);

      try {
        await gotoAndAssertLoaded(page, "/dashboard");
        await expect(page).toHaveScreenshot("dashboard-authenticated-desktop.png", {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.04,
        });
        await expectNoUnexpectedBrowserErrors(monitor);
      } finally {
        await context.close();
      }
    });

    test("authenticated dashboard mobile visual shell remains stable", async ({
      browser,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "mobile-chromium-430", "single authenticated mobile baseline project");

      const account = REPRESENTATIVE_QA_ACCOUNT;
      const { context, page } = await openAuthenticatedPage(browser, account);
      const monitor = monitorPageErrors(page);

      try {
        await gotoAndAssertLoaded(page, "/dashboard");
        await expect(page).toHaveScreenshot("dashboard-authenticated-mobile.png", {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.04,
        });
        await expectNoUnexpectedBrowserErrors(monitor);
      } finally {
        await context.close();
      }
    });

    test("authenticated inventory desktop visual shell remains stable", async ({
      browser,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop-chromium-1440", "single authenticated inventory baseline project");

      const account = REPRESENTATIVE_QA_ACCOUNT;
      const { context, page } = await openAuthenticatedPage(browser, account);
      const monitor = monitorPageErrors(page);

      try {
        await gotoAndAssertLoaded(page, "/dashboard/inventory");
        await expect(page).toHaveScreenshot("inventory-authenticated-desktop.png", {
          fullPage: true,
          animations: "disabled",
          maxDiffPixelRatio: 0.04,
        });
        await expectNoUnexpectedBrowserErrors(monitor);
      } finally {
        await context.close();
      }
    });
  }
});
