import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTcgplayerOrderEmail } from "@/lib/marketplaces/tcgplayer-email-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EMAIL_BYTES = 10 * 1024 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 300;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function headerValue(raw: string, name: string) {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+(?:\\r?\\n[ \\t].+)*)$`, "im"));
  return match?.[1]?.replace(/\r?\n[ \t]+/g, " ").trim() ?? null;
}

function classify(raw: string) {
  const haystack = raw.slice(0, 250_000).toLowerCase();
  const marketplace = haystack.includes("tcgplayer") ? "tcgplayer"
    : haystack.includes("ebay") ? "ebay"
    : haystack.includes("shopify") ? "shopify"
    : haystack.includes("whatnot") ? "whatnot"
    : haystack.includes("etsy") ? "etsy" : null;
  const messageType = /confirm|verification|verify forwarding/.test(haystack) ? "verification"
    : /refund|refunded/.test(haystack) ? "refund"
    : /cancel|cancelled|canceled/.test(haystack) ? "cancellation"
    : /shipped|tracking number|shipment/.test(haystack) ? "shipment"
    : /new order|order number|order #|you made a sale|sold/.test(haystack) ? "order" : "unknown";
  return { marketplace, messageType };
}

export async function POST(request: Request) {
  const secret = process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Receiver is not configured" }, { status: 503 });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_EMAIL_BYTES) return NextResponse.json({ error: "Message too large" }, { status: 413 });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_EMAIL_BYTES) {
    return NextResponse.json({ error: "Invalid message size" }, { status: 400 });
  }

  const timestamp = request.headers.get("x-td-timestamp") ?? "";
  const signature = request.headers.get("x-td-signature") ?? "";
  const recipient = (request.headers.get("x-td-recipient") ?? "").toLowerCase();
  const sender = request.headers.get("x-td-sender");
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > MAX_CLOCK_SKEW_SECONDS) {
    return NextResponse.json({ error: "Expired request" }, { status: 401 });
  }
  const expected = createHmac("sha256", secret).update(timestamp).update(".").update(bytes).digest("hex");
  if (!safeEqual(signature, expected)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const localPart = recipient.split("@")[0];
  if (!/^td_[a-z0-9]{16,40}$/.test(localPart)) {
    return NextResponse.json({ error: "Unknown recipient" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: mailbox, error: mailboxError } = await admin
    .from("inbound_email_mailboxes")
    .select("id,workspace_id,workspaces(owner_id)")
    .eq("address_token", localPart)
    .neq("status", "disabled")
    .maybeSingle();
  if (mailboxError || !mailbox) return NextResponse.json({ error: "Unknown recipient" }, { status: 404 });

  const raw = bytes.toString("utf8");
  const digest = createHash("sha256").update(bytes).digest("hex");
  const classification = classify(raw);
  const parsed = classification.marketplace === "tcgplayer" && classification.messageType === "order" ? parseTcgplayerOrderEmail(raw) : null;
  const processingStatus = classification.messageType === "verification" ? "processed" : parsed ? "received" : "needs_review";
  const { data: storedMessage, error: insertError } = await admin.from("inbound_email_messages").insert({
    mailbox_id: mailbox.id,
    workspace_id: mailbox.workspace_id,
    recipient,
    sender,
    message_id: headerValue(raw, "Message-ID"),
    subject: headerValue(raw, "Subject"),
    marketplace_id: classification.marketplace,
    message_type: classification.messageType,
    processing_status: processingStatus,
    content_sha256: digest,
    raw_message: raw,
  }).select("id").maybeSingle();
  if (insertError && insertError.code !== "23505") {
    return NextResponse.json({ error: "Message could not be stored" }, { status: 500 });
  }

  if (!insertError && storedMessage && parsed) {
    const workspace = Array.isArray(mailbox.workspaces) ? mailbox.workspaces[0] : mailbox.workspaces;
    const ownerId = workspace?.owner_id;
    if (ownerId) {
      const now = new Date().toISOString();
      const { data: order, error: orderError } = await admin.from("marketplace_orders").upsert({
        user_id: ownerId,
        marketplace_id: "tcgplayer",
        external_order_id: parsed.orderId,
        order_status: "new",
        payment_status: "paid",
        fulfillment_status: "unfulfilled",
        normalized_status: "new",
        currency: "USD",
        subtotal: parsed.subtotal,
        shipping: parsed.shipping,
        tax: parsed.tax,
        total: parsed.total,
        buyer_alias: parsed.buyer,
        ordered_at: parsed.orderedAt ?? now,
        last_modified_at: now,
        source_type: "email",
        raw_snapshot: { inbound_email_message_id: storedMessage.id, parser: "tcgplayer-email-v1" },
        updated_at: now,
      }, { onConflict: "user_id,marketplace_id,external_order_id" }).select("id").single();

      if (!orderError && order && parsed.items.length) {
        await admin.from("marketplace_order_items").upsert(parsed.items.map((item) => ({
          user_id: ownerId,
          marketplace_order_id: order.id,
          external_line_item_id: item.lineId,
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          currency: "USD",
          condition: item.condition,
          language: item.language,
          finish: item.finish,
          match_status: "unmatched",
          raw_snapshot: { inbound_email_message_id: storedMessage.id },
          updated_at: now,
        })), { onConflict: "user_id,marketplace_order_id,external_line_item_id" });
      }

      await admin.from("inbound_email_messages").update(orderError ? {
        processing_status: "failed", processing_error: orderError.message, processed_at: now,
      } : {
        processing_status: parsed.items.length ? "processed" : "needs_review",
        processing_error: parsed.items.length ? null : "Order saved, but line items could not be read automatically.",
        processed_at: now,
      }).eq("id", storedMessage.id);
    }
  }

  await admin.from("inbound_email_mailboxes").update({
    status: "active",
    verified_at: new Date().toISOString(),
    last_received_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", mailbox.id);

  return NextResponse.json({ accepted: true, duplicate: insertError?.code === "23505" });
}
