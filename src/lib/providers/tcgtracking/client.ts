import {
  asArray,
  asObject,
  normalizeCategory,
  normalizePriceSnapshot,
  normalizeProduct,
  normalizeScanCandidate,
  normalizeSealedProduct,
  normalizeSet,
  normalizeSku,
} from "./normalization.ts";
import type {
  TcgTrackingCategory,
  TcgTrackingMeta,
  TcgTrackingPriceSnapshot,
  TcgTrackingProduct,
  TcgTrackingProviderConfig,
  TcgTrackingScanResult,
  TcgTrackingSealedProduct,
  TcgTrackingSet,
  TcgTrackingSku,
} from "./types.ts";
import {
  gameIdFromTcgTrackingCategory,
  normalizeTcgTrackingCategoryPath,
  TCGTRACKING_MAGIC_CATEGORY_ID as REGISTRY_MAGIC_CATEGORY_ID,
  TCGTRACKING_MAGIC_GAME_ID as REGISTRY_MAGIC_GAME_ID,
  TCGTRACKING_POKEMON_CATEGORY_ID as REGISTRY_POKEMON_CATEGORY_ID,
  TCGTRACKING_POKEMON_GAME_ID as REGISTRY_POKEMON_GAME_ID,
} from "../../multi-tcg/registry.ts";

export const TCGTRACKING_BASE_URL =
  "https://tcgtracking.com/tcgapi/v1";
export const TCGTRACKING_SCAN_BASE_URL =
  "https://tcgtracking.com/tcgapi/v1";
export const TCGTRACKING_DEFAULT_TIMEOUT_MS = 8000;
export const TCGTRACKING_DEFAULT_RETRIES = 1;
export const TCGTRACKING_MAGIC_CATEGORY_ID = REGISTRY_MAGIC_CATEGORY_ID;
export const TCGTRACKING_MAGIC_GAME_ID = REGISTRY_MAGIC_GAME_ID;
export const TCGTRACKING_POKEMON_CATEGORY_ID = REGISTRY_POKEMON_CATEGORY_ID;
export const TCGTRACKING_POKEMON_GAME_ID = REGISTRY_POKEMON_GAME_ID;

const productCache = new Map<string, { expiresAt: number; product: TcgTrackingProduct | null }>();

export class TcgTrackingProviderError extends Error {
  status?: number;
  endpoint: string;
  url?: string;
  method?: string;
  contentType?: string | null;
  bodyPreview?: string;

  constructor(
    message: string,
    endpoint: string,
    status?: number,
    details: {
      url?: string;
      method?: string;
      contentType?: string | null;
      bodyPreview?: string;
    } = {},
  ) {
    super(message);
    this.name = "TcgTrackingProviderError";
    this.status = status;
    this.endpoint = endpoint;
    this.url = details.url;
    this.method = details.method;
    this.contentType = details.contentType;
    this.bodyPreview = details.bodyPreview;
  }
}

export class TcgTrackingClient {
  private readonly baseUrl: string;
  private readonly scanBaseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly fetcher: typeof fetch;

  constructor(config: TcgTrackingProviderConfig = {}) {
    this.baseUrl = normalizeBaseUrl(
      config.baseUrl ??
        process.env.TCGTRACKING_API_BASE_URL ??
        TCGTRACKING_BASE_URL,
    );
    this.scanBaseUrl = normalizeBaseUrl(
      config.scanBaseUrl ??
        process.env.TCGTRACKING_SCAN_BASE_URL ??
        TCGTRACKING_SCAN_BASE_URL,
    );
    this.apiKey =
      config.apiKey ?? process.env.TCGTRACKING_API_KEY;
    this.timeoutMs =
      config.timeoutMs ?? TCGTRACKING_DEFAULT_TIMEOUT_MS;
    this.retries = config.retries ?? TCGTRACKING_DEFAULT_RETRIES;
    this.fetcher = config.fetch ?? fetch;
  }

  async meta(): Promise<TcgTrackingMeta> {
    const payload = await this.getJson("/meta");
    const object = asObject(payload) ?? {};
    return {
      provider: "tcgtracking",
      baseUrl: this.baseUrl,
      status: "available",
      version: textValue(object.version) ?? textValue(object.api_version),
      generatedAt:
        textValue(object.generated_at) ?? textValue(object.updated_at),
      rawKeys: Object.keys(object).sort(),
    };
  }

  async categories(): Promise<TcgTrackingCategory[]> {
    const payload = await this.getJson("/categories");
    return asArray(payload)
      .map(normalizeCategory)
      .filter((category): category is TcgTrackingCategory =>
        Boolean(category),
      );
  }

  async sets(category: string): Promise<TcgTrackingSet[]> {
    const payload = await this.getJson(`/${categoryPath(category)}/sets`);
    return asArray(payload)
      .map((entry) => normalizeSet(entry, category))
      .filter((set): set is TcgTrackingSet => Boolean(set));
  }

  async set(category: string, set: string): Promise<TcgTrackingSet | null> {
    const payload = await this.getJson(
      `/${categoryPath(category)}/sets/${encodePath(set)}`,
    );
    return normalizeSet(payload, category);
  }

  async cards(category: string, set: string): Promise<TcgTrackingProduct[]> {
    const payload = await this.getJson(
      `/${categoryPath(category)}/sets/${encodePath(set)}/cards`,
    );
    return asArray(payload)
      .map((entry) => normalizeProduct(entry, category))
      .filter((product): product is TcgTrackingProduct =>
        Boolean(product),
      );
  }

  async sealed(
    category: string,
    set: string,
  ): Promise<TcgTrackingSealedProduct[]> {
    const payload = await this.getJson(
      `/${categoryPath(category)}/sets/${encodePath(set)}/sealed`,
    );
    return asArray(payload)
      .map((entry) => normalizeSealedProduct(entry, category))
      .filter((product): product is TcgTrackingSealedProduct =>
        Boolean(product),
      );
  }

  async pricing(
    category: string,
    set: string,
  ): Promise<TcgTrackingPriceSnapshot[]> {
    const payload = await this.getJson(
      `/${categoryPath(category)}/sets/${encodePath(set)}/pricing`,
    );
    return flattenPricingPayload(payload)
      .map(normalizePriceSnapshot)
      .filter((snapshot): snapshot is TcgTrackingPriceSnapshot =>
        Boolean(snapshot),
      );
  }

  async skus(category: string, set: string): Promise<TcgTrackingSku[]> {
    const payload = await this.getJson(
      `/${categoryPath(category)}/sets/${encodePath(set)}/skus`,
    );
    return flattenSkuPayload(payload)
      .map(normalizeSku)
      .filter((sku): sku is TcgTrackingSku => Boolean(sku));
  }

  async product(productId: string): Promise<TcgTrackingProduct | null> {
    const cacheKey = `${this.baseUrl}|${productId.trim()}`;
    const cached = productCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.product;
    const payload = await this.getJson(
      `/products/${encodePath(productId)}`,
    );
    const object = asObject(payload);
    const product = normalizeProduct(object?.product ?? payload, "unknown");
    productCache.set(cacheKey, { expiresAt: Date.now() + 24 * 60 * 60_000, product });
    return product;
  }

  async search(
    category: string,
    query: string,
  ): Promise<TcgTrackingProduct[]> {
    const params = new URLSearchParams({ q: query });
    const payload = await this.getJson(
      `/${categoryPath(category)}/search?${params.toString()}`,
    );
    return asArray(payload)
      .map((entry) => normalizeProduct(entry, category))
      .filter((product): product is TcgTrackingProduct =>
        Boolean(product),
      );
  }

  async scanCardImage(input: {
    image: Blob | ArrayBuffer | Uint8Array | string;
    category?: string;
    gameId?: number;
    setIds?: number[];
    limit?: 5 | 10;
  }): Promise<TcgTrackingScanResult> {
    const startedAt = Date.now();
    try {
      const payload = await this.postScan(input);
      const payloadObject = asObject(payload);
      const hasCandidateList = Array.isArray(payloadObject?.results) || Array.isArray(payloadObject?.candidates);
      if (!hasCandidateList) throw new TcgTrackingProviderError("TCGTracking returned a malformed scan response.", "/scan");
      const candidates = asArray(payload)
        .map(normalizeScanCandidate)
        .filter((candidate): candidate is NonNullable<typeof candidate> =>
          Boolean(candidate),
        )
        .sort((left, right) => right.confidence - left.confidence);
      return {
        provider: "tcgtracking",
        status: candidates.length ? "matched" : "unresolved",
        gameId: input.gameId ?? gameIdFromCategory(input.category),
        setIds: normalizeNumericSetIds(input.setIds),
        candidates,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        provider: "tcgtracking",
        status: "provider_failed",
        gameId: input.gameId ?? gameIdFromCategory(input.category),
        setIds: normalizeNumericSetIds(input.setIds),
        candidates: [],
        latencyMs: Date.now() - startedAt,
        httpStatus: error instanceof TcgTrackingProviderError ? error.status : undefined,
        error:
          error instanceof Error
            ? error.message
            : "TCGTracking scan failed.",
      };
    }
  }

  private async getJson(endpoint: string) {
    return this.requestJson(endpoint, { method: "GET" });
  }

  private async postScan(input: {
    image: Blob | ArrayBuffer | Uint8Array | string;
    category?: string;
    gameId?: number;
    setIds?: number[];
    limit?: 5 | 10;
  }) {
    const headers = this.headers();
    let body: BodyInit;
    const gameId = input.gameId ?? gameIdFromCategory(input.category);
    const setIds = normalizeNumericSetIds(input.setIds);
    const limit = input.limit === 10 ? 10 : 5;

    if (typeof input.image === "string") {
      headers.set("content-type", "application/json");
      body = JSON.stringify({
        image: input.image,
        game_id: gameId,
        set_ids: setIds.length ? setIds : undefined,
        limit,
      });
    } else {
      const form = new FormData();
      const blob =
        input.image instanceof Blob
          ? input.image.type === "image/jpeg"
            ? input.image
            : new Blob([input.image], { type: "image/jpeg" })
          : new Blob([toArrayBuffer(input.image)], { type: "image/jpeg" });
      form.set("image", blob, "card.jpg");
      form.set("game_id", String(gameId));
      setIds.forEach((setId) => form.append("set_ids[]", String(setId)));
      form.set("limit", String(limit));
      body = form;
    }

    return this.requestJson(`${this.scanBaseUrl}/scan`, {
      method: "POST",
      headers,
      body,
    });
  }

  private async requestJson(
    endpoint: string,
    init: RequestInit,
  ): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await this.fetchWithTimeout(endpoint, init);
        const contentType = response.headers.get("content-type");
        const context = {
          stage: "tcgtracking-request",
          method: init.method ?? "GET",
          endpoint,
          url: this.url(endpoint),
          status: response.status,
          contentType,
        };
        console.info("TCGTracking request completed", context);
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          const bodyPreview = previewBody(body);
          console.warn("TCGTracking request failed", {
            ...context,
            bodyPreview,
          });
          throw new TcgTrackingProviderError(
            bodyPreview
              ? `TCGTracking returned HTTP ${response.status}.`
              : `TCGTracking returned HTTP ${response.status} with no response body.`,
            endpoint,
            response.status,
            {
              url: this.url(endpoint),
              method: init.method ?? "GET",
              contentType,
              bodyPreview,
            },
          );
        }
        if (!isJsonContentType(contentType)) {
          const body = await response.text().catch(() => "");
          const bodyPreview = previewBody(body);
          console.warn("TCGTracking non-JSON response", {
            ...context,
            bodyPreview,
          });
          throw new TcgTrackingProviderError(
            "TCGTracking returned a non-JSON response.",
            endpoint,
            response.status,
            {
              url: this.url(endpoint),
              method: init.method ?? "GET",
              contentType,
              bodyPreview,
            },
          );
        }
        try {
          return await response.json();
        } catch (error) {
          throw new TcgTrackingProviderError(
            error instanceof Error
              ? `TCGTracking returned invalid JSON: ${error.message}`
              : "TCGTracking returned invalid JSON.",
            endpoint,
            response.status,
            {
              url: this.url(endpoint),
              method: init.method ?? "GET",
              contentType,
            },
          );
        }
      } catch (error) {
        lastError = error;
        if (attempt >= this.retries) break;
      }
    }

    if (lastError instanceof TcgTrackingProviderError) {
      throw lastError;
    }
    throw new TcgTrackingProviderError(
      lastError instanceof Error
        ? lastError.message
        : "TCGTracking request failed.",
      endpoint,
    );
  }

  private async fetchWithTimeout(
    endpoint: string,
    init: RequestInit,
  ) {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );
    const headers = init.headers instanceof Headers
      ? init.headers
      : this.headers(init.headers);

    try {
      return await this.fetcher(this.url(endpoint), {
        ...init,
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private headers(init?: HeadersInit) {
    const headers = new Headers(init);
    headers.set("accept", "application/json");
    headers.set("user-agent", "TradingDocks-TCGTracking/1.0");
    if (this.apiKey) {
      headers.set("authorization", `Bearer ${this.apiKey}`);
    }
    return headers;
  }

  private url(endpoint: string) {
    if (/^https?:\/\//i.test(endpoint)) return endpoint;
    return `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  }
}

function toArrayBuffer(image: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (image instanceof ArrayBuffer) return image;
  const copy = new ArrayBuffer(image.byteLength);
  new Uint8Array(copy).set(image);
  return copy;
}

export function createTcgTrackingClient(
  config: TcgTrackingProviderConfig = {},
) {
  return new TcgTrackingClient(config);
}

function encodePath(value: string) {
  return encodeURIComponent(value.trim());
}

function categoryPath(value: string) {
  return encodePath(normalizeTcgTrackingCategoryPath(value));
}

function gameIdFromCategory(value: string | undefined) {
  return gameIdFromTcgTrackingCategory(value);
}

function normalizeNumericSetIds(value: number[] | undefined) {
  return Array.isArray(value)
    ? value
        .map((entry) => Math.trunc(entry))
        .filter((entry) => Number.isSafeInteger(entry) && entry > 0)
    : [];
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function isJsonContentType(contentType: string | null) {
  return contentType?.toLowerCase().includes("application/json") ?? false;
}

function previewBody(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function flattenSkuPayload(payload: unknown) {
  const array = asArray(payload);
  if (array.length) return array;

  const object = asObject(payload);
  const products = asObject(object?.products);
  if (!products) return [];

  const rows: unknown[] = [];
  for (const [productId, skuMapValue] of Object.entries(products)) {
    const skuMap = asObject(skuMapValue);
    if (!skuMap) continue;
    for (const [skuId, skuValue] of Object.entries(skuMap)) {
      const sku = asObject(skuValue);
      if (!sku) continue;
      rows.push({
        product_id: productId,
        tcgplayer_product_id: Number(productId),
        sku_id: skuId,
        tcgplayer_sku_id: Number(skuId),
        updated_at: textValue(object?.updated),
        ...sku,
      });
    }
  }
  return rows;
}

function flattenPricingPayload(payload: unknown) {
  const array = asArray(payload);
  if (array.length) return array;

  const object = asObject(payload);
  const prices = asObject(object?.prices);
  if (!prices) return [];

  const rows: unknown[] = [];
  for (const [productId, priceValue] of Object.entries(prices)) {
    const price = asObject(priceValue);
    const tcg = asObject(price?.tcg);
    if (!tcg) continue;
    const manapool = asObject(price?.manapool);
    for (const [finish, finishValue] of Object.entries(tcg)) {
      const finishPrice = asObject(finishValue);
      if (!finishPrice) continue;
      const normalizedFinish = finish.toLowerCase();
      rows.push({
        product_id: productId,
        tcgplayer_product_id: Number(productId),
        sku_id: `${productId}:${finish}`,
        variant: finish,
        market_price: finishPrice.market,
        low_price: finishPrice.low,
        high_price: finishPrice.high,
        listing_count: price?.mp_qty,
        manapool_low: normalizedFinish === "foil"
          ? manapool?.foil
          : manapool?.normal,
        updated_at: textValue(object?.updated),
      });
    }
  }
  return rows;
}
