import { expect, test } from "@playwright/test";

import {
  PUBLIC_ROUTES,
  expectNoDocumentOverflow,
  expectNoUnexpectedBrowserErrors,
  gotoAndAssertLoaded,
  monitorPageErrors,
  openPublicMobileMenu,
  recordSmallTextAudit,
} from "./helpers";

test.describe("public product surface", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  for (const route of PUBLIC_ROUTES) {
    test(`${route.label} route loads without browser crashes or page overflow`, async ({
      page,
    }, testInfo) => {
      const monitor = monitorPageErrors(page);

      await gotoAndAssertLoaded(page, route.path);
      await expect(page.locator("body")).toBeVisible();
      const main = page.locator("main");
      if (await main.count()) {
        await expect(main.first()).toBeVisible();
      }
      await expectNoDocumentOverflow(page);

      if (["home", "pricing", "sign in", "sign up"].includes(route.label)) {
        await recordSmallTextAudit(page, testInfo);
      }

      await expectNoUnexpectedBrowserErrors(monitor);
    });
  }

  test("homepage header navigation and CTAs are usable", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes("mobile-webkit"),
      "Mobile WebKit covers route rendering and screenshots; interactive drawer clicks are covered in mobile Chromium.",
    );
    test.skip(
      testInfo.project.name.includes("desktop-webkit"),
      "Desktop WebKit covers route rendering and overflow; same-page header navigation is covered in Chromium and Firefox.",
    );

    const monitor = monitorPageErrors(page);

    await gotoAndAssertLoaded(page, "/");
    await expect(page.locator("header")).toBeVisible();

    const primaryNavigation = page
      .locator("header")
      .getByRole("navigation", { name: /primary site navigation/i });

    if (await primaryNavigation.isVisible()) {
      await expect(page.locator("header").getByRole("link", { name: /log in/i })).toBeVisible();
      await expect(page.locator("header").getByRole("link", { name: /get started/i })).toBeVisible();
      await primaryNavigation.getByRole("link", { name: /pricing/i }).click();
    } else {
      await openPublicMobileMenu(page);
      const mobileNavigation = page
        .locator("header")
        .getByRole("navigation", { name: /mobile site navigation/i });
      await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
      await mobileNavigation.getByRole("link", { name: /pricing/i }).click();
    }
    await expect(page.locator("#pricing")).toBeInViewport();
    await expectNoDocumentOverflow(page);
    await expectNoUnexpectedBrowserErrors(monitor);
  });

  test("mobile public menu opens closes and restores body scrolling", async ({
    page,
    isMobile,
  }, testInfo) => {
    test.skip(!isMobile, "mobile menu is only rendered for mobile projects");
    test.skip(
      testInfo.project.name.includes("webkit"),
      "Mobile WebKit route smoke covers rendering; drawer open/close interaction is covered in mobile Chromium.",
    );

    const monitor = monitorPageErrors(page);

    await gotoAndAssertLoaded(page, "/");
    await openPublicMobileMenu(page);
    const mobileNavigation = page
      .locator("header")
      .getByRole("navigation", { name: /mobile site navigation/i });

    await expect(mobileNavigation.getByRole("link", { name: /platform/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
    await expect(
      page.evaluate(() => window.getComputedStyle(document.body).overflow),
    ).resolves.toBe("hidden");

    await page.getByRole("button", { name: /close navigation/i }).click();
    await expect(page.getByRole("button", { name: /open navigation/i })).toBeVisible();
    await expect(
      page.evaluate(() => window.getComputedStyle(document.body).overflow),
    ).resolves.not.toBe("hidden");
    await expectNoDocumentOverflow(page);
    await expectNoUnexpectedBrowserErrors(monitor);
  });

  test("auth forms expose named fields and safe password reveal controls", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes("webkit"), "WebKit route smoke covers form rendering; password interaction runs in Chromium and Firefox.");

    const monitor = monitorPageErrors(page);

    await gotoAndAssertLoaded(page, "/sign-in");
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await page.getByRole("button", { name: /show password/i }).click({ force: true });
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
    await expectNoDocumentOverflow(page);

    await gotoAndAssertLoaded(page, "/sign-up");
    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
    await expectNoUnexpectedBrowserErrors(monitor);
  });
});
