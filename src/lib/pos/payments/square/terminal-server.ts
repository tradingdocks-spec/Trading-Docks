import "server-only";
import { posContext } from "../../server";
import { providerBudget } from "../../provider-budget";
import { squareAccounts } from "./server";
import { terminalPair } from "./terminal";
import { normalizeProviderError } from "../domain";
export async function terminalRoute(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const ctx = await posContext();
  if (!ctx.ok) return ctx.response;
  if (!ctx.access.userId)
    return Response.json(
      { error: "Authentication required." },
      { status: 403, headers },
    );
  try {
    let body: Record<string, unknown> = {};
    if (request.method !== "GET") {
      if (request.headers.get("origin") !== new URL(request.url).origin)
        throw Error("POS_FORBIDDEN");
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
          throw Error("CONFIGURATION_ERROR");
        }
        chunks.push(value);
      }
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!body || Array.isArray(body) || typeof body !== "object")
        throw Error("CONFIGURATION_ERROR");
    }
    const action = String(body.action ?? "get");
    const limited = await providerBudget(ctx.supabase, ctx.workspaceId, 'device');
    if (limited) return limited;
    if (
      !["get", "pair", "check", "rename", "assign", "disable"].includes(action)
    )
      throw Error("CONFIGURATION_ERROR");
    const read = async (operation: string) => {
      const { data, error } = await ctx.supabase.rpc("pos_terminal_devices", {
        p_workspace_id: ctx.workspaceId,
        p_action: operation,
        p_body: body,
      });
      if (error)
        throw Error(
          error.message.includes("DEVICE_BUSY")
            ? "DEVICE_BUSY"
            : error.message.includes("POS_FORBIDDEN")
              ? "POS_FORBIDDEN"
              : "CONFIGURATION_ERROR",
        );
      return data;
    };
    const data = await read(
      ["rename", "assign", "disable"].includes(action) ? action : "get",
    );
    if (action === "pair" || action === "check") {
      if (!data.canManage) throw Error("POS_FORBIDDEN");
      const pairing = await terminalPair(
        squareAccounts(),
        ctx.workspaceId,
        ctx.access.userId,
        body,
        action === "pair",
      );
      return Response.json({ ...(await read("get")), pairing }, { headers });
    }
    return Response.json(data, { headers });
  } catch (e) {
    const code = e instanceof Error ? e.message : "UNKNOWN_STATUS";
    return Response.json(
      {
        code,
        error:
          code === "POS_FORBIDDEN"
            ? "Only the workspace owner or admin can manage Terminals."
            : code === "POS_TERMINAL_UNAVAILABLE"
              ? "Connect Square and map this store location first."
              : normalizeProviderError(e).message,
      },
      { status: code === "POS_FORBIDDEN" ? 403 : 409, headers },
    );
  }
}
