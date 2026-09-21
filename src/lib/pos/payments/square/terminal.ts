import type { PaymentState } from "../domain.ts";
import {
  object,
  paymentStatus,
  refundStatus,
  safeSquareMetadata,
  type SquareObject,
} from "./http.ts";
import { SquareAccounts, type CredentialContext } from "./service.ts";

export const TERMINAL_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "PAYMENTS_READ",
  "PAYMENTS_WRITE",
  "DEVICE_CREDENTIAL_MANAGEMENT",
];
export function terminalScoped(scopes: unknown): boolean {
  return (
    Array.isArray(scopes) && TERMINAL_SCOPES.every((s) => scopes.includes(s))
  );
}
export function terminalStatus(status: unknown): PaymentState {
  return (
    (
      {
        PENDING: "AWAITING_CUSTOMER",
        IN_PROGRESS: "PROCESSING",
        CANCEL_REQUESTED: "PROCESSING",
        CANCELED: "CANCELED",
      } as Record<string, PaymentState>
    )[String(status)] ?? "UNKNOWN"
  );
}
export async function terminalPair(
  accounts: SquareAccounts,
  workspaceId: string,
  actorId: string,
  body: SquareObject,
  create = false,
) {
  const args = { ...body, workspaceId, actorId };
  const ctx = await accounts.store(
    create ? "terminal_pair" : "terminal_check",
    args,
  );
  const d = object(ctx.device);
  const token = await accounts.token(ctx as unknown as CredentialContext);
  const data = d.provider_device_code_id
    ? await accounts.http.request(
        `/v2/devices/codes/${d.provider_device_code_id}`,
        token,
      )
    : await accounts.http.request("/v2/devices/codes", token, {
        idempotency_key: d.id,
        device_code: {
          name: d.display_name,
          product_type: "TERMINAL_API",
          location_id: d.provider_location_id,
        },
      });
  await observeCode(accounts, d, object(data.device_code));
  if (!create && d.provider_device_id) {
    // Devices API is optional health information, never proof of a successful payment.
    // Pairing returns a Terminal serial, whereas GetDevice requires the synthetic device: ID.
    let cursor: string | undefined;
    let device: SquareObject | undefined;
    for (let page = 0; page < 10; page++) {
      const list = await accounts.http.request(
        "/v2/devices" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
        token,
      );
      device = Array.isArray(list.devices)
        ? list.devices
            .map(object)
            .find(
              (v) =>
                object(v.attributes).manufacturers_id === d.provider_device_id,
            )
        : undefined;
      if (device || typeof list.cursor !== "string") break;
      cursor = list.cursor;
    }
    const info = device?.id
      ? object(
          (
            await accounts.http.request(
              `/v2/devices/${encodeURIComponent(String(device.id))}`,
              token,
            )
          ).device,
        )
      : {};
    const category = object(info.status).category;
    await accounts.store("terminal_health", {
      workspaceId,
      id: d.id,
      deviceId: d.provider_device_id,
      status:
        category === "AVAILABLE"
          ? "AVAILABLE"
          : category === "OFFLINE"
            ? "OFFLINE"
            : "PAIRED",
    });
  }
  return accounts.store("terminal_code_view", args);
}
export async function observeCode(
  accounts: SquareAccounts,
  d: SquareObject,
  code: SquareObject,
) {
  if (
    typeof code.id !== "string" ||
    code.product_type !== "TERMINAL_API" ||
    code.location_id !== d.provider_location_id ||
    (d.provider_device_code_id && code.id !== d.provider_device_code_id)
  )
    throw Error("UNKNOWN_STATUS");
  await accounts.store("terminal_code", {
    workspaceId: d.workspace_id,
    id: d.id,
    codeId: code.id,
    code: code.code,
    deviceId: code.device_id,
    status: code.status,
    locationId: code.location_id,
    pairBy: code.pair_by,
    pairedAt: code.paired_at,
  });
}

export async function terminalPayment(
  accounts: SquareAccounts,
  ctx: SquareObject,
  cancel = false,
  checkoutId?: string,
) {
  const p = object(ctx.payment),
    connection = object(ctx.connection);
  if (!terminalScoped(connection.authorized_scopes))
    throw Error("SQUARE_TERMINAL_SCOPE");
  const args = { workspaceId: p.workspace_id, id: p.id };
  const t = object((await accounts.store("terminal_context", args)).terminal);
  if (checkoutId && t.checkout_id && checkoutId !== t.checkout_id)
    throw Error("UNKNOWN_STATUS");
  const token = await accounts.token(ctx as unknown as CredentialContext);
  const known = t.checkout_id || checkoutId;
  let result: SquareObject;
  try {
    result = known
      ? await accounts.http.request(
          `/v2/terminals/checkouts/${known}${cancel ? "/cancel" : ""}`,
          token,
          cancel ? {} : undefined,
        )
      : await accounts.http.request("/v2/terminals/checkouts", token, {
          idempotency_key: p.id,
          checkout: {
            reference_id: p.id,
            amount_money: { amount: p.amount_minor, currency: p.currency },
            device_options: {
              device_id: t.provider_device_id,
              tip_settings: { allow_tipping: false },
              skip_receipt_screen: true,
              collect_signature: false,
            },
          },
        });
  } catch (e) {
    // Only definitive provider rejections make an attempt payable again. Network ambiguity retains its key and device lock.
    if (
      !known &&
      e instanceof Error &&
      ["DEVICE_BUSY", "DEVICE_UNAVAILABLE", "DECLINED"].includes(e.message)
    ) {
      await accounts.store("observe", {
        ...args,
        status: e.message === "DECLINED" ? "DECLINED" : "FAILED",
        amountMinor: p.amount_minor,
        currency: p.currency,
        locationId: t.location_id,
        metadata: { method: "TERMINAL", terminalError: e.message },
      });
      return;
    }
    throw e;
  }
  const checkout = object(result.checkout),
    money = object(checkout.amount_money);
  if (
    typeof checkout.id !== "string" ||
    (known && checkout.id !== known) ||
    checkout.reference_id !== p.id ||
    money.amount !== p.amount_minor ||
    money.currency !== p.currency ||
    object(checkout.device_options).device_id !== t.provider_device_id ||
    checkout.location_id !== t.location_id
  )
    throw Error("UNKNOWN_STATUS");
  await accounts.store("terminal_observe", {
    ...args,
    checkoutId: checkout.id,
    deviceId: t.provider_device_id,
    locationId: t.location_id,
    status: checkout.status,
  });
  let remote: SquareObject = {};
  let status = terminalStatus(checkout.status);
  if (checkout.status === "COMPLETED") {
    if (
      !Array.isArray(checkout.payment_ids) ||
      checkout.payment_ids.length !== 1 ||
      typeof checkout.payment_ids[0] !== "string"
    )
      throw Error("UNKNOWN_STATUS");
    remote = object(
      (
        await accounts.http.request(
          `/v2/payments/${checkout.payment_ids[0]}`,
          token,
        )
      ).payment,
    );
    const paid = object(remote.amount_money);
    if (
      remote.id !== checkout.payment_ids[0] ||
      remote.reference_id !== p.id ||
      remote.location_id !== t.location_id ||
      paid.amount !== p.amount_minor ||
      paid.currency !== p.currency
    )
      throw Error("UNKNOWN_STATUS");
    status = paymentStatus(remote.status);
  }
  await accounts.store("observe", {
    ...args,
    providerId: remote.id,
    status,
    amountMinor: p.amount_minor,
    currency: p.currency,
    locationId: t.location_id,
    metadata: {
      ...safeSquareMetadata(remote),
      locationId: t.location_id,
      method: "TERMINAL",
      terminalCheckoutStatus: checkout.status,
      terminalCheckoutId: checkout.id,
      refundRequiresCardPresence:
        object(remote.card_details).refund_requires_card_presence === true,
    },
  });
}

/** Only payments explicitly requiring card presence use Terminal refunds (Interac Canada).
 * USD retail continues through the normal Refunds API. The generic refund finalizer is unchanged.
 */
export async function terminalRefund(
  accounts: SquareAccounts,
  ctx: SquareObject,
) {
  const p = object(ctx.payment),
    r = object(ctx.refund);
  if (!terminalScoped(object(ctx.connection).authorized_scopes))
    throw Error("SQUARE_TERMINAL_SCOPE");
  const args = { workspaceId: p.workspace_id, id: r.id, paymentId: p.id };
  const t = object(
    (
      await accounts.store("terminal_context", {
        workspaceId: p.workspace_id,
        id: p.id,
      })
    ).terminal,
  );
  const saved = await accounts.store("terminal_refund_get", args);
  const token = await accounts.token(ctx as unknown as CredentialContext);
  const result = saved.checkout_id
    ? await accounts.http.request(
        `/v2/terminals/refunds/${saved.checkout_id}`,
        token,
      )
    : await accounts.http.request("/v2/terminals/refunds", token, {
        idempotency_key: r.id,
        refund: {
          payment_id: p.provider_payment_id,
          device_id: t.provider_device_id,
          amount_money: { amount: r.amount_minor, currency: p.currency },
          reason: "Customer requested refund",
        },
      });
  const remote = object(result.refund),
    money = object(remote.amount_money);
  if (
    typeof remote.id !== "string" ||
    remote.payment_id !== p.provider_payment_id ||
    remote.device_id !== t.provider_device_id ||
    remote.location_id !== t.location_id ||
    money.amount !== r.amount_minor ||
    money.currency !== p.currency
  )
    throw Error("UNKNOWN_STATUS");
  await accounts.store("terminal_refund_save", {
    ...args,
    checkoutId: remote.id,
  });
  let refund: SquareObject = {};
  if (remote.status === "COMPLETED") {
    if (typeof remote.refund_id !== "string") throw Error("UNKNOWN_STATUS");
    refund = object(
      (await accounts.http.request(`/v2/refunds/${remote.refund_id}`, token))
        .refund,
    );
    const amount = object(refund.amount_money);
    if (
      refund.id !== remote.refund_id ||
      refund.payment_id !== p.provider_payment_id ||
      amount.amount !== r.amount_minor ||
      amount.currency !== p.currency
    )
      throw Error("UNKNOWN_STATUS");
  }
  await accounts.store("observe_refund", {
    ...args,
    providerId: refund.id,
    paymentId: p.provider_payment_id,
    amountMinor: r.amount_minor,
    currency: p.currency,
    status:
      remote.status === "CANCELED"
        ? "FAILED"
        : remote.status === "COMPLETED"
          ? refundStatus(refund.status)
          : "PENDING",
  });
}
