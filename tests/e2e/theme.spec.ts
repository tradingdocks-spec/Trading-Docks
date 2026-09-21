import { expect, test } from "@playwright/test";
import { expectNoDocumentOverflow } from "./helpers";

const routes = [
  "/",
  "/pricing",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/update-password",
  "/privacy",
  "/terms",
  "/security",
];
for (const theme of ["dark", "light"] as const) {
  test(`public routes render usable controls in ${theme} mode`, async ({
    context,
  }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    for (const route of routes) {
      const page = await context.newPage();
      const collectError = (error: Error) => errors.push(error.message);
      page.on("pageerror", collectError);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(route, { waitUntil: "networkidle" });
      await page
        .getByRole("combobox", { name: "Color theme" })
        .first()
        .selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(
        page.getByRole("combobox", { name: "Color theme" }).first(),
      ).toBeAttached();
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        theme === "dark" ? "rgb(10, 16, 27)" : "rgb(243, 247, 253)",
      );
      await expect(page.locator("main").first()).toBeVisible();
      await expectNoDocumentOverflow(page);
      if (route === "/sign-in") {
        if ((page.viewportSize()?.width ?? 0) >= 1024) {
          const branding = await page
            .getByRole("link", { name: "Return to Trading Docks home" })
            .boundingBox();
          expect(branding?.y).toBeGreaterThanOrEqual(0);
        }
        const google = page.getByRole("button", {
          name: "Continue with Google",
        });
        await expect(google).toHaveCSS("color", "rgb(29, 48, 43)");
        await expect(
          page.getByRole("textbox", { name: "Email address" }),
        ).toHaveCSS("color-scheme", theme);
      }
      page.off("pageerror", collectError);
      await page.close();
    }
    expect(errors).toEqual([]);
  });
}

test("theme choice persists across navigation, reloads, tabs and system changes", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  // Firefox can reset the emulated preference during the first navigation.
  await page.emulateMedia({ colorScheme: "dark" });
  const picker = page.getByRole("combobox", { name: "Color theme" });
  await expect(picker).toBeEnabled();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await picker.selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("link", { name: "Create your free account", exact: true })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const second = await context.newPage();
  await second.goto("/pricing", { waitUntil: "domcontentloaded" });
  await expect(second.locator("html")).toHaveAttribute("data-theme", "light");
  await second
    .getByRole("combobox", { name: "Color theme" })
    .selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await second.close();
  await page
    .getByRole("combobox", { name: "Color theme" })
    .selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
