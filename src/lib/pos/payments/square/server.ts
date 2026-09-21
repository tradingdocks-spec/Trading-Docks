import "server-only";
import { createAdminClient } from "../../../supabase/admin";
import { posContext } from "../../server";
import { providerBudget } from "../../provider-budget";
import { squareConfig, SQUARE_RETURN_PATH } from "./config";
import { SquareAccounts, type SquareStore } from "./service";
import { squareRuntimeAllowed } from "./runtime";
export function squareAccounts() {
  if (!squareRuntimeAllowed()) throw Error("CONFIGURATION_ERROR");
  const config = squareConfig();
  const admin = createAdminClient();
  const store: SquareStore = async (action, body) => {
    const { data, error } = await admin.rpc("pos_square_service", {
      p_action: action,
      p_body: body,
    });
    if (error) {
      const code = [
        "POS_FORBIDDEN",
        "POS_TERMINAL_UNAVAILABLE",
        "POS_TERMINAL_BUSY",
        "SQUARE_TERMINAL_SCOPE",
        "DEVICE_BUSY",
        "UNKNOWN_STATUS",
        "OAUTH_STATE_INVALID",
        "SQUARE_REPLACEMENT_REQUIRED",
        "UNAUTHORIZED_PROVIDER_ACCOUNT",
      ].find((c) => error.message.includes(c));
      throw Error(code ?? "CONFIGURATION_ERROR");
    }
    return data;
  };
  return new SquareAccounts(store, config);
}
export async function squareSettingsRoute(request: Request, callback = false) {
  const ctx = await posContext();
  if (!ctx.ok) return ctx.response;
  if (!ctx.access.userId)
    return Response.json(
      { error: "Authentication required." },
      { status: 403 },
    );
  const headers = { "Cache-Control": "no-store" };
  try {
    if (callback) {
      const limited = await providerBudget(ctx.supabase, ctx.workspaceId, 'oauth');
      if (limited) return limited;
      const target = await squareAccounts().callback(
        ctx.workspaceId,
        ctx.access.userId,
        new URL(request.url).searchParams,
      );
      return Response.redirect(new URL(target, request.url), 303);
    }
    let body: Record<string, unknown> = {};
    if (request.method !== "GET") {
      if (request.headers.get("origin") !== new URL(request.url).origin)
        return Response.json(
          { error: "Invalid request origin." },
          { status: 403, headers },
        );
      const reader = request.body?.getReader();
      if (!reader) throw Error("CONFIGURATION_ERROR");
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 4096) {
          await reader.cancel();
          return Response.json(
            { error: "Request too large." },
            { status: 413, headers },
          );
        }
        chunks.push(value);
      }
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!body || Array.isArray(body) || typeof body !== "object")
        throw Error("CONFIGURATION_ERROR");
    }
    const limited = await providerBudget(ctx.supabase, ctx.workspaceId, 'oauth');
    if (limited) return limited;
    const { data, error } = await ctx.supabase.rpc("pos_square_settings", {
      p_workspace_id: ctx.workspaceId,
      p_action: body.action === "map" ? "map" : "get",
      p_body: body,
    });
    if (error) throw Error("POS_FORBIDDEN");
    let configured = false;
    try {
      squareConfig();
      configured = true;
    } catch {}
    if (body.action === "connect")
      return Response.json(
        {
          url: await squareAccounts().start(ctx.workspaceId, ctx.access.userId, body.terminal === true),
        },
        { headers },
      );
    if (body.action === "check" || body.action === "disconnect") {
      if (body.action === "disconnect" && body.confirmed !== true)
        throw Error("CONFIGURATION_ERROR");
      await squareAccounts().manage(
        body.action,
        ctx.workspaceId,
        ctx.access.userId,
        String(body.connectionId),
      );
      const refreshed = await ctx.supabase.rpc("pos_square_settings", {
        p_workspace_id: ctx.workspaceId,
        p_action: "get",
      });
      if (refreshed.error) throw Error("CONFIGURATION_ERROR");
      return Response.json({ ...refreshed.data, configured }, { headers });
    }
    return Response.json({ ...data, configured }, { headers });
  } catch (e) {
    const code = e instanceof Error ? e.message : "CONFIGURATION_ERROR";
    if (callback)
      return Response.redirect(
        new URL(
          SQUARE_RETURN_PATH +
            "?square=" +
            (code === "SQUARE_REPLACEMENT_REQUIRED" ? "replacement" : "failed"),
          request.url,
        ),
        303,
      );
    return Response.json(
      {
        error:
          code === "POS_FORBIDDEN"
            ? "Only the workspace owner or admin can manage Square."
            : "Square needs attention. Check Sandbox configuration or reconnect.",
        code,
      },
      { status: code === "POS_FORBIDDEN" ? 403 : 409, headers },
    );
  }
}
