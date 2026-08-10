import { NextResponse } from "next/server";
import { processWorkspaceBacklog } from "@/lib/email/process-inbound";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const capability = await requireApiCapability("orders.manage");
  if (!capability.ok) return capability.response;
  const { supabase } = capability;
  const user = capability.user!;
  const id = capability.access.workspaceId;
  if (!id) return NextResponse.json({ error: "No active workspace." }, { status: 409 });
  try {
    const admin = createAdminClient();
    const result = await processWorkspaceBacklog(admin, id, 250);

    const { data: mailbox } = await admin
      .from("inbound_email_mailboxes")
      .select("status,verified_at,last_received_at,email_provider,marketplace_id")
      .eq("workspace_id", id)
      .maybeSingle();

    const mailboxReady = Boolean(
      mailbox &&
        (mailbox.status === "active" || mailbox.verified_at || mailbox.last_received_at),
    );

    if (mailbox) {
      const { error: connectionError } = await admin
        .from("marketplace_connections")
        .upsert(
          {
            user_id: user.id,
            marketplace_id: mailbox.marketplace_id || "tcgplayer",
            connection_method: "email",
            status: mailboxReady ? "ready" : "setup_required",
            settings: {
              setup_started: true,
              email_provider: mailbox.email_provider,
              permanent_inbound_address: true,
              mailbox_status: mailbox.status,
              verified_at: mailbox.verified_at,
              last_received_at: mailbox.last_received_at,
              last_email_import: new Date().toISOString(),
              imported_messages: result.imported,
              review_messages: result.review,
              failed_messages: result.failed,
            },
            last_sync_at: mailbox.last_received_at ?? new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,marketplace_id" },
        );

      if (connectionError) throw connectionError;
    }

    return NextResponse.json({
      ...result,
      mailboxStatus: mailbox?.status ?? "pending",
      connectionStatus: mailboxReady ? "ready" : "setup_required",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Email processing failed." }, { status: 500 });
  }
}
