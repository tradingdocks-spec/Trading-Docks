import type { Receipt } from "../domain.ts";
export type ProviderId =
  | "CASH"
  | "MOCK"
  | "EXTERNAL"
  | "SQUARE"
  | "STRIPE_TERMINAL";
export const paymentStates = [
  "CREATED",
  "PENDING",
  "AWAITING_CUSTOMER",
  "PROCESSING",
  "AUTHORIZED",
  "SUCCEEDED",
  "DECLINED",
  "FAILED",
  "CANCELED",
  "TIMED_OUT",
  "UNKNOWN",
  "REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;
export type PaymentState = (typeof paymentStates)[number];
export const mockOutcomes = [
  "APPROVE",
  "DECLINE",
  "CANCEL",
  "TIMEOUT",
  "DELAYED_SUCCESS",
  "UNKNOWN_THEN_SUCCESS",
  "UNKNOWN_THEN_DECLINE",
] as const;
export type MockOutcome = (typeof mockOutcomes)[number];
export type Payment = {
  id: string;
  checkoutId: string;
  provider: ProviderId;
  status: PaymentState;
  amountMinor: number;
  currency: string;
  providerReference?: string;
  metadata: SafeMetadata;
  createdAt: string;
  completedAt?: string;
  reconciledAt?: string;
  saleState:
    | "PAYABLE"
    | "PAYING"
    | "FINALIZING"
    | "COMPLETED"
    | "RECOVERY_REQUIRED"
    | "VOIDED";
  saleId?: string;
  receipt?: Receipt;
  failureCode?: string;
  refunds: {
    id: string;
    status: string;
    amountMinor: number;
    refundId?: string;
    recoveryRequired: boolean;
  }[];
};
export type SafeMetadata = {
  brand?: string;
  last4?: string;
  verification?: string;
  method?: string;
};
export type ProviderAccount = {
  id: string;
  workspaceId: string;
  provider: ProviderId;
  externalAccountId: string;
  displayName: string;
  status: "CONNECTED" | "DISCONNECTED";
  credentialReference: string;
};
export type ProviderLocation = {
  provider: ProviderId;
  externalId: string;
  siteId: string;
};
export type PaymentDevice = {
  provider: ProviderId;
  externalId: string;
  workspaceId: string;
  siteId: string;
  registerId?: string;
  displayName: string;
  status: "READY" | "UNAVAILABLE";
  lastSeenAt?: string;
};
export type ProviderCapabilities = {
  cardPresent: boolean;
  refund: boolean;
  partialRefund: boolean;
  cancel: boolean;
  terminal: boolean;
  onlineCardEntry: boolean;
  splitTender: boolean;
};
export type RefundAttempt = {
  id: string;
  payment_id: string;
  status: "CREATED" | "PENDING" | "UNKNOWN" | "SUCCEEDED" | "FAILED";
  amount_minor: number;
  refund_id?: string;
  recovery_required: boolean;
  failure_code?: string;
};
export type PaymentErrorCategory =
  | "DECLINED"
  | "TEMPORARY_ERROR"
  | "NETWORK_ERROR"
  | "CONFIGURATION_ERROR"
  | "UNAUTHORIZED_PROVIDER_ACCOUNT"
  | "DEVICE_UNAVAILABLE"
  | "INVALID_AMOUNT"
  | "DUPLICATE_REQUEST"
  | "UNKNOWN_STATUS"
  | "REFUND_FAILED";
export const paymentErrors: Record<PaymentErrorCategory, string> = {
  DECLINED: "Payment was declined.",
  TEMPORARY_ERROR:
    "Payment is being checked. Verify its status before trying again.",
  NETWORK_ERROR:
    "Trading Docks lost connection while checking the payment. Verify payment status before trying again.",
  CONFIGURATION_ERROR: "This payment method is not configured.",
  UNAUTHORIZED_PROVIDER_ACCOUNT:
    "The payment account needs administrator attention.",
  DEVICE_UNAVAILABLE:
    "This payment terminal is unavailable. Check the device or choose another payment method.",
  INVALID_AMOUNT: "Review the checkout amount.",
  DUPLICATE_REQUEST: "This request already exists. Check its status.",
  UNKNOWN_STATUS: "Payment status is being verified.",
  REFUND_FAILED:
    "The provider declined the refund. No completed refund was recorded.",
};
export function canTransition(from: PaymentState, to: PaymentState) {
  if (from === to) return true;
  if (
    [
      "CREATED",
      "PENDING",
      "AWAITING_CUSTOMER",
      "PROCESSING",
      "AUTHORIZED",
      "TIMED_OUT",
      "UNKNOWN",
    ].includes(from)
  )
    return [
      "PENDING",
      "AWAITING_CUSTOMER",
      "PROCESSING",
      "AUTHORIZED",
      "SUCCEEDED",
      "DECLINED",
      "FAILED",
      "CANCELED",
      "TIMED_OUT",
      "UNKNOWN",
    ].includes(to);
  return (
    ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUND_PENDING"].includes(from) &&
    ["REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED", "SUCCEEDED"].includes(
      to,
    )
  );
}
export function payableAgain(p: Payment) {
  return (
    p.saleState === "PAYABLE" &&
    ["DECLINED", "FAILED", "CANCELED"].includes(p.status)
  );
}
export function tenderBalance(total: number, tenders: number[]) {
  if (![total, ...tenders].every((v) => Number.isSafeInteger(v) && v >= 0))
    throw Error("INVALID_AMOUNT");
  const paid = tenders.reduce((a, b) => a + BigInt(b), BigInt(0));
  if (paid > BigInt(total)) throw Error("INVALID_AMOUNT");
  return Number(BigInt(total) - paid);
}
export function safeMetadata(input: Record<string, unknown>): SafeMetadata {
  return {
    ...(typeof input.brand === "string" && input.brand.length <= 30
      ? { brand: input.brand }
      : {}),
    ...(typeof input.last4 === "string" && /^\d{4}$/.test(input.last4)
      ? { last4: input.last4 }
      : {}),
    ...(typeof input.verification === "string" &&
    input.verification.length <= 30
      ? { verification: input.verification }
      : {}),
  };
}
export function assertMockEnvironment(environment: string | undefined) {
  if (environment !== "development" && environment !== "test")
    throw Error("POS_MOCK_DISABLED");
}

/** Adapters may raise a normalized category; unknown provider text never reaches the UI. */
export function normalizeProviderError(error: unknown): {
  category: PaymentErrorCategory;
  message: string;
} {
  const candidate =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : error instanceof Error
        ? error.message
        : "";
  const category: PaymentErrorCategory = Object.hasOwn(paymentErrors, candidate)
    ? (candidate as PaymentErrorCategory)
    : ["ECONNRESET", "ENOTFOUND", "ECONNREFUSED"].includes(candidate)
      ? "NETWORK_ERROR"
      : "UNKNOWN_STATUS";
  return { category, message: paymentErrors[category] };
}
