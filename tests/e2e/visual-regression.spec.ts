import { expect, test } from "@playwright/test";

import {
  expectNoUnexpectedBrowserErrors,
  gotoAndAssertLoaded,
  monitorPageErrors,
} from "./helpers";

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
});
