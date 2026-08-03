import { NextResponse } from "next/server";
import { processWorkspaceBacklog } from "@/lib/email/process-inbound";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePlan } from "@/lib/effective-plan";
import { hasPlanAccess } from "@/lib/tier-access";

async function requireFeatureAccess() {
  if (!hasPlanAccess(await getEffectivePlan(), "orders")) {
    return NextResponse.json(
      { error: "Orders requires a higher Trading Docks plan." },
      { status: 403 },
    );
  }
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function workspaceId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: preferences } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", userId).maybeSingle();
  if (preferences?.active_workspace_id) return preferences.active_workspace_id as string;
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  return (membership?.workspace_id as string | undefined) ?? null;
}

export async function POST() {
  const accessDenied = await requireFeatureAccess();
  if (accessDenied) return accessDenied;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const id = await workspaceId(supabase, user.id);
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
