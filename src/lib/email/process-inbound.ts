import { parseTcgplayerOrder } from "@/lib/email/tcgplayer";

type AdminClient = any;

type Message = {
  id: string;
  workspace_id: string;
  marketplace_id: string | null;
  message_type: string;
  raw_message: string;
  received_at: string;
};

export async function processInboundMessage(admin: AdminClient, message: Message) {
  if (message.message_type !== "order" || message.marketplace_id !== "tcgplayer") {
    return { imported: false, reason: "unsupported" as const };
  }

  const parsed = parseTcgplayerOrder(message.raw_message);
  if (!parsed) {
    await admin.from("inbound_email_messages").update({
      processing_status: "needs_review",
      processing_error: "TCGplayer order detected, but the order number or required structure could not be parsed.",
      parser_version: "tcgplayer-email-v1",
      processed_at: new Date().toISOString(),
    }).eq("id", message.id);
    return { imported: false, reason: "unparsed" as const };
  }

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("owner_id")
    .eq("id", message.workspace_id)
    .single();
  if (workspaceError || !workspace?.owner_id) throw workspaceError ?? new Error("Workspace owner was not found.");

  const userId = workspace.owner_id as string;
  const now = new Date().toISOString();
  const reviewRequired = parsed.confidence < 0.72 || parsed.items.length === 0;
  const { data: order, error: orderError } = await admin
    .from("marketplace_orders")
    .upsert({
      user_id: userId,
      marketplace_id: "tcgplayer",
      external_order_id: parsed.externalOrderId,
      order_status: "new",
      payment_status: "paid",
      fulfillment_status: "unfulfilled",
      normalized_status: "new",
      currency: "USD",
      subtotal: parsed.subtotal,
      shipping: parsed.shipping,
      tax: parsed.tax,
      total: parsed.total,
      buyer_alias: parsed.buyerAlias,
      ordered_at: parsed.orderedAt,
      last_modified_at: now,
      source_type: "email",
      import_batch_id: `email:${message.id}`,
      raw_snapshot: {
        source: "tcgplayer_email",
        inbound_message_id: message.id,
        parser_version: "tcgplayer-email-v1",
        parser_confidence: parsed.confidence,
        parser_warnings: parsed.warnings,
      },
      updated_at: now,
    }, { onConflict: "user_id,marketplace_id,external_order_id" })
    .select("id")
    .single();
  if (orderError || !order) throw orderError ?? new Error("Order could not be saved.");

  for (const item of parsed.items) {
    const externalLineItemId = `${parsed.externalOrderId}:${item.lineId}`;
    const { error: itemError } = await admin.from("marketplace_order_items").upsert({
      user_id: userId,
      marketplace_order_id: order.id,
      external_line_item_id: externalLineItemId,
      title: item.title,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      currency: "USD",
      condition: item.condition,
      finish: item.finish,
      language: item.language ?? "English",
      match_status: "unmatched",
      raw_snapshot: { source: "tcgplayer_email", raw_line: item.raw },
      updated_at: now,
    }, { onConflict: "user_id,marketplace_order_id,external_line_item_id" });
    if (itemError) throw itemError;
  }

  await admin.from("inbound_email_messages").update({
    processing_status: reviewRequired ? "needs_review" : "processed",
    processing_error: reviewRequired ? parsed.warnings.join(" ") || "Low parser confidence." : null,
    parsed_order_id: order.id,
    parser_version: "tcgplayer-email-v1",
    parser_confidence: parsed.confidence,
    processed_at: now,
  }).eq("id", message.id);

  return { imported: true, reviewRequired, orderId: order.id, confidence: parsed.confidence };
}

export async function processWorkspaceBacklog(admin: AdminClient, workspaceId: string, limit = 100) {
  const { data: messages, error } = await admin
    .from("inbound_email_messages")
    .select("id,workspace_id,marketplace_id,message_type,raw_message,received_at")
    .eq("workspace_id", workspaceId)
    .eq("marketplace_id", "tcgplayer")
    .eq("message_type", "order")
    .in("processing_status", ["received", "needs_review", "failed"])
    .order("received_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 250)));
  if (error) throw error;

  let imported = 0;
  let review = 0;
  let failed = 0;
  for (const message of messages ?? []) {
    try {
      const result = await processInboundMessage(admin, message as Message);
      if (result.imported) imported += 1;
      if (result.imported && result.reviewRequired) review += 1;
    } catch (error) {
      failed += 1;
      await admin.from("inbound_email_messages").update({
        processing_status: "failed",
        processing_error: error instanceof Error ? error.message.slice(0, 1000) : "Processing failed.",
        parser_version: "tcgplayer-email-v1",
        processed_at: new Date().toISOString(),
      }).eq("id", message.id);
    }
  }
  return { scanned: messages?.length ?? 0, imported, review, failed };
}
