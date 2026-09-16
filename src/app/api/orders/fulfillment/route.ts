import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/platform/server-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeInventoryCommit, InventoryCommitError, isOrderId } from "@/lib/inventory-commit";

const actions = new Set(["match", "start_pulling", "mark_picked", "pack", "ship", "complete"]);

export async function PATCH(request: Request) {
  const capability = await requireApiCapability("orders.manage");
  if (!capability.ok) return capability.response;
  const body = await request.json().catch(() => null);
  if (!isOrderId(body?.orderId) || !actions.has(body?.action)
    || (body.action === "mark_picked" && !isOrderId(body.itemId))) {
    return NextResponse.json({ error: "Choose a valid order and fulfillment action." }, { status: 400 });
  }
  try {
    const result = await executeInventoryCommit(createAdminClient(), "commit_order_fulfillment", {
      actor_id: capability.user!.id,
      order_ids: [body.orderId],
      requested_action: body.action,
      details: {
        itemId: body.itemId,
        trackingNumber: typeof body.trackingNumber === "string" ? body.trackingNumber.slice(0, 200) : null,
        carrier: typeof body.carrier === "string" ? body.carrier.slice(0, 100) : null,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Fulfillment could not be confirmed. Retry the same order." },
      { status: error instanceof InventoryCommitError ? error.status : 500 });
  }
}
