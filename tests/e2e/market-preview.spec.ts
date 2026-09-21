import { test, expect } from "@playwright/test";
import { createDemoMarketCards, DEMO_TICK_MS } from "../../src/lib/market-preview";

test("SSR and reduced-motion snapshots use identical stable quotes without hydration warnings", async ({ browser, page, baseURL }) => {
  const serverContext = await browser.newContext({ javaScriptEnabled: false, ignoreHTTPSErrors: new URL(baseURL!).hostname === '127.0.0.1' });
  const serverPage = await serverContext.newPage();
  await serverPage.goto(new URL('/#market', baseURL).href);
  const expected = createDemoMarketCards("magic").map(card => [card.id, String(card.marketPrice)]).sort();
  const quotes = async (target: typeof page) => target.locator("#market [data-card-id]").evaluateAll(nodes => nodes.map(node => [node.getAttribute("data-card-id"), node.getAttribute("data-quote")]).sort());
  expect(await quotes(serverPage)).toEqual(expected);
  await serverContext.close();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#market");
  await expect(page.getByRole("button", { name: "Reduced motion · paused" })).toBeDisabled();
  expect(await quotes(page)).toEqual(expected);
  await page.waitForTimeout(DEMO_TICK_MS + 300);
  await expect(page.locator("[data-feed-tick]")).toHaveAttribute("data-feed-tick", "0");
  await expect(page.locator("#market [role=meter] > span").first()).toHaveCSS("transition-duration", "0s");
  expect(errors).toEqual([]);
});

test("one quote ticks at a time, layout stays stable, pause and offscreen stop updates", async ({ page }) => {
  await page.goto("/#market");
  const feed = page.locator("[data-feed-tick]");
  await expect(feed).toHaveAttribute("data-feed-running", "true");
  const rows = page.locator("#market [data-card-id]");
  const readQuotes = () => rows.evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.getAttribute("data-card-id"), node.getAttribute("data-quote")])));
  await page.evaluate(() => document.fonts.ready);
  const before = await readQuotes();
  const order = await rows.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-card-id")));
  // Layout dimensions exclude transient composited/zoomed bounding-box rounding.
  const height = () => page.locator("[data-artwork-mode]").evaluate(node => (node as HTMLElement).offsetHeight);
  const beforeHeight = await height();
  const focused = await page.locator("[data-featured-id]").getAttribute("data-featured-id");
  await expect(feed).toHaveAttribute("data-feed-tick", "1", { timeout: 7000 });
  const after = await readQuotes();
  expect(Object.keys(before).filter(key => before[key] !== after[key])).toHaveLength(1);
  expect(await height()).toBe(beforeHeight);
  expect(await rows.evaluateAll(nodes => nodes.map(node => node.getAttribute("data-card-id")))).toEqual(order);
  await expect(page.locator("[data-featured-id]")).toHaveAttribute("data-featured-id", focused!);
  await page.getByRole("button", { name: "Pause movement", exact: true }).click();
  const pausedAt = await feed.getAttribute("data-feed-tick");
  await page.waitForTimeout(DEMO_TICK_MS + 300);
  await expect(feed).toHaveAttribute("data-feed-tick", pausedAt!);
  await page.getByRole("button", { name: "Spread", exact: true }).click();
  await page.getByRole("button", { name: "Lorcana", exact: true }).click();
  await expect(page.getByRole("button", { name: "Spread", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(feed).toHaveAttribute("data-feed-running", "false");
  await expect(page.getByRole("button", { name: "Resume movement", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Resume movement", exact: true }).click();
  await expect(feed).toHaveAttribute("data-feed-running", "true");
  await page.getByRole("heading", { name: "Every card. Every move. One system." }).scrollIntoViewIfNeeded();
  await expect(feed).toHaveAttribute("data-feed-running", "false");
  const offscreenAt = await feed.getAttribute("data-feed-tick");
  await page.waitForTimeout(DEMO_TICK_MS + 300);
  await expect(feed).toHaveAttribute("data-feed-tick", offscreenAt!);
});

test("signal modes change both focus metrics and row content; mobile uses signal articles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#market");
  const market = page.locator("#market");
  await expect(market.locator("table")).toHaveCount(0);
  await expect(market.getByRole("article")).toHaveCount(5);
  const orders = new Set<string>();
  for (const [label, mode, text] of [["Balanced signal", "trending", "Opportunity"], ["Price movement", "movers", "24h movement"], ["Demand", "volume", "Demand strength"], ["Spread", "opportunities", "Bid · demo"]]) {
    await market.getByRole("button", { name: label, exact: true }).click();
    await expect(market.locator(`[data-feature-emphasis=${mode}]`).getByText(text, { exact: true })).toBeVisible();
    await expect(market.locator(`[data-row-emphasis=${mode}]`)).toHaveCount(5);
    orders.add((await market.locator("[data-card-id]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-card-id")))).join(","));
  }
  expect(orders.size).toBeGreaterThanOrEqual(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("game changes dispose old tick intervals and media changes stop the current loop", async ({ page }) => {
  await page.addInitScript(() => {
    const active = new Set<number>();
    Object.defineProperty(window, "marketTestIntervals", { get: () => active.size });
    const start = window.setInterval.bind(window);
    const stop = window.clearInterval.bind(window);
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const id = start(handler, timeout, ...args);
      if (timeout === 3200) active.add(id);
      return id;
    }) as typeof window.setInterval;
    window.clearInterval = (id?: number) => { if (id !== undefined) active.delete(id); stop(id); };
  });
  await page.goto("/#market");
  const activeTimers = () => page.evaluate(() => (window as unknown as { marketTestIntervals: number }).marketTestIntervals);
  await page.locator('[data-feed-tick]').scrollIntoViewIfNeeded();
  await expect.poll(activeTimers).toBe(1);
  for (const game of ["Pokemon", "Lorcana", "Magic"]) {
    await page.getByRole("button", { name: game, exact: true }).click();
    await page.locator('[data-feed-tick]').scrollIntoViewIfNeeded();
    await expect.poll(activeTimers).toBe(1);
    await expect(page.locator("[data-feed-tick]")).toHaveAttribute("data-feed-tick", "0");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(activeTimers).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(activeTimers).toBe(1);
  await page.getByRole("link", { name: "Full comparison", exact: true }).click();
  await expect.poll(activeTimers).toBe(0);
});
