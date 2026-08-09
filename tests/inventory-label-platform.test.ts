import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInventorySku,
  buildQrToken,
  generateInventorySku,
  isTradingDocksSku,
  resolveQrView,
  sanitizePublicQrView,
  skuSortKey,
} from "../src/lib/label-studio/inventory-identity.ts";
import {
  LABEL_BINDINGS,
  LABEL_SIZE_PRESETS,
  applyPricingRule,
  createDefaultLabelTemplate,
  paginateLabels,
  renderLabel,
  validateLabelTemplate,
} from "../src/lib/label-studio/label-templates.ts";
import { buildBulkLabelRenderJob, detectRepricingVariance } from "../src/lib/label-studio/label-workflow.ts";
import {
  buildPosCartItemContract,
  classifyPosLookupInput,
  POS_REPRINT_LABEL_STUDIO_HREF,
} from "../src/lib/label-studio/pos-identity.ts";
import { LABEL_STUDIO_ROUTE, labelStudioHref } from "../src/lib/label-studio/routes.ts";
import { clientAccessFromTier, hasCapability } from "../mobile/services/platform-access.ts";
import { hasRouteAccess } from "../src/lib/platform/route-access.ts";

const predictableBytes = (seed: number) => (length: number) =>
  Uint8Array.from({ length }, (_, index) => (seed + index * 17) % 256);

const target = {
  workspaceId: "workspace-1",
  inventoryItemId: "item-1",
  targetType: "single" as const,
};

test("inventory SKU generation is public-safe QR and barcode compatible", () => {
  const sku = generateInventorySku(predictableBytes(3));

  assert.match(sku, /^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(isTradingDocksSku(sku), true);
  assert.equal(isTradingDocksSku("db-item-1"), false);
});

test("inventory identity remains workspace scoped", () => {
  const sku = buildInventorySku(target, predictableBytes(7));
  const otherSku = buildInventorySku({ ...target, workspaceId: "workspace-2" }, predictableBytes(7));

  assert.equal(sku.value, otherSku.value);
  assert.notEqual(skuSortKey(sku.workspaceId, sku.value), skuSortKey(otherSku.workspaceId, otherSku.value));
});

test("QR tokens resolve to public-sanitized views unless employee workspace matches", () => {
  const qr = buildQrToken(target, predictableBytes(11));
  const resolved = {
    token: qr.token,
    sku: "TD-A7K4-92XM",
    workspaceId: "workspace-1",
    targetType: "single" as const,
    itemName: "Unblinking Observer",
    cardName: "Unblinking Observer",
    setCode: "MID",
    collectorNumber: "82",
    condition: "Near Mint",
    finish: "Nonfoil",
    askingPrice: 1.99,
    marketPrice: 1.63,
    locationLabel: "Showcase > Tray 2",
    costBasis: 0.72,
    internalCustomerId: "customer-secret",
    privateNotes: "hold for staff",
  };

  assert.equal(qr.route, `/q/${qr.token}`);
  const publicView = sanitizePublicQrView(resolved);
  assert.equal("costBasis" in publicView, false);
  assert.equal("privateNotes" in publicView, false);
  assert.equal(publicView.askingPrice, 1.99);

  const wrongWorkspace = resolveQrView(resolved, {
    kind: "employee",
    workspaceId: "workspace-2",
    permissions: ["inventory.read", "pos.sell"],
  });
  assert.equal("allowedActions" in wrongWorkspace, false);

  const employeeView = resolveQrView(resolved, {
    kind: "employee",
    workspaceId: "workspace-1",
    permissions: ["inventory.read", "storage.move", "pos.sell", "inventory.audit", "card_show.sell"],
  });
  assert.deepEqual(employeeView.allowedActions, [
    "inventory.open",
    "storage.move",
    "pos.add_to_cart",
    "audit.mark_present",
    "card_show.add_to_sale",
  ]);
});

test("label template presets and dynamic bindings cover initial categories", () => {
  assert.deepEqual(LABEL_SIZE_PRESETS.map((preset) => preset.name), [
    "1 x .5",
    "1 x 1",
    "1.5 x 1",
    "2 x 1",
    "2.25 x 1.25",
    "2 x 2",
    "3 x 2",
    "4 x 2",
    "Custom",
  ]);
  assert.equal(LABEL_BINDINGS.includes("card.collector_number"), true);
  assert.equal(LABEL_BINDINGS.includes("inventory.sku"), true);
  assert.equal(LABEL_BINDINGS.includes("sealed.product_name"), true);
});

test("default single and sealed labels render live inventory data", () => {
  const single = createDefaultLabelTemplate({
    id: "single-template",
    workspaceId: "workspace-1",
    name: "Single",
    category: "single",
  });
  const sealed = createDefaultLabelTemplate({
    id: "sealed-template",
    workspaceId: "workspace-1",
    name: "Sealed",
    category: "sealed",
  });
  const data = {
    card: { name: "Ledger Shredder", set: "SNC", collector_number: "46" },
    inventory: {
      asking_price: 8.99,
      market_price: 8.2,
      sku: "TD-A7K4-92XM",
      location: "Box A > Row 2",
    },
    sealed: { product_name: "Modern Horizons 3 Bundle" },
    workspace: { name: "Trading Docks" },
  };

  assert.equal(validateLabelTemplate(single).ok, true);
  assert.equal(renderLabel(single, data).elements.find((element) => element.id === "name")?.value, "Ledger Shredder");
  assert.equal(renderLabel(sealed, data).elements.find((element) => element.id === "name")?.value, "Modern Horizons 3 Bundle");
});

test("pricing rules preview repricing without overwriting inventory price", () => {
  assert.equal(
    applyPricingRule({ mode: "market_percentage", percentage: 90, rounding: "ending_99", minimumPrice: 1 }, 10, 12),
    8.99,
  );
  assert.equal(
    applyPricingRule({ mode: "market_percentage", percentage: 100, rounding: "nearest_dollar" }, 1.49, 2),
    1,
  );
  assert.equal(applyPricingRule({ mode: "none" }, 5, 4.5), 4.5);
});

test("bulk label generation supports hundreds of labels and pagination", () => {
  const template = createDefaultLabelTemplate({
    id: "card-show",
    workspaceId: "workspace-1",
    name: "Card Show",
    category: "card_show",
  });
  const items = Array.from({ length: 205 }, (_, index) => ({
    card: { name: `Card ${index}` },
    inventory: { asking_price: 1.99, market_price: 1.5, sku: `TD-A7K4-${String(index).padStart(4, "0")}` },
  }));
  const job = buildBulkLabelRenderJob(template, { workspaceId: "workspace-1", mode: "card_show", items });
  const pages = paginateLabels(job, 100);

  assert.equal(job.length, 205);
  assert.deepEqual(pages.map((page) => page.labels.length), [100, 100, 5]);
});

test("repricing variance flags labels outside configurable threshold", () => {
  const result = detectRepricingVariance([
    { inventory: { sku: "TD-A7K4-92XM", asking_price: 20, market_price: 10 } },
    { inventory: { sku: "TD-A7K4-92XN", asking_price: 10.5, market_price: 10 } },
  ], 20);

  assert.equal(result[0].actionRequired, true);
  assert.equal(result[1].actionRequired, false);
});

test("future POS lookup accepts Trading Docks QR SKU UPC barcode scanner and search inputs", () => {
  assert.equal(classifyPosLookupInput({ kind: "manual_search", value: "https://www.tradingdocks.com/q/abc123", workspaceId: "workspace-1" }), "trading_docks_qr");
  assert.equal(classifyPosLookupInput({ kind: "manual_search", value: "TD-A7K4-92XM", workspaceId: "workspace-1" }), "trading_docks_sku");
  assert.equal(classifyPosLookupInput({ kind: "manual_search", value: "012345678905", workspaceId: "workspace-1" }), "upc");

  assert.deepEqual(buildPosCartItemContract({
    source: "trading_docks_sku",
    workspaceId: "workspace-1",
    itemName: "Ledger Shredder",
    unitPrice: 8.99,
    inventorySku: "TD-A7K4-92XM",
  }), {
    source: "trading_docks_sku",
    workspaceId: "workspace-1",
    inventorySku: "TD-A7K4-92XM",
    inventoryItemId: null,
    sealedProductId: null,
    itemName: "Ledger Shredder",
    quantity: 1,
    unitPrice: 8.99,
    allowedAction: "pos.add_to_cart",
  });
});

test("Label Studio permissions come from shared platform access", () => {
  const collector = clientAccessFromTier("collector");
  const sellerMember = clientAccessFromTier("seller", { workspaceRole: "member" });
  const sellerManager = clientAccessFromTier("seller", { workspaceRole: "manager" });

  assert.equal(hasCapability(collector, "label.view"), false);
  assert.equal(hasCapability(sellerMember, "label.print"), true);
  assert.equal(hasCapability(sellerMember, "label.manage_templates"), false);
  assert.equal(hasCapability(sellerManager, "label.manage_templates"), true);
  assert.equal(hasRouteAccess(sellerMember, "/dashboard/label-studio"), true);
});

test("Label Studio has one canonical route with contextual entry links", () => {
  assert.equal(LABEL_STUDIO_ROUTE, "/dashboard/label-studio");
  assert.equal(labelStudioHref(), "/dashboard/label-studio");
  assert.equal(
    labelStudioHref("inventory", "print-labels"),
    "/dashboard/label-studio?source=inventory&mode=print-labels",
  );
  assert.equal(
    labelStudioHref("card-shows", "show-labels"),
    "/dashboard/label-studio?source=card-shows&mode=show-labels",
  );
  assert.equal(
    labelStudioHref("sealed-inventory", "print-labels"),
    "/dashboard/label-studio?source=sealed-inventory&mode=print-labels",
  );
  assert.equal(POS_REPRINT_LABEL_STUDIO_HREF, "/dashboard/label-studio?source=pos&mode=reprint-label");
  assert.equal(
    labelStudioHref("inventory", "print-labels", ["item-1", "item-1", "../bad", "item-2"]),
    "/dashboard/label-studio?source=inventory&mode=print-labels&ids=item-1%2Citem-2",
  );
});
