export type LabelStudioSelectionSummary = {
  totalCount: number;
  selectedCount: number;
  allSelected: boolean;
  partiallySelected: boolean;
};

export function uniqueSelection(ids: readonly string[]) {
  return [...new Set(ids.filter(Boolean))];
}

export function selectAllInventoryItems(items: readonly { id: string }[]) {
  return uniqueSelection(items.map((item) => item.id));
}

export function clearInventorySelection() {
  return [];
}

export function toggleInventorySelection(
  selectedIds: readonly string[],
  itemId: string,
  checked: boolean,
) {
  if (!itemId) return uniqueSelection(selectedIds);
  return checked
    ? uniqueSelection([...selectedIds, itemId])
    : selectedIds.filter((id) => id !== itemId);
}

export function summarizeInventorySelection(
  items: readonly { id: string }[],
  selectedIds: readonly string[],
): LabelStudioSelectionSummary {
  const eligibleIds = new Set(items.map((item) => item.id));
  const selectedCount = uniqueSelection(selectedIds).filter((id) => eligibleIds.has(id)).length;
  const totalCount = eligibleIds.size;
  return {
    totalCount,
    selectedCount,
    allSelected: totalCount > 0 && selectedCount === totalCount,
    partiallySelected: selectedCount > 0 && selectedCount < totalCount,
  };
}
