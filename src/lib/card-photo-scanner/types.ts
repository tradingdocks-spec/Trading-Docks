export type ScanIdentification = {
  name: string;
  setCode?: string | null;
  collectorNumber?: string | null;
  language?: string | null;
  finish?: string | null;
  confidence: number;
  notes?: string[];
  gameId?: "magic" | "pokemon";
  provider?: "scryfall" | "tcgtracking";
};

export type PricePoint = {
  label: string;
  value: number | null;
  currency: string;
  source: string;
  available: boolean;
  url?: string | null;
  note?: string | null;
};

export type CardCandidate = {
  id: string;
  name: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  language: string;
  finishes: string[];
  rarity?: string | null;
  imageUrl?: string | null;
  scryfallUrl?: string | null;
  gameId?: "magic" | "pokemon";
  provider?: "scryfall" | "tcgtracking";
  providerCategoryId?: string | null;
  providerProductId?: string | null;
  providerSkuId?: string | null;
  tcgplayerProductId?: number | null;
  tcgplayerSkuId?: number | null;
  skuOptions?: Array<{
    providerSkuId: string;
    tcgplayerSkuId: number | null;
    condition: string;
    variant: string;
    language: string;
    marketPrice: number | null;
    lowPrice: number | null;
    highPrice: number | null;
    activeListings: number | null;
  }>;
  exactSkuRequired?: boolean;
  confidence: number;
  prices: PricePoint[];
};

export type CardScanResponse = {
  identification: ScanIdentification;
  candidates: CardCandidate[];
  recognitionMode: "vision" | "manual" | "filename" | "tcgtracking" | "ocr_catalog";
  recognitionMethod?: "OCR_CATALOG" | "COLLECTOR_NUMBER" | "IMAGE_MATCH" | "OPENAI_FALLBACK" | "MANUAL";
  warnings: string[];
  pricingCoverage: {
    checked: number;
    available: number;
    sources: Array<{
      name: string;
      status: "available" | "connection_required" | "planned";
    }>;
  };
};
