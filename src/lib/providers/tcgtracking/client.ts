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

export const TCGTRACKING_BASE_URL =
  "https://openapi.tcgtracking.com/v1";
export const TCGTRACKING_DEFAULT_TIMEOUT_MS = 8000;
export const TCGTRACKING_DEFAULT_RETRIES = 1;

export class TcgTrackingProviderError extends Error {
  status?: number;
  endpoint: string;

  constructor(
    message: string,
    endpoint: string,
    status?: number,
  ) {
    super(message);
    this.name = "TcgTrackingProviderError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export class TcgTrackingClient {
  private readonly baseUrl: string;
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
    const payload = await this.getJson(`/${encodePath(category)}/sets`);
    return asArray(payload)
      .map((entry) => normalizeSet(entry, category))
      .filter((set): set is TcgTrackingSet => Boolean(set));
  }

  async set(category: string, set: string): Promise<TcgTrackingSet | null> {
    const payload = await this.getJson(
      `/${encodePath(category)}/sets/${encodePath(set)}`,
    );
    return normalizeSet(payload, category);
  }

  async cards(category: string, set: string): Promise<TcgTrackingProduct[]> {
    const payload = await this.getJson(
      `/${encodePath(category)}/sets/${encodePath(set)}/cards`,
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
      `/${encodePath(category)}/sets/${encodePath(set)}/sealed`,
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
      `/${encodePath(category)}/sets/${encodePath(set)}/pricing`,
    );
    return asArray(payload)
      .map(normalizePriceSnapshot)
      .filter((snapshot): snapshot is TcgTrackingPriceSnapshot =>
        Boolean(snapshot),
      );
  }

  async skus(category: string, set: string): Promise<TcgTrackingSku[]> {
    const payload = await this.getJson(
      `/${encodePath(category)}/sets/${encodePath(set)}/skus`,
    );
    return asArray(payload)
      .map(normalizeSku)
      .filter((sku): sku is TcgTrackingSku => Boolean(sku));
  }

  async product(productId: string): Promise<TcgTrackingProduct | null> {
    const payload = await this.getJson(
      `/products/${encodePath(productId)}`,
    );
    return normalizeProduct(payload, "unknown");
  }

  async search(
    category: string,
    query: string,
  ): Promise<TcgTrackingProduct[]> {
    const params = new URLSearchParams({ q: query });
    const payload = await this.getJson(
      `/${encodePath(category)}/search?${params.toString()}`,
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
  }): Promise<TcgTrackingScanResult> {
    const startedAt = Date.now();
    try {
      const payload = await this.postScan(input);
      const candidates = asArray(payload)
        .map(normalizeScanCandidate)
        .filter((candidate): candidate is NonNullable<typeof candidate> =>
          Boolean(candidate),
        )
        .sort((left, right) => right.confidence - left.confidence);
      return {
        provider: "tcgtracking",
        status: candidates.length ? "matched" : "unresolved",
        candidates,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        provider: "tcgtracking",
        status: "provider_failed",
        candidates: [],
        latencyMs: Date.now() - startedAt,
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
  }) {
    const headers = this.headers();
    let body: BodyInit;

    if (typeof input.image === "string") {
      headers.set("content-type", "application/json");
      body = JSON.stringify({
        image: input.image,
        category: input.category,
      });
    } else {
      const form = new FormData();
      const blob =
        input.image instanceof Blob
          ? input.image
          : new Blob([toArrayBuffer(input.image)], { type: "image/jpeg" });
      form.set("image", blob, "card.jpg");
      if (input.category) form.set("category", input.category);
      body = form;
    }

    return this.requestJson("/scan", {
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
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new TcgTrackingProviderError(
            body || `TCGTracking returned HTTP ${response.status}.`,
            endpoint,
            response.status,
          );
        }
        return response.json();
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

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}
