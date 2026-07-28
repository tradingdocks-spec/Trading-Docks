export type Condition = "NM" | "LP" | "MP" | "HP" | "DMG";
export type PriceFinish = "nonfoil" | "foil" | "etched";
export type OfferMode = "safe" | "balanced" | "aggressive" | "custom";

export type ParsedCardLine = {
  raw: string;
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  finish: PriceFinish;
  condition: Condition;
};

export type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  reserved: boolean;
  reprint: boolean;
  released_at?: string;
  edhrec_rank?: number;
  penny_rank?: number;
  prices: {
    usd: string | null;
    usd_foil: string | null;
    usd_etched: string | null;
  };
  image_uris?: {
    small?: string;
    normal?: string;
  };
  card_faces?: Array<{
    image_uris?: {
      small?: string;
      normal?: string;
    };
  }>;
  purchase_uris?: {
    tcgplayer?: string;
    cardmarket?: string;
    cardhoarder?: string;
  };
};

export type AppraisalCard = ParsedCardLine & {
  rowId: string;
  status: "pending" | "loading" | "ready" | "error";
  error?: string;
  card?: ScryfallCard;
  unitMarket: number;
  conditionMultiplier: number;
  adjustedUnitValue: number;
  lineMarketValue: number;
  suggestedPercent: number;
  ownedQuantity: number;
};

export type BuyingSettings = {
  offerMode: OfferMode;
  customOfferPercent: number;
  feePercent: number;
  shippingPerOrder: number;
  averageCardsPerOrder: number;
  laborPerCard: number;
  targetMarginPercent: number;
  cashAdjustmentPercent: number;
  storeCreditBonusPercent: number;
  minimumPricedCard: number;
};

export type SavedAppraisal = {
  id: string;
  customerName: string;
  customerContact: string;
  employeeName: string;
  notes: string;
  createdAt: string;
  status: "draft" | "offered" | "accepted" | "declined";
  settings: BuyingSettings;
  cards: AppraisalCard[];
};
