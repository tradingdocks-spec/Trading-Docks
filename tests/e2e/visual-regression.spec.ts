import { expect, test, type Browser } from "@playwright/test";

import { REPRESENTATIVE_QA_ACCOUNT, type QaAccount } from "./auth-state";
import {
  expectNoUnexpectedBrowserErrors,
  gotoAndAssertLoaded,
  monitorPageErrors,
} from "./helpers";

async function openAuthenticatedPage(browser: Browser, account: QaAccount) {
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
    storageState: account.statePath,
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  return { context, page };
}

test.describe("stable visual baselines", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("homepage desktop visual shell remains stable", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium-1440", "single desktop baseline project");

    const monitor = monitorPageErrors(page);
    await gotoAndAssertLoaded(page, "/");
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
