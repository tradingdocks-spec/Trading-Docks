export type TcgCsvCategory = {
  categoryId: number;
  name: string;
  displayName?: string;
  sealedLabel?: string | null;
  nonSealedLabel?: string | null;
  modifiedOn?: string;
};

export type TcgCsvGroup = {
  groupId: number;
  name: string;
  abbreviation?: string;
  categoryId: number;
  publishedOn?: string;
  modifiedOn?: string;
};

export type TcgCsvExtendedData = {
  name: string;
  displayName?: string;
  value: string;
};

export type TcgCsvProduct = {
  productId: number;
  name: string;
  cleanName?: string | null;
  imageUrl?: string | null;
  categoryId: number;
  groupId: number;
  url?: string | null;
  modifiedOn?: string;
  imageCount?: number;
  presaleInfo?: {
    isPresale?: boolean;
    releasedOn?: string | null;
    note?: string | null;
  } | null;
  extendedData?: TcgCsvExtendedData[];
};

export type TcgCsvPrice = {
  productId: number;
  lowPrice?: number | null;
  midPrice?: number | null;
  highPrice?: number | null;
  marketPrice?: number | null;
  directLowPrice?: number | null;
  subTypeName?: string | null;
};

export type SealedProductSearchResult = {
  productId: number;
  categoryId: number;
  categoryName: string;
  groupId: number;
  groupName: string;
  name: string;
  cleanName: string;
  productType: string;
  imageUrl: string;
  productUrl: string;
  marketPrice: number;
  lowPrice: number;
  midPrice: number;
  directLowPrice: number;
  priceSubtype: string;
  allPrices: TcgCsvPrice[];
  isPresale: boolean;
  releasedOn: string | null;
  modifiedOn: string | null;
  dataSource: "TCGCSV";
};

export type SealedSearchResponse = {
  query: string;
  category: string;
  updatedAt: string;
  sourceUpdatedAt?: string | null;
  scannedGroups: number;
  results: SealedProductSearchResult[];
};
