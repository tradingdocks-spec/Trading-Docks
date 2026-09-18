import type { ListingCandidate, ListingReadinessCode } from "./types";

export type ReadinessInput = Pick<ListingCandidate, "listingPrice" | "condition" | "inventoryItemId" | "quantity" | "cardName"> & {
  marketplaceSelected?: boolean;
  categorySelected?: boolean;
  shippingPolicySelected?: boolean;
  imageAvailable?: boolean;
  duplicateDetected?: boolean;
  alreadyListed?: boolean;
};

export function evaluateListingReadiness(input: ReadinessInput): { code: ListingReadinessCode; message: string } {
  if (input.alreadyListed) return { code: "ALREADY_LISTED", message: "This inventory is already represented by an active listing." };
  if (input.duplicateDetected) return { code: "DUPLICATE_LISTING", message: "A matching marketplace listing already exists; review before publishing." };
  if (!input.marketplaceSelected) return { code: "NEEDS_MATCH_REVIEW", message: "Choose at least one marketplace destination." };
  if (!input.inventoryItemId || input.quantity < 1) return { code: "NEEDS_MATCH_REVIEW", message: "The candidate is not linked to available physical inventory." };
  if (!input.cardName.trim()) return { code: "NEEDS_MATCH_REVIEW", message: "Card identity is incomplete." };
  if (!input.condition) return { code: "NEEDS_CONDITION", message: "Add a condition before publishing." };
  if (input.listingPrice == null || input.listingPrice <= 0) return { code: "NEEDS_PRICE", message: "Set a listing price before publishing." };
  if (!input.categorySelected) return { code: "NEEDS_CATEGORY", message: "Choose a marketplace category." };
  if (!input.shippingPolicySelected) return { code: "NEEDS_SHIPPING_POLICY", message: "Choose a shipping policy." };
  if (!input.imageAvailable) return { code: "NEEDS_IMAGE", message: "Add or approve an image for this marketplace." };
  return { code: "READY", message: "Candidate is ready for deliberate publishing." };
}
