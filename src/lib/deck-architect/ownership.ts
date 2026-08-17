import { isCommanderEligible, maximumCopiesForCard } from "./formats.ts";
import type {
  CollectionGraphCard,
  DeckRequirement,
  FormatProfile,
  OwnershipMatch,
} from "./types.ts";

export function normalizeCardKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildCollectionQuantityIndex(collection: CollectionGraphCard[]) {
  const index = new Map<string, CollectionGraphCard[]>();
  for (const card of collection) {
    const key = normalizeCardKey(card.name);
    const current = index.get(key) ?? [];
    current.push(card);
    index.set(key, current);
  }
  return index;
}

export function compareRequirementsToCollection(
  requirements: DeckRequirement[],
  collection: CollectionGraphCard[],
  format: FormatProfile,
) {
  const index = buildCollectionQuantityIndex(collection);

  return requirements.map((requirement): OwnershipMatch => {
    const ownedRecords = index.get(normalizeCardKey(requirement.name)) ?? [];
    const ownedQuantity = ownedRecords.reduce((sum, card) => sum + Math.max(0, card.quantityOwned), 0);
    const requiredQuantity = Math.min(
      requirement.requiredQuantity,
      maximumCopiesForCard(format, requirement.name),
    );
    const missingQuantity = Math.max(0, requiredQuantity - ownedQuantity);
    const status = missingQuantity === 0 ? "owned" : ownedQuantity > 0 ? "partial" : "missing";
    const estimatedMissingValue =
      requirement.estimatedPrice === null || requirement.estimatedPrice === undefined
        ? null
        : Number((requirement.estimatedPrice * missingQuantity).toFixed(2));

    return {
      requirement: { ...requirement, requiredQuantity },
      ownedQuantity,
      missingQuantity,
      status,
      ownedRecords,
      estimatedMissingValue,
    };
  });
}

export function findOwnedCommanderCandidates(collection: CollectionGraphCard[]) {
  return collection
    .filter((card) => card.quantityOwned > 0 && isCommanderEligible(card))
    .sort((left, right) => right.quantityOwned - left.quantityOwned || left.name.localeCompare(right.name));
}
