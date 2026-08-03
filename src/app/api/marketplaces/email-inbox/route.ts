import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INBOUND_DOMAIN = "inbound.tradingdocks.com";

async function activeWorkspaceId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("active_workspace_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (preferences?.active_workspace_id) {
    return preferences.active_workspace_id as string;
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (membership?.workspace_id as string | undefined) ?? null;
}

function publicMailbox(mailbox: {
  address_token: string;
  status: string;
  verified_at: string | null;
  last_received_at: string | null;
  email_provider: string;
  marketplace_id: string;
  rotation_count?: number | null;
  rotated_at?: string | null;
}) {
  return {
    address: `${mailbox.address_token}@${INBOUND_DOMAIN}`,
    status: mailbox.status,
    verifiedAt: mailbox.verified_at,
    lastReceivedAt: mailbox.last_received_at,
    provider: mailbox.email_provider,
    marketplaceId: mailbox.marketplace_id,
    rotationCount: mailbox.rotation_count ?? 0,
    rotatedAt: mailbox.rotated_at ?? null,
    permanent: true,
  };
}

async function getOrCreatePermanentMailbox(workspaceId: string, userId: string) {
  const admin = createAdminClient();

  const existing = await admin
    .from("inbound_email_mailboxes")
    .select(
      "id,address_token,status,verified_at,last_received_at,email_provider,marketplace_id,rotation_count,rotated_at",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const addressToken = `td_${randomBytes(10).toString("hex")}`;
  const created = await admin
    .from("inbound_email_mailboxes")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      address_token: addressToken,
    })
    .select(
      "id,address_token,status,verified_at,last_received_at,email_provider,marketplace_id,rotation_count,rotated_at",
    )
    .single();

  if (!created.error) return created.data;

  // First-load race protection: the unique workspace constraint allows only one.
  if (created.error.code === "23505") {
    const raced = await admin
      .from("inbound_email_mailboxes")
      .select(
        "id,address_token,status,verified_at,last_received_at,email_provider,marketplace_id,rotation_count,rotated_at",
      )
      .eq("workspace_id", workspaceId)
      .single();

    if (raced.error) throw raced.error;
    return raced.data;
  }

  throw created.error;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await activeWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 409 });
  }

  try {
    const mailbox = await getOrCreatePermanentMailbox(workspaceId, user.id);
    return NextResponse.json(publicMailbox(mailbox));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inbox setup failed";
    const migrationMissing =
      /inbound_email_mailboxes|rotation_count|rotated_at|schema cache|relation/i.test(message);

    return NextResponse.json(
      {
        error: migrationMissing
          ? "Inbound email database migration is required."
          : "Inbox setup failed.",
      },
      { status: migrationMissing ? 503 : 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    provider?: string;
    marketplaceId?: string;
  } | null;

  if (
    !body ||
    !["gmail", "outlook"].includes(body.provider ?? "") ||
    !/^[a-z0-9-]{2,40}$/.test(body.marketplaceId ?? "")
  ) {
    return NextResponse.json(
      { error: "Invalid email setup selection" },
      { status: 400 },
    );
  }

  const workspaceId = await activeWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 409 });
  }

  try {
    await getOrCreatePermanentMailbox(workspaceId, user.id);
    const admin = createAdminClient();

    const { data: mailbox, error } = await admin
      .from("inbound_email_mailboxes")
      .update({
        email_provider: body.provider,
        marketplace_id: body.marketplaceId,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .select(
        "address_token,status,verified_at,last_received_at,email_provider,marketplace_id,rotation_count,rotated_at",
      )
      .single();

    if (error) throw error;
    return NextResponse.json(publicMailbox(mailbox));
  } catch {
    return NextResponse.json(
      { error: "Could not save email setup" },
      { status: 500 },
    );
  }
}

/**
 * Address rotation is deliberately isolated from normal setup.
 * It succeeds only after an administrator explicitly submits ROTATE.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    confirmation?: string;
  } | null;

  if (body?.confirmation !== "ROTATE") {
    return NextResponse.json(
      {
        error:
          'Address rotation requires explicit confirmation. Enter "ROTATE".',
      },
      { status: 400 },
    );
  }

  const workspaceId = await activeWorkspaceId(supabase, user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 409 });
  }

  try {
    const admin = createAdminClient();
    const current = await getOrCreatePermanentMailbox(workspaceId, user.id);
    const addressToken = `td_${randomBytes(10).toString("hex")}`;

    const { data: mailbox, error } = await admin
      .from("inbound_email_mailboxes")
      .update({
        address_token: addressToken,
        status: "pending",
        verified_at: null,
        last_received_at: null,
        rotation_count: (current.rotation_count ?? 0) + 1,
        rotated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .select(
        "address_token,status,verified_at,last_received_at,email_provider,marketplace_id,rotation_count,rotated_at",
      )
      .single();

    if (error) throw error;
    return NextResponse.json(publicMailbox(mailbox));
  } catch {
    return NextResponse.json(
      { error: "Could not rotate the private address." },
      { status: 500 },
    );
  }
}
