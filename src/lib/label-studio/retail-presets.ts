import {
  createDefaultLabelTemplate,
  type LabelCategory,
  type LabelSizePresetId,
} from "./label-templates.ts";
import { DEFAULT_PRINT_SETTINGS, type PrintField } from "./print-settings.ts";
export function retailPresets(workspaceId: string) {
  const specs: [
    string,
    LabelCategory,
    LabelSizePresetId,
    PrintField[],
    boolean,
  ][] = [
    [
      "Trading Card — Compact",
      "single",
      "2x1",
      ["name", "printing", "details", "price"],
      false,
    ],
    [
      "Trading Card — Standard",
      "single",
      "2_25x1_25",
      ["name", "printing", "details", "price"],
      false,
    ],
    [
      "Showcase Price Label",
      "showcase",
      "2x2",
      ["name", "printing", "details", "price"],
      true,
    ],
    ["Product Barcode", "sealed", "3x2", ["name", "price", "location"], true],
    ["Bin / Location Label", "storage", "3x2", ["location", "store"], false],
    [
      "4 × 6 Inventory / Shipping Style",
      "custom",
      "4x6",
      ["name", "printing", "details", "price", "location", "batch", "store"],
      true,
    ],
  ];
  return specs.map(
    ([name, category, sizePresetId, fields, priceEmphasis], i) => ({
      ...createDefaultLabelTemplate({
        id: `system-${i}`,
        workspaceId,
        name,
        category,
        sizePresetId,
      }),
      barcodeEnabled: true,
      qrEnabled: false,
      print: {
        useUpc: category === "sealed",
        ...structuredClone(DEFAULT_PRINT_SETTINGS),
        fields,
        fontPt: sizePresetId === "4x6" ? 14 : category === "storage" ? 12 : 7,
        border: sizePresetId === "4x6",
        priceEmphasis,
      },
    }),
  );
}
