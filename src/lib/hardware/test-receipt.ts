import type { Receipt } from "../pos/domain.ts";
/** Print-only fixture. Never enters the sales, payment or inventory ledgers. */
export function hardwareTestReceipt(): Receipt {
  return {
    version: 2,
    number: "TEST-ONLY-NOT-A-SALE",
    site: "Trading Docks printer test",
    register: "80 mm alignment check",
    actorId: "",
    createdAt: "2026-09-21T12:00:00Z",
    timezone: "UTC",
    currency: "USD",
    settings: {
      receiptWidth: "80",
      footer:
        "TEST ONLY — no sale, payment or inventory movement.\nCheck alignment, feed and cutter.",
      showEmployee: false,
      showSku: true,
    },
    lines: [
      {
        itemId: "test-only",
        name: "Sample item — print alignment",
        sku: "TEST-001",
        quantity: 1,
        unitPriceMinor: 100,
        discountMinor: 0,
        taxMinor: 0,
        lineTotalMinor: 100,
        setCode: null,
        collectorNumber: null,
        condition: null,
        finish: null,
        language: null,
        locationId: "",
      },
    ],
    subtotalMinor: 100,
    discountMinor: 0,
    taxMinor: 0,
    totalMinor: 100,
    cashMinor: 100,
    changeMinor: 0,
  };
}
