import type {
  Payment,
  ProviderId,
  ProviderCapabilities,
  RefundAttempt,
  ProviderLocation,
  PaymentDevice,
} from "./domain.ts";
import { assertMockEnvironment } from "./domain.ts";
export type PaymentStore = <T>(
  action: string,
  body: Record<string, unknown>,
  refund?: boolean,
) => Promise<T>;
export type VerifiedProviderEvent = {
  provider: ProviderId;
  eventId: string;
  paymentId: string;
};
export interface PaymentProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;
  createPayment(paymentId: string): Promise<Payment>;
  getPayment(paymentId: string): Promise<Payment>;
  cancelPayment?(paymentId: string): Promise<Payment>;
  refundPayment?(refundId: string): Promise<RefundAttempt>;
  getRefund?(refundId: string): Promise<RefundAttempt>;
  // Verification must consume the original bytes and reject unauthenticated input.
  verifyEvent?(
    rawBody: Uint8Array,
    headers: Headers,
  ): Promise<VerifiedProviderEvent>;
  listLocations?(): Promise<ProviderLocation[]>;
  listDevices?(): Promise<PaymentDevice[]>;
  pairDevice?(deviceId: string): Promise<PaymentDevice>;
}
export class MockPaymentProvider implements PaymentProvider {
  readonly id = "MOCK" as const;
  readonly capabilities = {
    cardPresent: true,
    refund: true,
    partialRefund: true,
    cancel: true,
    terminal: false,
    onlineCardEntry: false,
    splitTender: false,
  };
  private store: PaymentStore;
  constructor(store: PaymentStore, environment: string | undefined) {
    assertMockEnvironment(environment);
    this.store = store;
  }
  createPayment(id: string) {
    return this.store<Payment>("dispatch", { id });
  }
  getPayment(id: string) {
    return this.store<Payment>("provider_get", { id });
  }
  cancelPayment(id: string) {
    return this.store<Payment>("provider_cancel", { id });
  }
  refundPayment(id: string) {
    return this.store<RefundAttempt>("dispatch", { id }, true);
  }
  getRefund(id: string) {
    return this.store<RefundAttempt>("reconcile", { id }, true);
  }
}
export class ExternalPaymentProvider implements PaymentProvider {
  readonly id = "EXTERNAL" as const;
  readonly capabilities = {
    cardPresent: false,
    refund: true,
    partialRefund: true,
    cancel: false,
    terminal: false,
    onlineCardEntry: false,
    splitTender: false,
  };
  private store: PaymentStore;
  constructor(store: PaymentStore) {
    this.store = store;
  }
  createPayment(id: string) {
    return this.store<Payment>("dispatch", { id });
  }
  getPayment(id: string) {
    return this.store<Payment>("get", { id });
  }
  refundPayment(id: string) {
    return this.store<RefundAttempt>("dispatch", { id }, true);
  }
  getRefund(id: string) {
    return this.store<RefundAttempt>("reconcile", { id }, true);
  }
}
// Cash is a synchronous canonical POS command, not an artificial asynchronous adapter.
export const cashCapabilities: ProviderCapabilities = {
  cardPresent: false,
  refund: true,
  partialRefund: true,
  cancel: false,
  terminal: false,
  onlineCardEntry: false,
  splitTender: false,
};
export function providerFor(
  id: ProviderId,
  store: PaymentStore,
  environment: string | undefined,
): PaymentProvider {
  if (id === "MOCK") return new MockPaymentProvider(store, environment);
  if (id === "EXTERNAL") return new ExternalPaymentProvider(store);
  throw Error("CONFIGURATION_ERROR");
}
