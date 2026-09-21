export type Certification =
  "PENDING_TEST" | "TESTED" | "COMPATIBLE" | "BEST_EFFORT";
export type HardwareCategory =
  | "scanner"
  | "label_printer"
  | "receipt_printer"
  | "terminal"
  | "cash_drawer"
  | "accessory"
  | "label_stock"
  | "receipt_paper";
export type HardwareSource =
  "public_hardware" | "pos_onboarding" | "pos_hardware";
export const categories: Record<HardwareCategory, string> = {
  scanner: "Barcode Scanners",
  label_printer: "Label Printers",
  receipt_printer: "Receipt Printers",
  terminal: "Payment Terminals",
  cash_drawer: "Cash Drawers",
  accessory: "Accessories",
  label_stock: "Label Stock",
  receipt_paper: "Receipt Paper",
};
export const certifications: Record<
  Certification,
  { label: string; description: string }
> = {
  PENDING_TEST: {
    label: "Physical testing pending",
    description:
      "Selected for our reference counter. Exact-model physical acceptance is still pending.",
  },
  TESTED: {
    label: "Trading Docks Tested",
    description:
      "This exact configuration has completed Trading Docks physical acceptance.",
  },
  COMPATIBLE: {
    label: "Compatible",
    description:
      "Uses supported standards and is expected to work; full physical acceptance is incomplete.",
  },
  BEST_EFFORT: {
    label: "Best Effort",
    description:
      "May work, but is not officially validated. Confirm your workflow before buying.",
  },
};
export interface Hardware {
  id: string;
  slug: string;
  category: HardwareCategory;
  manufacturer: string;
  model: string;
  referenceSku?: string;
  relatedHardwareIds?: string[];
  fallbackLabel?: string;
  displayName: string;
  certification: Certification;
  recommended: boolean;
  active: boolean;
  sortOrder: number;
  connections: string[];
  capabilities: string[];
  description: string;
  rationale: string;
  compatibilityNotes: string[];
  setup: string[];
  troubleshooting: string[];
  manufacturerUrl: string;
  image?: string;
  imageAlt: string;
  purchase?: {
    retailer: "AMAZON_US";
    destination: string;
    active: boolean;
    region: "US";
  };
  testAction: { label: string; href: string };
  createdAt: string;
  updatedAt: string;
  evidence?: {
    testedAt: string;
    version: string;
    browser: string;
    os: string;
    notes: string;
    report: string;
  };
}
const common = {
  certification: "PENDING_TEST" as const,
  active: true,
  recommended: true,
  createdAt: "2026-09-21",
  updatedAt: "2026-09-21",
};
export const hardwareCatalog: readonly Hardware[] = [
  {
    ...common,
    id: "zebra-ds2208",
    slug: "zebra-ds2208",
    category: "scanner",
    manufacturer: "Zebra",
    model: "DS2208",
    referenceSku: "DS2208-SR7U2100SGW",
    purchase: {
      retailer: "AMAZON_US",
      destination: "https://www.amazon.com/dp/B06VYGFGR7",
      active: true,
      region: "US",
    },
    displayName: "Zebra DS2208",
    sortOrder: 10,
    connections: ["USB keyboard-wedge"],
    capabilities: ["Code 128", "UPC / EAN", "QR / 2D", "Enter suffix"],
    description: "Wired scanning for card labels and retail barcodes.",
    rationale:
      "One counter scanner for both linear barcodes and QR labels, using keyboard input.",
    compatibilityNotes: [
      "Select a USB kit with the correct host cable. Configure keyboard-wedge mode and an Enter suffix.",
      "A decoded code confirms input only; it does not certify inventory matching or physical scan reliability.",
    ],
    setup: [
      "Connect the USB host cable and configure keyboard-wedge mode using Zebraâ€™s guide.",
      "Set an Enter suffix. Open POS â†’ Hardware and focus the dedicated scanner input.",
      "Scan Code 128 and QR labels, then check exact inventory resolution in the register. Test repeated, unknown and damaged labels before the pilot.",
    ],
    troubleshooting: [
      "If nothing appears, confirm the cable, USB port and keyboard mode.",
      "If scans do not finish, check the Enter suffix and input focus.",
    ],
    manufacturerUrl:
      "https://www.zebra.com/us/en/products/scanners/general-purpose-handheld-scanners/ds2200-series/ds2208.html",
    image:
      "https://www.zebra.com/content/dam/zebra_dam/global/zcom-web-production/web-production-photography/product-cards/model/ds2208-3x2-3600.jpg",
    imageAlt: "Zebra DS2208 manufacturer product photograph",
    testAction: {
      label: "Test Scanner",
      href: "/dashboard/pos/hardware#scanner-test",
    },
  },
  {
    ...common,
    id: "zebra-zd421",
    slug: "zebra-zd421",
    category: "label_printer",
    manufacturer: "Zebra",
    model: "ZD421 Â· Direct Thermal Â· 203 dpi",
    referenceSku: "ZD4A042-D01E00EZ",
    displayName: "Zebra ZD421",
    sortOrder: 20,
    connections: ["USB", "USB Host", "Ethernet"],
    capabilities: [
      "Direct thermal",
      "203 dpi",
      '2" Ã— 1"',
      '2.25" Ã— 1.25"',
      '4" Ã— 6"',
    ],
    description: "A reference label printer for trading card inventory.",
    rationale:
      "Matches the small card-label and larger media presets already available in Label Studio.",
    compatibilityNotes: [
      "Reference SKU ZD4A042-D01E00EZ: Direct Thermal, 203 dpi, USB/USB Host/Ethernet. Do not substitute ZD4A042-D0EM00EZ; any separately certified variant requires its own catalog record.",
      "Printing currently uses the browser/PDF and installed driver. Direct ZPL delivery is future work, not an implemented integration.",
    ],
    setup: [
      "Install the manufacturer driver, load direct-thermal media and calibrate the sensor.",
      'Open Label Studio and match the preset to the actual roll: 2" Ã— 1", 2.25" Ã— 1.25", or 4" Ã— 6".',
      "Use Print Test Label at actual size with browser headers/footers off. Check one label, then a batch and scan-back to the exact inventory item.",
    ],
    troubleshooting: [
      "For offset or blank labels, recalibrate media and check driver page size.",
      "For unreadable bars, check print darkness, resolution and scaling; do not use fit-to-page.",
    ],
    manufacturerUrl:
      "https://www.zebra.com/us/en/products/printers/desktop/zd400-series/zd421.html",
    image:
      "https://www.zebra.com/content/dam/zebra_dam/global/zcom-web-production/web-production-photography/product-cards/model/zd421-3x2-3600.jpg",
    imageAlt:
      "Zebra ZD421 series manufacturer photograph; verify Direct Thermal SKU",
    testAction: {
      label: "Print Test Label",
      href: "/dashboard/label-studio?source=pos",
    },
  },
  {
    ...common,
    id: "epson-tm-t20iv",
    slug: "epson-tm-t20iv",
    category: "receipt_printer",
    manufacturer: "Epson",
    model: "TM-T20IV Â· USB + Ethernet SKU",
    referenceSku: "C31CL47002",
    displayName: "Epson TM-T20IV",
    sortOrder: 30,
    connections: ["USB", "Ethernet on selected SKU"],
    capabilities: ["80 mm receipt", "Auto cutter", "Drawer connector"],
    description: "Thermal receipt printing for the checkout counter.",
    rationale:
      "An 80 mm reference printer with a cutter and a choice of host connections.",
    compatibilityNotes: [
      "Verify the USB + Serial + Ethernet configuration (US C31CL47002); interfaces vary by SKU.",
      "Browser printing uses the installed driver. Automatic cutting depends on driver settings. Cash drawer control is future work.",
    ],
    setup: [
      "Install the Epson driver and connect over USB or the supported network interface.",
      "Load 80 mm thermal paper and select the same paper width in the receipt print workflow.",
      "Open a test sale receipt in POS history and choose Print. Verify totals, alignment, feed/cutter and reprint. Printing must not create another sale.",
    ],
    troubleshooting: [
      "For clipped receipts, match browser and driver width and remove page margins.",
      "For blank output, check thermal paper orientation and print an operating-system test page.",
    ],
    manufacturerUrl:
      "https://epson.com/For-Work/Printers/POS/TM-T20IV-Thermal-Receipt-Printer/p/C31CL47002",
    image:
      "https://mediaserver.goepson.com/adaptivemedia/rendition?id=fc5e8299eea172e0ae9cb0f9a21b9c9115ac6559&vid=fc5e8299eea172e0ae9cb0f9a21b9c9115ac6559&prid=1200Wx1200H&clid=SAPDAM&prclid=banner&assetDescr=TM-T20IV_left-receipt2_690x460%402x",
    imageAlt: "Epson TM-T20IV manufacturer product photograph",
    testAction: {
      label: "Print Test Receipt",
      href: "/dashboard/pos/hardware/test-receipt",
    },
  },
  {
    ...common,
    id: "square-terminal",
    slug: "square-terminal",
    category: "terminal",
    manufacturer: "Square",
    model: "Square Terminal",
    displayName: "Square Terminal",
    sortOrder: 40,
    connections: ["Wi-Fi", "Ethernet with supported accessory"],
    capabilities: [
      "Terminal API",
      "Payment status recovery",
      "Built-in receipt printer",
    ],
    description: "Customer-facing payments through the Square Terminal API.",
    rationale:
      "Uses the existing Trading Docks Square connection, location mapping and register assignment.",
    compatibilityNotes: [
      "Requested reference: Square Terminal v2. Squareâ€™s current public page names Square Terminal; verify the exact revision with Square before purchase. No v2 certification is claimed.",
      "Software and Sandbox acceptance do not certify physical hardware. Square hardware cannot be used in Sandbox.",
      "Trading Docks is independent; Square does not endorse this recommendation.",
    ],
    setup: [
      "Have an owner connect Square in POS â†’ Payments and map the storeâ€™s Square location.",
      "In POS â†’ Hardware, use the existing Terminal pairing and register-assignment workflow in an approved supported environment.",
      "Complete the physical payment, cancellation, interruption and refund acceptance sheet before the pilot. Never connect a production merchant solely to bypass Sandbox limitations.",
    ],
    troubleshooting: [
      "Check merchant, location and register assignment if a device is unavailable.",
      "For an unresolved checkout, reconcile the existing attempt before starting another payment.",
    ],
    manufacturerUrl: "https://squareup.com/us/en/hardware/terminal",
    image:
      "https://images.ctfassets.net/2d5q1td6cyxq/5a3Hyi2cUpp8tbZ5U19x4a/27b8ed1445ef9a178b60699f08dbc4aa/Terminal.png",
    imageAlt:
      "Square Terminal official product photograph; hardware revision unverified",
    testAction: {
      label: "Set up Square Terminal",
      href: "/dashboard/pos/hardware#terminal-setup",
    },
  },
  {
    id: "betckey-2x1",
    slug: "betckey-2x1",
    category: "label_stock",
    manufacturer: "BETCKEY",
    model: '2" × 1" Direct Thermal Labels',
    displayName: 'BETCKEY 2" × 1" Labels',
    certification: "COMPATIBLE",
    active: true,
    recommended: false,
    sortOrder: 100,
    relatedHardwareIds: ["zebra-zd421"],
    connections: [],
    capabilities: [
      '2" × 1"',
      "Direct thermal",
      '1" core',
      "Approx. 1,300 labels/roll",
    ],
    description: "For standard trading-card barcode/price labels.",
    rationale: "Matches the corresponding Trading Docks Label Studio preset.",
    compatibilityNotes: [
      "Intended for Zebra / Rollo-compatible direct thermal printers. Exact fit and physical acceptance on Zebra ZD421 are pending.",
      "Check roll outer diameter, core fit and sensor calibration before use; family compatibility does not certify every printer.",
    ],
    setup: [
      "Load the roll in the intended printer and calibrate its media sensor.",
      'Select the 2" × 1" preset in Label Studio, then print one test label at actual size.',
      "Check alignment and scan back to the exact inventory item before printing a batch.",
    ],
    troubleshooting: [
      "Check media size and disable fit-to-page if printing is clipped or offset.",
      "Recalibrate the sensor if labels skip or feed blank.",
    ],
    manufacturerUrl: "https://betckey.com/",
    fallbackLabel: "Browse BETCKEY media",
    imageAlt: "",
    purchase: {
      retailer: "AMAZON_US",
      destination: "https://www.amazon.com/dp/B072B9VR1K",
      active: true,
      region: "US",
    },
    testAction: {
      label: "Print Test Label",
      href: "/dashboard/label-studio?source=pos",
    },
    createdAt: "2026-09-21",
    updatedAt: "2026-09-21",
  },
  {
    id: "betckey-2-25x1-25",
    slug: "betckey-2-25x1-25",
    category: "label_stock",
    manufacturer: "BETCKEY",
    model: '2.25" × 1.25" Direct Thermal Labels',
    displayName: 'BETCKEY 2.25" × 1.25" Labels',
    certification: "COMPATIBLE",
    active: true,
    recommended: false,
    sortOrder: 101,
    relatedHardwareIds: ["zebra-zd421"],
    connections: [],
    capabilities: [
      '2.25" × 1.25"',
      "Direct thermal",
      '1" core',
      "Approx. 1,000 labels/roll",
    ],
    description: "For larger trading-card/showcase barcode labels.",
    rationale: "Matches the corresponding Trading Docks Label Studio preset.",
    compatibilityNotes: [
      "Intended for Zebra / Rollo-compatible direct thermal printers. Exact fit and physical acceptance on Zebra ZD421 are pending.",
      "Check roll outer diameter, core fit and sensor calibration before use; family compatibility does not certify every printer.",
    ],
    setup: [
      "Load the roll in the intended printer and calibrate its media sensor.",
      'Select the 2.25" × 1.25" preset in Label Studio, then print one test label at actual size.',
      "Check alignment and scan back to the exact inventory item before printing a batch.",
    ],
    troubleshooting: [
      "Check media size and disable fit-to-page if printing is clipped or offset.",
      "Recalibrate the sensor if labels skip or feed blank.",
    ],
    manufacturerUrl: "https://betckey.com/",
    fallbackLabel: "Browse BETCKEY media",
    imageAlt: "",
    purchase: {
      retailer: "AMAZON_US",
      destination: "https://www.amazon.com/dp/B0CT5B6632",
      active: true,
      region: "US",
    },
    testAction: {
      label: "Print Test Label",
      href: "/dashboard/label-studio?source=pos",
    },
    createdAt: "2026-09-21",
    updatedAt: "2026-09-21",
  },
  {
    id: "thermalino-80mm-230ft",
    slug: "thermalino-80mm-230ft",
    category: "receipt_paper",
    manufacturer: "Thermalino",
    model: "3 1/8\" × 230' Thermal Receipt Paper",
    displayName: "Thermalino 80 mm Receipt Paper",
    certification: "COMPATIBLE",
    active: true,
    recommended: false,
    sortOrder: 110,
    relatedHardwareIds: ["epson-tm-t20iv"],
    connections: [],
    capabilities: [
      '3 1/8" / approx. 80 mm',
      "230 ft",
      "Direct thermal",
      "BPA-free / BPS-free",
    ],
    description: "Receipt paper for the Epson TM-T20IV counter setup.",
    rationale:
      "Matches the 80 mm receipt workflow; physical validation on TM-T20IV is pending.",
    compatibilityNotes: [
      "Intended for Epson TM-T20 series / standard 80 mm thermal receipt printers. Confirm roll diameter and fit in your exact printer.",
      "Specifications, including BPA-free / BPS-free, are owner-supplied product claims, not independently tested by Trading Docks.",
      "No separate Thermalino paper-brand site is verified. The fallback opens Epson printer/media guidance, not a substitute Thermalino product.",
    ],
    setup: [
      "Load the roll in the TM-T20IV with the thermal surface correctly oriented.",
      "Open Print Test Receipt and choose the 80 mm printer configuration.",
      "Check readable output, complete totals, feed/cutter and reprint before the pilot.",
    ],
    troubleshooting: [
      "For blank receipts, check paper orientation.",
      "For clipping, match the driver width and remove browser margins.",
    ],
    manufacturerUrl:
      "https://epson.com/For-Work/Printers/POS/TM-T20IV-Thermal-Receipt-Printer/p/C31CL47002",
    fallbackLabel: "Epson printer & media guidance",
    imageAlt: "",
    purchase: {
      retailer: "AMAZON_US",
      destination: "https://www.amazon.com/dp/B0D6K6LNCD",
      active: true,
      region: "US",
    },
    testAction: {
      label: "Print Test Receipt",
      href: "/dashboard/pos/hardware/test-receipt",
    },
    createdAt: "2026-09-21",
    updatedAt: "2026-09-21",
  },
];
export function activeHardware(catalog: readonly Hardware[] = hardwareCatalog) {
  return catalog
    .filter((item) => item.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
export function certificationFor(item: Hardware): Certification {
  // A status edit alone must never manufacture physical certification.
  if (item.certification !== "TESTED") return item.certification;
  const required: (keyof NonNullable<Hardware["evidence"]>)[] = [
    "testedAt",
    "version",
    "browser",
    "os",
    "notes",
    "report",
  ];
  return required.every((key) => Boolean(item.evidence?.[key]?.trim()))
    ? "TESTED"
    : "PENDING_TEST";
}

export function isConsumable(item: Hardware) {
  return item.category === "label_stock" || item.category === "receipt_paper";
}
export function relatedConsumables(
  hardwareId: string,
  catalog: readonly Hardware[] = hardwareCatalog,
) {
  return activeHardware(catalog).filter(
    (item) =>
      isConsumable(item) && item.relatedHardwareIds?.includes(hardwareId),
  );
}
