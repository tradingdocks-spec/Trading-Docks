export type ScanIdentification = {
  name: string;
  setCode?: string | null;
  collectorNumber?: string | null;
  language?: string | null;
  finish?: "nonfoil" | "foil" | "etched" | "unknown";
  confidence: number;
  notes?: string[];
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
  imageUrl?: string | null;
  scryfallUrl?: string | null;
  confidence: number;
  prices: PricePoint[];
};

export type CardScanResponse = {
  identification: ScanIdentification;
  candidates: CardCandidate[];
  recognitionMode: "vision" | "manual" | "filename";
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
