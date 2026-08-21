import fs from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { CONFIGURED_QA_ACCOUNTS } from "./auth-state";
import { gotoAndAssertLoaded } from "./helpers";

test.describe("authenticated storage state setup", () => {
  test.skip(
    CONFIGURED_QA_ACCOUNTS.length === 0,
    "Set Playwright QA account credentials to create authenticated browser storage states.",
  );

  for (const account of CONFIGURED_QA_ACCOUNTS) {
    test(`creates storage state for ${account.label}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await gotoAndAssertLoaded(page, "/sign-in");
      await page.getByLabel(/email address/i).fill(account.email ?? "");
      await page.getByLabel(/^password$/i).fill(account.password ?? "");
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 30_000 });
      await expect(page.getByRole("main").or(page.locator("main")).first()).toBeVisible();
      await fs.mkdir(".playwright-auth", { recursive: true });
      await page.context().storageState({ path: account.statePath });
    });
  }
});
