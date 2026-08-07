import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/platform/server-access";

export async function PATCH(request: Request) {
  const capability = await requireApiCapability("orders.manage");
  if (!capability.ok) return capability.response;
  const { supabase } = capability;
  const user = capability.user!;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const orderId = String(body?.orderId ?? "");
  if (!orderId) return NextResponse.json({ error: "Order is required." }, { status: 400 });
  const numeric = (value: unknown) => Math.max(0, Number(value) || 0);
  const update = {
    marketplace_fees: numeric(body?.marketplaceFees), shipping_cost: numeric(body?.shippingCost),
    cost_of_goods: numeric(body?.costOfGoods), refund_amount: numeric(body?.refundAmount),
    payout_status: String(body?.payoutStatus ?? "unreconciled"),
    payout_batch_id: String(body?.payoutBatchId ?? "").trim() || null,
    payout_amount: body?.payoutAmount === "" || body?.payoutAmount == null ? null : numeric(body.payoutAmount),
    payout_received_at: body?.payoutReceivedAt || null,
    reconciliation_note: String(body?.note ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("marketplace_orders").update(update).eq("id", orderId).eq("user_id", user.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
