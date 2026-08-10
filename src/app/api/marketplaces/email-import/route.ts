import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { INBOUND_DOMAIN } from "@/lib/inbound-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";

export async function GET() {
  const capability = await requireApiCapability("marketplaces.manage");
  if (!capability.ok) return capability.response;
  const user = capability.user!;

  const admin = createAdminClient();
  const { data: existing, error } = await admin.from("inbound_email_addresses")
    .select("address_token,status,last_received_at,verified_at,authorized_forwarder")
    .eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Run the included inbound-email Supabase migration first." }, { status: 503 });

  let data = existing;
  if (!data) {
    const addressToken = `td_${randomBytes(9).toString("hex")}`;
    const created = await admin.from("inbound_email_addresses").insert({ user_id: user.id, address_token: addressToken }).select("address_token,status,last_received_at,verified_at,authorized_forwarder").single();
    if (created.error) return NextResponse.json({ error: "Could not create a private import address." }, { status: 500 });
    data = created.data;
  }

  return NextResponse.json({
    address: `${data.address_token}@${INBOUND_DOMAIN}`,
    status: data.status,
    lastReceivedAt: data.last_received_at,
    verifiedAt: data.verified_at,
    authorizedForwarder: data.authorized_forwarder,
    receiverConfigured: Boolean(process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET),
  });
}

export async function POST() {
  const capability = await requireApiCapability("marketplaces.manage");
  if (!capability.ok) return capability.response;
  const user = capability.user!;
  const admin = createAdminClient();
  const addressToken = `td_${randomBytes(9).toString("hex")}`;
  const { data, error } = await admin.from("inbound_email_addresses").upsert({
    user_id: user.id, address_token: addressToken, status: "pending", verified_at: null, last_received_at: null, authorized_forwarder: null, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).select("address_token").single();
  if (error) return NextResponse.json({ error: "Could not regenerate the private address." }, { status: 500 });
  return NextResponse.json({ address: `${data.address_token}@${INBOUND_DOMAIN}`, status: "pending" });
}
