import { test, expect } from "@playwright/test";

const games = ["Magic", "Pokemon", "Pokemon JP", "Lorcana", "One Piece"];
const modes = ["Balanced signal", "Price movement", "Demand", "Spread"];

for (const width of [1728, 1440, 1024, 430, 390]) test(`homepage artwork at ${width}px across every game and signal`, async ({ page }) => {
  // Twenty game/mode combinations include real image loading. Keep each image
  // bounded at 30s, but do not share one 30s deadline across the entire matrix.
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/#market");
  const market = page.getByRole("region", { name: "Market intelligence", exact: true });
  for (const game of games) {
    await market.getByRole("button", { name: game, exact: true }).click();
    for (const mode of modes) {
      await market.getByRole("button", { name: mode, exact: true }).click();
      await expect(market.locator('[data-artwork-mode="normal"]')).toBeVisible();
      const images = market.locator("img");
      await expect(images).toHaveCount(game === "Magic" ? 6 : 4);
      for (const image of await images.all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0), { timeout: 30000 }).toBe(true);
        await expect(image).toHaveCSS("object-fit", "contain");
      }
      await expect(market.locator('[data-artwork-state="paused"]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});

test("image errors preserve layout and another game recovers", async ({ page }) => {
  let failRequests!: () => void;
  const failureGate = new Promise<void>(resolve => { failRequests = resolve; });
  await page.route("**/_next/image?**", async route => { await failureGate; await route.abort(); });
  await page.goto("/#market", { waitUntil: "domcontentloaded" });
  const market = page.getByRole("region", { name: "Market intelligence", exact: true });
  await market.getByRole("button", { name: "Pokemon", exact: true }).click();
  const featured = market.locator('[data-market-artwork="featured"]');
  await expect(featured).toHaveAttribute("data-artwork-state", "verified");
  const before = await featured.boundingBox();
  failRequests();
  await expect(featured).toHaveAttribute("data-artwork-state", "paused");
  await expect(featured.getByText("Preview paused")).toBeVisible();
  await expect(featured.locator("img")).toHaveCount(0);
  // Subpixel layout rounding differs between Firefox/WebKit and animation frames.
  expect(Math.abs((await featured.boundingBox())!.height - before!.height)).toBeLessThan(1);
  await page.unroute("**/_next/image?**");
  await market.getByRole("button", { name: "Lorcana", exact: true }).click();
  await expect(featured).toHaveAttribute("data-artwork-state", "verified");
  await expect.poll(() => featured.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0), { timeout: 30000 }).toBe(true);
});
