import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!/^[A-Za-z0-9_-]{24,160}$/.test(normalizedToken)) {
    return NextResponse.json({ error: "Invalid unsubscribe token." }, { status: 400 });
  }
  const tokenHash = createHash("sha256").update(normalizedToken).digest("hex");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("marketing_campaign_recipients")
    .select("id,workspace_id,customer_id")
    .eq("unsubscribe_token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Unsubscribe lookup failed." }, { status: 500 });
  }
  if (!data?.customer_id) {
    return NextResponse.json({ error: "Unsubscribe link is invalid or expired." }, { status: 404 });
  }

  const { error: updateError } = await admin
    .from("crm_customers")
    .update({
      marketing_status: "unsubscribed",
      marketing_email_consent: false,
      marketing_opt_out_at: new Date().toISOString(),
      suppression_reason: null,
    })
    .eq("id", data.customer_id)
    .eq("workspace_id", data.workspace_id);

  if (updateError) {
    return NextResponse.json({ error: "Customer marketing status could not be updated." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "You have been unsubscribed from marketing email." });
}
