import assert from "node:assert/strict";
import test from "node:test";

import {
  clearInventorySelection,
  selectAllInventoryItems,
  summarizeInventorySelection,
  toggleInventorySelection,
  uniqueSelection,
} from "../src/lib/label-studio/selection.ts";
import {
  createDefaultLabelTemplate,
  paginateLabels,
  renderLabel,
} from "../src/lib/label-studio/label-templates.ts";

const items = [
  { id: "item-1", card: { name: "One" }, inventory: { sku: "TD-1" } },
  { id: "item-2", card: { name: "Two" }, inventory: { sku: "TD-2" } },
  { id: "item-3", card: { name: "Three" }, inventory: { sku: "TD-3" } },
];

test("Label Studio Select All selects every eligible inventory record once", () => {
  assert.deepEqual(selectAllInventoryItems(items), ["item-1", "item-2", "item-3"]);
  assert.deepEqual(uniqueSelection(["item-1", "item-1", "item-2"]), ["item-1", "item-2"]);
});

test("Label Studio Clear Selection selects none", () => {
  assert.deepEqual(clearInventorySelection(), []);
});

test("Label Studio partial card selection remains deduplicated", () => {
  const selected = toggleInventorySelection(["item-1"], "item-2", true);
  assert.deepEqual(selected, ["item-1", "item-2"]);
  assert.deepEqual(toggleInventorySelection(selected, "item-1", false), ["item-2"]);
  assert.deepEqual(toggleInventorySelection(["item-2", "item-2"], "item-2", true), ["item-2"]);
});

test("Label Studio selected count reports none partial and all states", () => {
  assert.deepEqual(summarizeInventorySelection(items, []), {
    totalCount: 3,
    selectedCount: 0,
    allSelected: false,
    partiallySelected: false,
  });
  assert.deepEqual(summarizeInventorySelection(items, ["item-1"]), {
    totalCount: 3,
    selectedCount: 1,
    allSelected: false,
    partiallySelected: true,
  });
  assert.deepEqual(summarizeInventorySelection(items, ["item-1", "item-2", "item-3"]), {
    totalCount: 3,
    selectedCount: 3,
    allSelected: true,
    partiallySelected: false,
  });
});

test("Label Studio printing respects current selection and page count recalculates", () => {
  const template = createDefaultLabelTemplate({
    id: "template-1",
    workspaceId: "workspace-1",
    name: "Shelf labels",
    category: "single",
    sizePresetId: "2x1",
  });
  const selectedIds = ["item-1", "item-3"];
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const labels = selectedItems.map((item) => renderLabel(template, item));

  assert.equal(labels.length, 2);
  assert.deepEqual(labels.map((label) => label.elements.find((element) => element.id === "name")?.value), [
    "One",
    "Three",
  ]);
  assert.equal(paginateLabels(labels, 1).length, 2);
});
