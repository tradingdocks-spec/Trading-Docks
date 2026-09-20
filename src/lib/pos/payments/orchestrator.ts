import {
  providerFor,
  type PaymentStore,
  type PaymentProvider,
} from "./provider.ts";
import type { Payment, RefundAttempt } from "./domain.ts";
export class PaymentOrchestrator {
  private store: PaymentStore;
  private environment: string | undefined;
  private providers: Partial<Record<Payment["provider"], PaymentProvider>>;
  constructor(
    store: PaymentStore,
    environment: string | undefined,
    providers: Partial<Record<Payment["provider"], PaymentProvider>> = {},
  ) {
    this.store = store;
    this.environment = environment;
    this.providers = providers;
  }
  private adapter(p: Payment) {
    return (
      this.providers[p.provider] ??
      providerFor(p.provider, this.store, this.environment)
    );
  }
  async begin(body: Record<string, unknown>) {
    if (!this.providers[body.provider as Payment["provider"]])
      providerFor(
        body.provider as Payment["provider"],
        this.store,
        this.environment,
      );
    const p = await this.store<Payment>("create", body);
    await this.adapter(p).createPayment(p.id);
    return this.observe(p.id);
  }
  async check(id: string) {
    const p = await this.store<Payment>("get", { id });
    const provider = this.adapter(p);
    if (p.status === "CREATED") await provider.createPayment(id);
    await provider.getPayment(id);
    return this.observe(id);
  }
  async cancel(id: string) {
    const p = await this.store<Payment>("get", { id });
    const provider = this.adapter(p);
    if (!provider.cancelPayment) throw Error("CONFIGURATION_ERROR");
    await provider.cancelPayment(id);
    return this.observe(id);
  }
  async observe(id: string, eventId?: string) {
    let p = await this.store<Payment>("observe", {
      id,
      ...(eventId ? { eventId } : {}),
    });
    if (p.status === "SUCCEEDED" && p.saleState !== "COMPLETED")
      p = await this.store<Payment>("finalize", { id });
    return p;
  }
  async ingest(provider: PaymentProvider, raw: Uint8Array, headers: Headers) {
    if (!provider.verifyEvent) throw Error("CONFIGURATION_ERROR");
    const event = await provider.verifyEvent(raw, headers);
    if (event.provider !== provider.id) throw Error("CONFIGURATION_ERROR");
    const p = await this.store<Payment>("get", { id: event.paymentId });
    if (p.provider !== event.provider) throw Error("CONFIGURATION_ERROR");
    await provider.getPayment(p.id);
    return this.observe(p.id, event.eventId);
  }
  async refund(body: Record<string, unknown>) {
    const p = await this.store<Payment>("get", { id: body.paymentId });
    const provider = this.adapter(p);
    if (!provider.refundPayment) throw Error("CONFIGURATION_ERROR");
    const r = await this.store<RefundAttempt>("create", body, true);
    await provider.refundPayment(r.id);
    return this.store<RefundAttempt>("finalize", { id: r.id }, true);
  }
  async checkRefund(id: string) {
    const r = await this.store<RefundAttempt>("get", { id }, true);
    const p = await this.store<Payment>("get", { id: r.payment_id });
    const provider = this.adapter(p);
    if (!provider.getRefund) throw Error("CONFIGURATION_ERROR");
    await provider.getRefund(id);
    return this.store<RefundAttempt>("finalize", { id }, true);
  }
}
