import "server-only";
import { posContext } from "../server";
import { providerBudget } from "../provider-budget";
import { POS_MAX_REQUEST_BYTES } from "../limits";
import { POS_ERRORS } from "../domain";
import { normalizeProviderError } from "./domain";
import { PaymentOrchestrator } from "./orchestrator";
import { budgetedProvider } from "./budgeted-provider";
import type { PaymentStore } from "./provider";
import { squareAccounts } from "./square/server";
import { SquarePaymentProvider } from "./square/provider";
import { squareRuntimeAllowed } from "./square/runtime";
const errors: Record<string, string> = {
  ...POS_ERRORS,
  POS_TERMINAL_UNAVAILABLE: "The assigned Terminal is unavailable. Check Hardware or choose another payment method.",
  POS_TERMINAL_BUSY: "This Terminal is already processing another transaction.",
  POS_TERMINAL_SCOPE: "Square must be reconnected to enable Terminal access.",
  SQUARE_TERMINAL_SCOPE: "Square must be reconnected to enable Terminal access.",
  POS_MOCK_DISABLED: "Simulated payments are disabled.",
  POS_SQUARE_UNAVAILABLE: "Square is unavailable for this store. Review the checkout and choose another payment method.",
  POS_PAYMENT_ACTIVE:
    "Resolve the current payment before starting another payment or closing this register.",
  POS_PAYMENT_UNCERTAIN: "Payment status is being verified.",
  POS_PROVIDER_REFUND_REQUIRED:
    "Use the original payment provider to refund this sale.",
  POS_FINALIZATION_FAILED:
    "Payment succeeded. Sale completion needs review; do not charge again.",
};
export async function paymentRoute(
  request: Request,
  action: string,
  id?: string,
) {
  try {
    let body: Record<string, unknown> = {};
    if (request.method !== "GET") {
      if (request.headers.get("origin") !== new URL(request.url).origin)
        return Response.json(
          { error: "Invalid request origin." },
          { status: 403 },
        );
      const reader = request.body?.getReader();
      if (!reader)
        return Response.json({ error: "Request required." }, { status: 400 });
      let size = 0,
        raw = "";
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > POS_MAX_REQUEST_BYTES) {
          await reader.cancel();
          return Response.json(
            { error: "Request too large." },
            { status: 413 },
          );
        }
        raw += decoder.decode(value, { stream: true });
      }
      try {
        body = JSON.parse(raw + decoder.decode());
      } catch {
        return Response.json({ error: "Invalid request." }, { status: 400 });
      }
      if (!body || Array.isArray(body) || typeof body !== "object")
        return Response.json({ error: "Invalid request." }, { status: 400 });
    }
    const ctx = await posContext();
    if (!ctx.ok) return ctx.response;
    if (!ctx.access.userId) return Response.json({ error: "Authentication required." }, { status: 403 });
    const store: PaymentStore = async <T>(
      operation: string,
      payload: Record<string, unknown>,
      refund = false,
    ) => {
      const { data, error } = await ctx.supabase.rpc(
        refund ? "pos_payment_refund_command" : "pos_payment_command",
        {
          p_workspace_id: ctx.workspaceId,
          p_action: operation,
          p_body: payload,
        },
      );
      if (error) {
        const code = Object.keys(errors).find((c) => error.message.includes(c));
        throw Error(code ?? "UNKNOWN_STATUS");
      }
      return data as T;
    };
    let square: SquarePaymentProvider | undefined;
    try { square = new SquarePaymentProvider(store, squareAccounts(), ctx.workspaceId, ctx.access.userId, process.env.NODE_ENV); } catch {}
    const service = new PaymentOrchestrator(store, process.env.NODE_ENV, square ? { SQUARE: budgetedProvider(square, async () => {
      const limited = await providerBudget(ctx.supabase, ctx.workspaceId, 'payment');
      if (limited) throw limited;
    }) } : {});
    let result: unknown;
    if (action === "create") {
      if (body.provider === "SQUARE" && !squareRuntimeAllowed()) throw Error("CONFIGURATION_ERROR");
      result = await service.begin(body);
    }
    else if (action === "check") result = await service.check(id!);
    else if (action === "cancel") result = await service.cancel(id!);
    else if (action === "refund")
      result = await service.refund({ ...body, paymentId: id });
    else if (action === "checkRefund") result = await service.checkRefund(id!);
    else if (action === "capabilities") {
      const data = await store<{ mockEnabled: boolean; squareSites?: string[]; terminals?: unknown[] }>("capabilities", {});
      result = {
        terminals: square ? data.terminals ?? [] : [],
        mockEnabled: process.env.NODE_ENV !== "production" && data.mockEnabled,
        squareSites: square ? data.squareSites ?? [] : [],
      };
    } else
      result = await store(action, {
        ...Object.fromEntries(new URL(request.url).searchParams),
        ...(id ? { id } : {}),
      });
    const record =
      result && typeof result === "object" && !Array.isArray(result)
        ? (result as Record<string, unknown>)
        : {};
    const safeString = (key: string) =>
      typeof record[key] === "string" ? record[key] : undefined;
    console.info("pos.payment", {
      action,
      provider: safeString("provider"),
      payment_attempt_id: id ?? safeString("id"),
      sale_id: safeString("saleId"),
      provider_payment_id: safeString("providerReference"),
      status: safeString("status"),
      sale_state: safeString("saleState"),
      reconciliation:
        action === "check" || action === "checkRefund" ? "checked" : undefined,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof Response) return err;
    const code = err instanceof Error ? err.message : "UNKNOWN_STATUS";
    const normalized = normalizeProviderError(err);
    const safe = (action === "refund" || action === "checkRefund") && code === "UNAUTHORIZED_PROVIDER_ACCOUNT" ? "Reconnect Square before processing this refund." : errors[code] ?? normalized.message;
    console.warn("pos.payment.failed", {
      action,
      payment_attempt_id: id ?? null,
      error_category: errors[code] ? code : normalized.category,
    });
    return Response.json(
      { error: safe, code: errors[code] ? code : normalized.category },
      {
        status:
          code === "POS_FORBIDDEN" || code === "POS_MOCK_DISABLED" ? 403 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
