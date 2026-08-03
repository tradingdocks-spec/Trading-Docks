export type CollectorProfile = {
  id?: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
  location: string | null;
  preferred_games: string[];
  theme: string;
  is_public: boolean;
  show_collection_value: boolean;
  show_location: boolean;
  featured_binder_id: string | null;
};

export type PortfolioBinder = {
  id: string;
  user_id: string;
  location_id: string;
  slug: string;
  title: string;
  description: string;
  cover_type: string;
  cover_url: string | null;
  cover_color: string;
  accent_color: string;
  visibility: "private" | "unlisted" | "public";
  portfolio_order: number;
  is_featured: boolean;
  is_trade_binder: boolean;
  show_values: boolean;
  show_conditions: boolean;
  show_finishes: boolean;
  show_pocket_locations: boolean;
  favorite_page: number | null;
};

export type PortfolioInventoryLocation = {
  id: string;
  name: string;
  type: string;
  description?: string;
  binderColumns?: number;
  binderRows?: number;
  binderPages?: number;
};

export type PortfolioInventoryItem = {
  id: string;
  name: string;
  quantity: number;
  locationId: string;
  value: number;
  unitMarketValue?: number;
  imageUrl?: string;
  set?: string;
  condition?: string;
  finish?: string;
  binderPage?: number;
  binderSlot?: string;
};

export type PortfolioBinderView = PortfolioBinder & {
  location: PortfolioInventoryLocation;
  cards: PortfolioInventoryItem[];
  cardCount: number;
  estimatedValue: number;
  occupiedPockets: number;
  pageCount: number;
};

export function slugifyPortfolioValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "binder";
}

export function sanitizeUsername(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 30);
}
