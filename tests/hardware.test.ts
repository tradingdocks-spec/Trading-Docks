import test from "node:test";
import assert from "node:assert/strict";
import {
  activeHardware,
  hardwareCatalog,
  certificationFor,
  certifications,
  isConsumable,
  relatedConsumables,
} from "../src/lib/hardware/catalog.ts";
import {
  approvedUrl,
  amazonUrl,
  purchaseLink,
  purchaseEvent,
  hardwareSource,
  defaultDisclosure,
} from "../src/lib/hardware/links.ts";
import { hardwareTestReceipt } from "../src/lib/hardware/test-receipt.ts";
import { renderReceipt } from "../src/lib/pos/receipt.ts";
import { readHardwareAffiliateConfig } from "../src/lib/hardware/affiliate-config.ts";
const off = { enabled: false, disclosure: defaultDisclosure };
const on = { ...off, enabled: true, amazonTag: "fixture-20" };
test("only approved DS2208 ASIN maps to an exact reference; other configurations retain official links", () => {
  const config = readHardwareAffiliateConfig({
    HARDWARE_AFFILIATES_ENABLED: "true",
  });
  const scanner = hardwareCatalog.find((item) => item.id === "zebra-ds2208")!;
  assert.equal(scanner.referenceSku, "DS2208-SR7U2100SGW");
  assert.equal(
    scanner.purchase?.destination,
    "https://www.amazon.com/dp/B06VYGFGR7",
  );
  assert.equal(
    purchaseLink(scanner, config)?.url,
    "https://www.amazon.com/dp/B06VYGFGR7?tag=tradingdocks-20",
  );
  assert.equal(purchaseLink(scanner, config)?.affiliate, true);
  assert.equal(purchaseLink(scanner, off)?.url, scanner.purchase?.destination);
  assert.deepEqual(
    activeHardware()
      .filter((item) => !isConsumable(item) && item.purchase?.active)
      .map((item) => item.id),
    ["zebra-ds2208"],
  );
  const printer = hardwareCatalog.find((item) => item.id === "zebra-zd421")!;
  assert.equal(printer.referenceSku, "ZD4A042-D01E00EZ");
  assert.deepEqual(printer.connections, ["USB", "USB Host", "Ethernet"]);
  assert.equal(
    hardwareCatalog.find((item) => item.id === "epson-tm-t20iv")!.referenceSku,
    "C31CL47002",
  );
  for (const item of activeHardware().filter(
    (item) => !isConsumable(item) && item.id !== scanner.id,
  )) {
    assert.equal(item.purchase, undefined);
    assert.equal(purchaseLink(item, config)?.url, item.manufacturerUrl);
    assert.equal(purchaseLink(item, config)?.affiliate, false);
  }
  assert.ok(!JSON.stringify(hardwareCatalog).includes("B09DTKNSVB"));
});

test("approved Associate ID is centralized and activation stays explicit", () => {
  const disabled = readHardwareAffiliateConfig({});
  assert.equal(disabled.amazonTag, "tradingdocks-20");
  assert.equal(disabled.enabled, false);
  const enabled = readHardwareAffiliateConfig({
    HARDWARE_AFFILIATES_ENABLED: "true",
  });
  const link = amazonUrl("https://www.amazon.com/dp/B012345678?th=1", enabled)!;
  assert.equal(new URL(link.url).searchParams.get("tag"), "tradingdocks-20");
  assert.equal(new URL(link.url).searchParams.get("th"), "1");
  assert.equal(link.affiliate, true);
  assert.equal(enabled.disclosure, defaultDisclosure);
  assert.equal(amazonUrl(link.url, disabled)!.affiliate, false);
  assert.equal(
    new URL(amazonUrl(link.url, disabled)!.url).searchParams.has("tag"),
    false,
  );
  assert.ok(
    activeHardware()
      .filter((item) => !isConsumable(item) && item.id !== "zebra-ds2208")
      .every(
        (item) => purchaseLink(item, enabled)?.retailer === "MANUFACTURER",
      ),
  );
  assert.equal(
    purchaseLink(
      hardwareCatalog.find((item) => item.id === "square-terminal")!,
      enabled,
    )?.url,
    "https://squareup.com/us/en/hardware/terminal",
  );
  assert.equal(
    readHardwareAffiliateConfig({
      AMAZON_ASSOCIATE_TAG: " override-20 ",
      HARDWARE_AFFILIATE_DISCLOSURE: "Reviewed disclosure",
    }).amazonTag,
    "override-20",
  );
});
test("receipt test reuses print renderer and clearly identifies sample amounts", () => {
  const receipt = hardwareTestReceipt();
  const html = renderReceipt(receipt);
  assert.match(html, /TEST-ONLY-NOT-A-SALE/);
  assert.match(html, /no sale, payment or inventory movement/);
  assert.equal(receipt.totalMinor, receipt.lines[0].lineTotalMinor);
  assert.match(html, /window.print/);
});
test("one active reference per initial category, no physical tested claim, stable slugs", () => {
  assert.equal(activeHardware().length, 7);
  assert.equal(new Set(hardwareCatalog.map((i) => i.slug)).size, 7);
  for (const item of hardwareCatalog) {
    assert.equal(
      certificationFor(item),
      isConsumable(item) ? "COMPATIBLE" : "PENDING_TEST",
    );
    assert.ok(approvedUrl(item.manufacturerUrl));
    assert.ok(item.setup.length);
  }
  assert.equal(
    activeHardware([{ ...hardwareCatalog[0], active: false }]).length,
    0,
  );
});
test("tested requires complete exact-model evidence; tiers remain distinct", () => {
  const item = { ...hardwareCatalog[0], certification: "TESTED" as const };
  assert.equal(certificationFor(item), "PENDING_TEST");
  assert.equal(
    certificationFor({
      ...item,
      evidence: {
        testedAt: "2026-09-21",
        version: "test",
        browser: "Chrome",
        os: "Windows",
        notes: "exact USB model",
        report: "approved report",
      },
    }),
    "TESTED",
  );
  assert.equal(
    new Set(Object.values(certifications).map((c) => c.label)).size,
    4,
  );
});
test("affiliate enabled preserves query and replaces prior tag; disabled removes monetization", () => {
  const input = "https://www.amazon.com/dp/B012345678?th=1&psc=1&tag=old-20";
  const yes = amazonUrl(input, on)!;
  assert.equal(yes.affiliate, true);
  assert.equal(new URL(yes.url).searchParams.get("tag"), "fixture-20");
  assert.equal(new URL(yes.url).searchParams.get("th"), "1");
  for (const config of [
    off,
    { ...on, amazonTag: undefined },
    { ...on, amazonTag: "bad tag" },
  ]) {
    const no = amazonUrl(input, config)!;
    assert.equal(no.affiliate, false);
    assert.equal(new URL(no.url).searchParams.has("tag"), false);
  }
});
test("retailer validation rejects executable, lookalike, redirect and credential destinations", () => {
  for (const u of [
    "javascript:alert(1)",
    "http://amazon.com/dp/B012345678",
    "https://amazon.com.evil.test/dp/B012345678",
    "https://amazon.com@evil.test/dp/B012345678",
    "https://user@amazon.com/dp/B012345678",
    "https://amazon.com:444/dp/B012345678",
    "https://amazon.com/gp/redirect.html?url=https://evil.test",
    "https://amzn.to/abc",
    "not a url",
  ])
    assert.equal(amazonUrl(u, on), null, u);
});
test("missing/invalid/inactive Amazon destination uses manufacturer without affiliate disclosure", () => {
  const item = { ...hardwareCatalog[0], purchase: undefined };
  assert.equal(purchaseLink(item, on)?.retailer, "MANUFACTURER");
  for (const destination of ["https://evil.test/", "javascript:alert(1)"])
    assert.equal(
      purchaseLink(
        {
          ...item,
          purchase: {
            retailer: "AMAZON_US",
            destination,
            active: true,
            region: "US",
          },
        },
        on,
      )?.affiliate,
      false,
    );
  assert.equal(
    purchaseLink(
      {
        ...item,
        purchase: {
          retailer: "AMAZON_US",
          destination: "https://amazon.com/dp/B012345678",
          active: false,
          region: "US",
        },
      },
      on,
    )?.retailer,
    "MANUFACTURER",
  );
  assert.equal(
    purchaseLink({ ...item, manufacturerUrl: "https://evil.test/" }, off),
    null,
  );
});
test("event contains only catalog dimensions and a bounded source, no personal data", () => {
  const event = purchaseEvent(
    hardwareCatalog[0],
    "MANUFACTURER",
    hardwareSource("pos_onboarding"),
  );
  assert.equal(event.event, "hardware_purchase_click");
  assert.equal(event.source_page, "pos_onboarding");
  assert.equal(event.certification_status, "PENDING_TEST");
  assert.equal(
    hardwareSource("https://evil.test/?email=private"),
    "public_hardware",
  );
  assert.equal(Object.keys(event).length, 8);
});

test("approved consumables preserve identity, printer association and safe fallback", () => {
  const config = readHardwareAffiliateConfig({
    HARDWARE_AFFILIATES_ENABLED: "true",
  });
  const expected = {
    "betckey-2x1": "B072B9VR1K",
    "betckey-2-25x1-25": "B0CT5B6632",
    "thermalino-80mm-230ft": "B0D6K6LNCD",
  };
  for (const [id, asin] of Object.entries(expected)) {
    const item = hardwareCatalog.find((i) => i.id === id)!;
    assert.equal(certificationFor(item), "COMPATIBLE");
    assert.equal(
      item.purchase?.destination,
      `https://www.amazon.com/dp/${asin}`,
    );
    assert.equal(
      purchaseLink(item, config)?.url,
      `https://www.amazon.com/dp/${asin}?tag=tradingdocks-20`,
    );
    const fallback = purchaseLink(
      { ...item, purchase: { ...item.purchase!, active: false } },
      config,
    )!;
    assert.equal(fallback.url, item.manufacturerUrl);
    assert.equal(fallback.affiliate, false);
    assert.equal(fallback.label, item.fallbackLabel);
    assert.equal(item.recommended, false);
  }
  assert.deepEqual(
    relatedConsumables("zebra-zd421").map((i) => i.id),
    ["betckey-2x1", "betckey-2-25x1-25"],
  );
  assert.deepEqual(
    relatedConsumables("epson-tm-t20iv").map((i) => i.id),
    ["thermalino-80mm-230ft"],
  );
  assert.deepEqual(relatedConsumables("zebra-ds2208"), []);
  assert.deepEqual(
    relatedConsumables(
      "zebra-zd421",
      hardwareCatalog.map((i) => ({ ...i, active: false })),
    ),
    [],
  );
});
