import { terminalPayment, terminalRefund } from "./terminal.ts";
import { squareRuntimeAllowed } from "./runtime.ts";
import type { PaymentProvider, PaymentStore } from "../provider.ts";
import type { Payment, RefundAttempt } from "../domain.ts";
import { SquareAccounts, type CredentialContext } from "./service.ts";
import {
  object,
  paymentStatus,
  refundStatus,
  safeSquareMetadata,
  type SquareObject,
} from "./http.ts";
export class SquarePaymentProvider implements PaymentProvider {
  readonly id = "SQUARE" as const;
  readonly capabilities = {
    cardPresent: true,
    refund: true,
    partialRefund: true,
    cancel: true,
    terminal: true,
    onlineCardEntry: false,
    splitTender: false,
  };
  store: PaymentStore;
  accounts: SquareAccounts;
  workspaceId: string;
  actorId: string;
  environment: string | undefined;
  constructor(
    store: PaymentStore,
    accounts: SquareAccounts,
    workspaceId: string,
    actorId: string,
    environment: string | undefined,
  ) {
    this.store = store;
    this.accounts = accounts;
    this.workspaceId = workspaceId;
    this.actorId = actorId;
    this.environment = environment;
  }
  async createPayment(id: string) {
    return this.getPayment(id);
  }
  async getPayment(id: string): Promise<Payment> {
    const before = await this.store<Payment>("get", { id });
    if (
      [
        "SUCCEEDED",
        "PARTIALLY_REFUNDED",
        "REFUNDED",
        "DECLINED",
        "FAILED",
        "CANCELED",
      ].includes(before.status)
    )
      return before;
    await this.store("dispatch", { id }); // canonical permission, price, stock and session preflight
    const ctx = await this.accounts.store("payment_context", {
      workspaceId: this.workspaceId,
      actorId: this.actorId,
      id,
    });
    const payment = object(ctx.payment);
    if (before.metadata.method === "TERMINAL") {
      await terminalPayment(this.accounts, ctx);
      return this.store<Payment>("observe", { id });
    }
    try {
      const token = await this.accounts.token(
        ctx as unknown as CredentialContext,
      );
      let data: SquareObject;
      if (payment.provider_payment_id)
        data = await this.accounts.http.request(
          "/v2/payments/" +
            encodeURIComponent(String(payment.provider_payment_id)),
          token,
        );
      else {
        // Test tokens are server-owned and only execute in an approved Sandbox runtime.
        if (!squareRuntimeAllowed(this.environment))
          throw Error("CONFIGURATION_ERROR");
        data = await this.accounts.http.request("/v2/payments", token, {
          idempotency_key: id,
          source_id: "cnon:card-nonce-ok",
          amount_money: {
            amount: payment.amount_minor,
            currency: payment.currency,
          },
          location_id: object(payment.metadata).locationId,
          reference_id: id,
          autocomplete: true,
        });
      }
      const remote = object(data.payment),
        money = object(remote.amount_money);
      if (typeof remote.id !== "string" || remote.reference_id !== id)
        throw Error("UNKNOWN_STATUS");
      await this.accounts.store("observe", {
        workspaceId: this.workspaceId,
        id,
        providerId: remote.id,
        status: paymentStatus(remote.status),
        amountMinor: money.amount,
        currency: money.currency,
        locationId: remote.location_id,
        metadata: safeSquareMetadata(remote),
      });
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED_PROVIDER_ACCOUNT")
        await this.accounts.store("attention", {
          workspaceId: this.workspaceId,
          connectionId: object(ctx.connection).id,
        });
      if (e instanceof Error && e.message === "DECLINED") {
        await this.accounts.store("observe", {
          workspaceId: this.workspaceId,
          id,
          status: "DECLINED",
          amountMinor: payment.amount_minor,
          currency: payment.currency,
          locationId: object(payment.metadata).locationId,
          metadata: {},
        });
      } else throw e;
    }
    return this.store<Payment>("observe", { id });
  }
  async cancelPayment(id: string): Promise<Payment> {
    const before = await this.store<Payment>("get", { id });
    if (before.metadata.method !== "TERMINAL") throw Error("CONFIGURATION_ERROR");
    if (["SUCCEEDED", "CANCELED", "FAILED", "DECLINED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(before.status)) return before;
    const ctx = await this.accounts.store("payment_context", { workspaceId: this.workspaceId, actorId: this.actorId, id });
    await terminalPayment(this.accounts, ctx, true);
    return this.store<Payment>("observe", { id });
  }
  async refundPayment(id: string) {
    return this.getRefund(id);
  }
  async getRefund(id: string): Promise<RefundAttempt> {
    const refund = await this.store<RefundAttempt>("get", { id }, true);
    if (["SUCCEEDED", "FAILED"].includes(refund.status)) return refund;
    const ctx = await this.accounts.store("payment_context", {
      workspaceId: this.workspaceId,
      actorId: this.actorId,
      id: refund.payment_id,
      refundId: id,
    });
    const payment = object(ctx.payment),
      local = object(ctx.refund);
    if (object(payment.metadata).refundRequiresCardPresence === true) {
      await terminalRefund(this.accounts, ctx);
      return this.store<RefundAttempt>("reconcile", {id}, true);
    }
    try {
      const token = await this.accounts.token(
        ctx as unknown as CredentialContext,
      );
      const data = local.provider_refund_id
        ? await this.accounts.http.request(
            "/v2/refunds/" +
              encodeURIComponent(String(local.provider_refund_id)),
            token,
          )
        : await this.accounts.http.request("/v2/refunds", token, {
            idempotency_key: id,
            payment_id: payment.provider_payment_id,
            amount_money: {
              amount: refund.amount_minor,
              currency: payment.currency,
            },
          });
      const remote = object(data.refund),
        money = object(remote.amount_money);
      if (typeof remote.id !== "string") throw Error("UNKNOWN_STATUS");
      await this.accounts.store("observe_refund", {
        workspaceId: this.workspaceId,
        id,
        providerId: remote.id,
        paymentId: remote.payment_id,
        status: refundStatus(remote.status),
        amountMinor: money.amount,
        currency: money.currency,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED_PROVIDER_ACCOUNT")
        await this.accounts.store("attention", {
          workspaceId: this.workspaceId,
          connectionId: object(ctx.connection).id,
        });
      throw e;
    }
    return this.store<RefundAttempt>("reconcile", { id }, true);
  }
}
