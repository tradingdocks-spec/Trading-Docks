import {
  labelBody,
  labelContext,
  labelFailure,
  issueLabelTargets,
} from "@/lib/label-studio/server";
export async function GET(request: Request) {
  const c = await labelContext();
  if (!c.ok) return c.response;
  const params = new URL(request.url).searchParams;
  if (params.get("kind") === "location") {
    const { data, error } = await c.supabase.rpc("label_locations", {
      p_workspace_id: c.workspaceId,
    });
    return error
      ? labelFailure(new Error("Locations could not load."))
      : Response.json(data, { headers: { "Cache-Control": "no-store" } });
  }
  const { data, error } = await c.supabase.rpc("label_targets", {
    p_workspace_id: c.workspaceId,
    p_ids: (params.get("ids") ?? "").split(",").filter(Boolean),
    p_batch_id: params.get("batchId") || null,
    p_query: params.get("query") ?? "",
  });
  if (error)
    return labelFailure(
      new Error("Inventory labels could not load. Check workspace access."),
    );
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  try {
    const body = await labelBody(request);
    const c = await labelContext("label.print");
    if (!c.ok) return c.response;
    if (
      !Array.isArray(body.ids) ||
      body.ids.length > 500 ||
      body.ids.some((id) => typeof id !== "string" || id.length > 160)
    )
      throw new Error("Invalid inventory selection.");
    const data = await issueLabelTargets(c, body.ids as string[]);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return labelFailure(error);
  }
}
