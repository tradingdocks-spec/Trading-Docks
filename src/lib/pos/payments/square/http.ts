import { SQUARE_API_VERSION, SQUARE_BASE_URL } from "./config.ts";
import type { PaymentState, RefundAttempt } from "../domain.ts";
export type SquareObject = Record<string, unknown>;
export function object(value: unknown): SquareObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SquareObject)
    : {};
}
export function paymentStatus(status: unknown): PaymentState {
  return (
    (
      {
        COMPLETED: "SUCCEEDED",
        APPROVED: "AUTHORIZED",
        PENDING: "PENDING",
        CANCELED: "CANCELED",
        FAILED: "FAILED",
      } as Record<string, PaymentState>
    )[String(status)] ?? "UNKNOWN"
  );
}
export function refundStatus(status: unknown) {
  return (
    (
      {
        COMPLETED: "SUCCEEDED",
        PENDING: "PENDING",
        REJECTED: "FAILED",
        FAILED: "FAILED",
      } as Record<string, RefundAttempt["status"]>
    )[String(status)] ?? "UNKNOWN"
  );
}
export function safeSquareMetadata(payment: SquareObject) {
  const card = object(object(payment.card_details).card);
  return {
    ...(object(payment.card_details).refund_requires_card_presence === true ? { refundRequiresCardPresence: true } : {}),
    environment: "SANDBOX",
    verification: "Square Sandbox",
    locationId:
      typeof payment.location_id === "string"
        ? payment.location_id.slice(0, 100)
        : undefined,
    brand:
      typeof card.card_brand === "string"
        ? card.card_brand.slice(0, 30)
        : undefined,
    last4:
      typeof card.last_4 === "string" && /^\d{4}$/.test(card.last_4)
        ? card.last_4
        : undefined,
  };
}
export class SquareHttp {
  fetcher: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  constructor(
    fetcher: typeof fetch = fetch,
    sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {
    this.fetcher = fetcher;
    this.sleep = sleep;
  }
  async request(
    path: string,
    token: string | undefined,
    body?: SquareObject,
    authorizationPrefix = "Bearer",
  ): Promise<SquareObject> {
    if (!/^\/(v2|oauth2)\/[a-zA-Z0-9/_%:-]+(?:\?[a-zA-Z0-9%_=&.+-]+)?$/.test(path))
      throw Error("CONFIGURATION_ERROR");
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await this.fetcher(SQUARE_BASE_URL + path, {
          method: body ? "POST" : "GET",
          headers: {
            "Square-Version": SQUARE_API_VERSION,
            "Content-Type": "application/json",
            ...(token
              ? { Authorization: `${authorizationPrefix} ${token}` }
              : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(12000),
          cache: "no-store",
          redirect: "error",
        });
      } catch {
        throw Error("NETWORK_ERROR");
      }
      const result = object(await response.json().catch(() => ({})));
      if (response.ok) return result;
      const retry = response.headers.get("retry-after");
      const delay = retry
        ? /^\d+$/.test(retry)
          ? Number(retry) * 1000
          : Date.parse(retry) - Date.now()
        : 250 * 2 ** attempt;
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < 2 &&
        delay <= 3000
      ) {
        await this.sleep(Math.max(100, delay));
        continue;
      }
      const errors = Array.isArray(result.errors)
        ? result.errors.map(object)
        : [];
      if (
        result.error === "invalid_grant" ||
        errors.some((e) =>
          [
            "ACCESS_TOKEN_EXPIRED",
            "ACCESS_TOKEN_REVOKED",
            "UNAUTHORIZED",
            "INVALID_GRANT",
          ].includes(String(e.code)),
        )
      )
        throw Error("UNAUTHORIZED_PROVIDER_ACCOUNT");
      if (response.status === 401 || response.status === 403)
        throw Error("UNAUTHORIZED_PROVIDER_ACCOUNT");
      if (errors.some((e) => e.code === "DEVICE_BUSY")) throw Error("DEVICE_BUSY");
      if (errors.some((e) => ["DEVICE_OFFLINE", "DEVICE_UNAVAILABLE"].includes(String(e.code)))) throw Error("DEVICE_UNAVAILABLE");
      if (errors.some((e) => e.category === "PAYMENT_METHOD_ERROR"))
        throw Error("DECLINED");
      if (response.status === 429 || response.status >= 500)
        throw Error("TEMPORARY_ERROR");
      throw Error("CONFIGURATION_ERROR");
    }
    throw Error("TEMPORARY_ERROR");
  }
}
