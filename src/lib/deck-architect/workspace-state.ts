import type { BuildIntentId, CollectionGraphCard } from "./types.ts";

export type CommanderSelectionSource = "owned" | "potential" | "none";

export type CommanderSelectionState = {
  commander: CollectionGraphCard | null;
  source: CommanderSelectionSource;
  owned: boolean;
};

export type DeckArchitectBuildBlocker =
  | "empty-collection"
  | "commander-required"
  | "strategy-required"
  | "unowned-commander-collection-only";

export function resolveDeckArchitectCommanderSelection({
  selectedCommanderId,
  ownedCommanders,
  potentialCommander,
}: {
  selectedCommanderId: string | null;
  ownedCommanders: CollectionGraphCard[];
  potentialCommander: CollectionGraphCard | null;
}): CommanderSelectionState {
  if (potentialCommander && selectedCommanderId === potentialCommander.inventoryId) {
    return {
      commander: potentialCommander,
      source: "potential",
      owned: potentialCommander.quantityOwned > 0,
    };
  }

  const ownedCommander = ownedCommanders.find((card) => card.inventoryId === selectedCommanderId) ?? null;
  if (ownedCommander) {
    return {
      commander: ownedCommander,
      source: "owned",
      owned: ownedCommander.quantityOwned > 0,
    };
  }

  return {
    commander: null,
    source: "none",
    owned: false,
  };
}

export function getDeckArchitectBuildBlocker({
  hasCollection,
  formatRequiresCommander,
  selectedCommander,
  selectedCommanderOwned,
  strategySelectionComplete,
  intentId,
}: {
  hasCollection: boolean;
  formatRequiresCommander: boolean;
  selectedCommander: CollectionGraphCard | null;
  selectedCommanderOwned: boolean;
  strategySelectionComplete: boolean;
  intentId: BuildIntentId;
}): DeckArchitectBuildBlocker | null {
  if (!hasCollection) return "empty-collection";
  if (!formatRequiresCommander) return null;
  if (!selectedCommander) return "commander-required";
  if (!strategySelectionComplete) return "strategy-required";
  if (intentId === "no-purchases" && !selectedCommanderOwned) return "unowned-commander-collection-only";
  return null;
}

