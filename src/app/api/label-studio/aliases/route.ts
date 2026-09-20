import {
  labelBody,
  labelContext,
  labelFailure,
} from "@/lib/label-studio/server";
export async function POST(request: Request) {
  try {
    const body = await labelBody(request);
    const c = await labelContext("label.manage_templates");
    if (!c.ok) return c.response;
    if (
      typeof body.identityId !== "string" ||
      typeof body.value !== "string" ||
      !["sku", "upc_ean", "external"].includes(String(body.type))
    )
      throw new Error("Invalid barcode mapping.");
    const { data, error } = await c.supabase.rpc("assign_label_barcode", {
      p_workspace_id: c.workspaceId,
      p_identity_id: body.identityId,
      p_value: body.value,
      p_type: body.type,
      p_active: body.active !== false,
    });
    if (error) {
      const code = [
        "POS_BARCODE_AMBIGUOUS",
        "POS_FORBIDDEN",
        "POS_INVALID",
      ].find((code) => error.message.includes(code));
      throw new Error(code ?? "Barcode assignment failed.");
    }
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return labelFailure(error);
  }
}
