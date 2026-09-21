import { requireApiCapability } from "@/lib/platform/server-access";
import { POS_ERRORS } from "@/lib/pos/domain";
import type { LabelTarget } from "./print-settings";
export async function labelContext(
  capability:
    | "label.view"
    | "label.print"
    | "label.manage_templates" = "label.view",
) {
  const context = await requireApiCapability(capability);
  if (!context.ok) return context;
  if (!context.access.workspaceId)
    return {
      ok: false as const,
      response: Response.json(
        { error: "Choose a workspace." },
        { status: 403 },
      ),
    };
  const { data: allowed, error } = await context.supabase.rpc("label_access", {
    p_workspace_id: context.access.workspaceId,
    p_management: capability === "label.manage_templates",
  });
  if (error || allowed !== true)
    return {
      ok: false as const,
      response: Response.json(
        { error: "Label Studio is unavailable for this workspace." },
        { status: 403 },
      ),
    };
  return { ...context, workspaceId: context.access.workspaceId };
}
export async function labelBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new Error("Invalid request origin.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request required.");
  let size = 0;
  let raw = "";
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) {
      await reader.cancel();
      throw new Error("Request too large.");
    }
    raw += decoder.decode(value, { stream: true });
  }
  const value = JSON.parse(raw + decoder.decode());
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid request.");
  return value;
}
export function labelFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = Object.keys(POS_ERRORS).find((key) => message.includes(key));
  console.warn("labels.request.failed", { code: code ?? "LABEL_INVALID" });
  return Response.json(
    {
      error: code
        ? POS_ERRORS[code]
        : message && !message.includes("SQL")
          ? message
          : "Label request failed.",
    },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}
export async function issueLabelTargets(
  c: Extract<Awaited<ReturnType<typeof labelContext>>, { ok: true }>,
  keys: string[],
) {
  const locations = keys
    .filter((key) => key.startsWith("location:"))
    .map((key) => key.slice(9));
  const items = keys.filter((key) => !key.startsWith("location:"));
  const results = await Promise.all([
    items.length
      ? c.supabase.rpc("label_targets", {
          p_workspace_id: c.workspaceId,
          p_ids: items,
          p_issue: true,
        })
      : Promise.resolve({ data: [], error: null }),
    locations.length
      ? c.supabase.rpc("label_locations", {
          p_workspace_id: c.workspaceId,
          p_ids: locations,
          p_issue: true,
        })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (results.some((result) => result.error))
    throw new Error(
      "Identities could not be resolved for the selected inventory.",
    );
  return results.flatMap((result) => result.data ?? []) as LabelTarget[];
}
