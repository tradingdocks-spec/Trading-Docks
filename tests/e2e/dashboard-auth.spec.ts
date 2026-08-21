import { expect, test } from "@playwright/test";

import {
  expectNoDocumentOverflow,
  expectNoUnexpectedBrowserErrors,
  gotoAndAssertLoaded,
  monitorPageErrors,
} from "./helpers";

const qaEmail = process.env.PLAYWRIGHT_AUTH_EMAIL;
const qaPassword = process.env.PLAYWRIGHT_AUTH_PASSWORD;
const hasQaCredentials = Boolean(qaEmail && qaPassword);

async function signIn(page: import("@playwright/test").Page) {
  await gotoAndAssertLoaded(page, "/sign-in");
  await page.getByLabel(/email address/i).fill(qaEmail ?? "");
  await page.getByLabel(/^password$/i).fill(qaPassword ?? "");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 30_000 });
}

test.describe("authenticated dashboard shell", () => {
  test.skip(!hasQaCredentials, "Set PLAYWRIGHT_AUTH_EMAIL and PLAYWRIGHT_AUTH_PASSWORD to run authenticated browser QA.");

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("dashboard shell renders and navigation is interactive", async ({ page }) => {
    const monitor = monitorPageErrors(page);

    await signIn(page);
    await expect(page.getByRole("navigation", { name: /dashboard navigation/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /settings/i }).first()).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoUnexpectedBrowserErrors(monitor);
  });

  test("mobile dashboard menu locks and restores body scroll", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "mobile dashboard menu only renders for mobile projects");

    const monitor = monitorPageErrors(page);

    await signIn(page);
    await page.getByRole("button", { name: /open all dashboard menus/i }).click();
    await expect(page.locator("body")).toHaveAttribute("data-dashboard-mobile-menu", "open");
    await expect(page.getByRole("button", { name: /close sidebar/i })).toBeVisible();

    await page.getByRole("button", { name: /close sidebar/i }).click();
    await expect(page.locator("body")).not.toHaveAttribute("data-dashboard-mobile-menu", "open");
    await expectNoDocumentOverflow(page);
    await expectNoUnexpectedBrowserErrors(monitor);
  });
});
