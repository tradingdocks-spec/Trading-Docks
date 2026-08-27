import type { AccountTier } from "@/lib/plan-entitlements";

export type TopbarCreateActionId =
  | "add-inventory-card"
  | "create-deck"
  | "create-storage-location"
  | "create-marketplace-listing"
  | "record-store-expense";

export type TopbarCreateAction = {
  id: TopbarCreateActionId;
  label: string;
  href: string;
  minimum: AccountTier;
};

const rank: Record<AccountTier, number> = {
  free: 0,
  collector: 1,
  seller: 2,
  store: 3,
};

export const topbarCreateActions: TopbarCreateAction[] = [
  {
    id: "add-inventory-card",
    label: "Add inventory",
    href: "/dashboard/inventory/import",
    minimum: "free",
  },
  {
    id: "create-deck",
    label: "Create deck",
    href: "/dashboard/deck-vault/new",
    minimum: "free",
  },
  {
    id: "create-storage-location",
    label: "Create binder or box",
    href: "/dashboard/inventory?section=storage&create=location",
    minimum: "collector",
  },
  {
    id: "create-marketplace-listing",
    label: "Create marketplace listing",
    href: "/dashboard/marketplaces",
    minimum: "seller",
  },
  {
    id: "record-store-expense",
    label: "Record store expense",
    href: "/dashboard/finances",
    minimum: "store",
  },
];

export function getTopbarCreateActions(plan: AccountTier) {
  return topbarCreateActions.filter((item) => rank[plan] >= rank[item.minimum]);
}
