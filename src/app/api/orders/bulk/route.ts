import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/platform/server-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeInventoryCommit, InventoryCommitError, isOrderId } from "@/lib/inventory-commit";

const allowedStatuses = new Set(["new", "processing", "shipped", "delivered", "cancelled", "refunded"]);

export async function PATCH(request: Request) {
  const capability = await requireApiCapability("orders.manage");
  if (!capability.ok) return capability.response;
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.ids) || !body.ids.length || body.ids.length > 250
    || !body.ids.every(isOrderId) || !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Choose between 1 and 250 valid orders and a valid status." }, { status: 400 });
  }
  try {
    const result = await executeInventoryCommit(createAdminClient(), "commit_order_fulfillment", {
      actor_id: capability.user!.id,
      order_ids: [...new Set(body.ids)],
      requested_action: `status:${body.status}`,
      details: {},
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order updates could not be confirmed. Retry the same orders." },
      { status: error instanceof InventoryCommitError ? error.status : 500 });
  }
}
