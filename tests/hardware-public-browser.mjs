// Run against the credential-free local Next production build, never a live deployment.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const base = "http://127.0.0.1:4317";
const affiliates = process.argv.includes("--affiliates");
const browser = await chromium.launch({ channel: "chrome", headless: true });
mkdirSync(".local-fixtures/hardware-browser", { recursive: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/hardware");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Trading Docks Compatible Hardware",
      }),
    ).toBeVisible();
    await expect(page.locator("article")).toHaveCount(7);
    await expect(page.locator("article [data-tier=TESTED]")).toHaveCount(0);
    await expect(
      page.getByText("As an Amazon Associate", { exact: false }),
    ).toHaveCount(affiliates ? 4 : 0);
    await expect(
      page
        .locator("#zebra-ds2208")
        .getByText("Reference SKU: DS2208-SR7U2100SGW"),
    ).toBeVisible();
    const amazon = page
      .locator("#zebra-ds2208")
      .getByRole("link", { name: /View current price on Amazon/ });
    assert.equal(
      (await amazon.getAttribute("rel")).includes("sponsored"),
      affiliates,
    );
    assert.equal(
      await page.locator("link[rel=canonical]").getAttribute("href"),
      "https://www.tradingdocks.com/hardware",
    );
    await page.locator("article").last().scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page
          .locator("article img")
          .evaluateAll(
            (xs) => xs.filter((x) => x.complete && x.naturalWidth > 0).length,
          ),
      )
      .toBe(4);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `.local-fixtures/hardware-browser/public-${width}.png`,
      fullPage: true,
    });
    if (width === 390) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(
        page.getByRole("button", { name: "Close navigation" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Open navigation" }),
      ).toBeFocused();
    }
  }
  for (const slug of [
    "zebra-ds2208",
    "zebra-zd421",
    "epson-tm-t20iv",
    "square-terminal",
    "betckey-2x1",
    "betckey-2-25x1-25",
    "thermalino-80mm-230ft",
  ]) {
    await page.goto(`${base}/hardware/${slug}`);
    await expect(
      page.getByRole("heading", { name: "Set up and test in Trading Docks" }),
    ).toBeVisible();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    const r = await page.request.get(
      `${base}/hardware/out/${slug}?source=pos_onboarding&url=https://evil.test`,
      { maxRedirects: 0 },
    );
    assert.equal(r.status(), 302);
    const asins = {
      "zebra-ds2208": "B06VYGFGR7",
      "betckey-2x1": "B072B9VR1K",
      "betckey-2-25x1-25": "B0CT5B6632",
      "thermalino-80mm-230ft": "B0D6K6LNCD",
    };
    const supplies = page.getByRole("region", {
      name: "Compatible consumables",
    });
    const expected =
      slug === "zebra-zd421"
        ? ["betckey-2x1", "betckey-2-25x1-25"]
        : slug === "epson-tm-t20iv"
          ? ["thermalino-80mm-230ft"]
          : [];
    assert.deepEqual(
      await supplies
        .locator("article")
        .evaluateAll((xs) => xs.map((x) => x.id)),
      expected,
    );
    if (asins[slug]) {
      assert.equal(
        r.headers().location,
        `https://www.amazon.com/dp/${asins[slug]}` +
          (affiliates ? "?tag=tradingdocks-20" : ""),
      );
    } else {
      assert.ok(
        ["www.zebra.com", "epson.com", "squareup.com"].includes(
          new URL(r.headers().location).hostname,
        ),
      );
      assert.ok(!r.headers().location.includes("tag="));
    }
    assert.equal(r.headers()["cache-control"], "no-store");
  }
  assert.equal(
    (await page.request.get(base + "/hardware/missing")).status(),
    404,
  );
  assert.equal(
    (
      await page.request.get(
        base + "/hardware/out/missing?url=https://evil.test",
      )
    ).status(),
    404,
  );
  const protectedRoute = await page.request.get(
    base + "/dashboard/pos/hardware/test-receipt",
    { maxRedirects: 0 },
  );
  assert.ok([302, 307].includes(protectedRoute.status()));
  assert.match(protectedRoute.headers().location, /sign-in/);
  const sitemap = await (await page.request.get(base + "/sitemap.xml")).text();
  assert.match(sitemap, /\/hardware\/zebra-ds2208/);
  await page.goto(base + "/");
  await expect(
    page.getByRole("link", { name: "Hardware", exact: true }).first(),
  ).toBeAttached();
  assert.deepEqual(errors, []);
  console.log(
    "PASS built public page, 4 images, 7 guides and printer supply associations, mobile nav/focus, no overflow/errors, metadata/sitemap, fixed outbound redirects, receipt auth and homepage navigation",
  );
} finally {
  await browser.close();
}
