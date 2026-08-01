import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("active_workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();
  let workspaceId = preferences?.active_workspace_id as string | null | undefined;
  if (!workspaceId) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    workspaceId = membership?.workspace_id as string | undefined;
  }
  if (!workspaceId) return NextResponse.json({ error: "No active workspace" }, { status: 409 });

  try {
    const admin = createAdminClient();
    let { data: mailbox, error } = await admin
      .from("inbound_email_mailboxes")
      .select("id,address_token,status,verified_at,last_received_at")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;

    if (!mailbox) {
      const addressToken = `td_${randomBytes(10).toString("hex")}`;
      const created = await admin.from("inbound_email_mailboxes").insert({
        workspace_id: workspaceId,
        created_by: user.id,
        address_token: addressToken,
      }).select("id,address_token,status,verified_at,last_received_at").single();
      if (created.error) throw created.error;
      mailbox = created.data;
    }

    return NextResponse.json({
      address: `${mailbox.address_token}@inbound.tradingdocks.com`,
      status: mailbox.status,
      verifiedAt: mailbox.verified_at,
      lastReceivedAt: mailbox.last_received_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inbox setup failed";
    const migrationMissing = /inbound_email_mailboxes|schema cache|relation/i.test(message);
    return NextResponse.json(
      { error: migrationMissing ? "Inbound email database migration is required." : "Inbox setup failed." },
      { status: migrationMissing ? 503 : 500 },
    );
  }
}
