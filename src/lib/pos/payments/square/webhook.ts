import { WebhooksHelper } from "square";
import { SquareAccounts, type CredentialContext } from "./service.ts";
import { object, paymentStatus, safeSquareMetadata } from "./http.ts";
import { observeCode, terminalPayment } from "./terminal.ts";
export async function squareWebhook(
  accounts: SquareAccounts,
  raw: Uint8Array,
  signature: string,
) {
  const body = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  if (
    !(await WebhooksHelper.verifySignature({
      requestBody: body,
      signatureHeader: signature,
      signatureKey: accounts.config.webhookKey,
      notificationUrl: accounts.config.notificationUrl,
    }))
  )
    throw Error("WEBHOOK_SIGNATURE_INVALID");
  const event = object(JSON.parse(body)),
    data = object(event.data),
    payload = object(data.object),
    payment = object(payload.payment);
  if (
    typeof event.event_id !== "string" ||
    event.event_id.length > 160 ||
    typeof event.merchant_id !== "string" ||
    typeof event.type !== "string"
  )
    throw Error("WEBHOOK_INVALID");
  const type = event.type;
  const recorded = await accounts.store("event", {
    eventId: event.event_id,
    merchantId: event.merchant_id,
    type,
    resourceId: data.id,
    referenceId: payment.reference_id,
  });
  if (recorded.processed) return;
  try {
    const local = object(recorded.payment);
    if (["device.code.paired", "terminal.checkout.created", "terminal.checkout.updated"].includes(type)) {
      const target = await accounts.store("terminal_event", {
        merchantId: event.merchant_id, type, resourceId: data.id,
        referenceId: object(payload.checkout).reference_id,
      });
      const d = object(target.device), p = object(target.payment);
      const context = await accounts.store("credential", {
        workspaceId: d.workspace_id ?? p.workspace_id,
        connectionId: d.connection_id ?? p.provider_account_id,
      });
      if (type === "device.code.paired") {
        const token = await accounts.token(context as unknown as CredentialContext);
        const remote = await accounts.http.request(`/v2/devices/codes/${d.provider_device_code_id}`, token);
        await observeCode(accounts, d, object(remote.device_code));
      } else await terminalPayment(accounts, { ...context, payment: p }, false, String(data.id));
    }
    if (type === "payment.created" || type === "payment.updated") {
      // Unknown local reference is retryable: the event may precede local response persistence.
      if (!local.id) throw Error("UNKNOWN_STATUS");
      const context = (await accounts.store("credential", {
        workspaceId: local.workspace_id,
        connectionId: local.provider_account_id,
      })) as unknown as CredentialContext;
      const token = await accounts.token(context);
      const remote = object(
          (
            await accounts.http.request(
              "/v2/payments/" + encodeURIComponent(String(data.id)),
              token,
            )
          ).payment,
        ),
        money = object(remote.amount_money);
      if (remote.reference_id !== local.id || remote.id !== data.id)
        throw Error("UNKNOWN_STATUS");
      await accounts.store("observe", {
        workspaceId: local.workspace_id,
        id: local.id,
        providerId: remote.id,
        status: paymentStatus(remote.status),
        amountMinor: money.amount,
        currency: money.currency,
        locationId: remote.location_id,
        metadata: safeSquareMetadata(remote),
      });
    }
    await accounts.store("event_done", { eventId: event.event_id });
    console.info("pos.square.webhook", {
      eventId: event.event_id,
      type,
      result: "processed",
    });
  } catch (e) {
    await accounts.store("event_done", {
      eventId: event.event_id,
      retry: true,
    });
    console.warn("pos.square.webhook", {
      eventId: event.event_id,
      type,
      result: "retry",
    });
    throw e;
  }
}
