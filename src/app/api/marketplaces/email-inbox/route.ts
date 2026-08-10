import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INBOUND_DOMAIN = "inbound.tradingdocks.com";

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


async function syncMarketplaceConnection(
  userId: string,
  mailbox: {
    status: string;
    email_provider: string;
    marketplace_id: string;
    verified_at: string | null;
    last_received_at: string | null;
  },
) {
  const admin = createAdminClient();
  const isReady = mailbox.status === "active" || Boolean(mailbox.verified_at) || Boolean(mailbox.last_received_at);
  const now = new Date().toISOString();

  const { error } = await admin.from("marketplace_connections").upsert(
    {
      user_id: userId,
      marketplace_id: mailbox.marketplace_id || "tcgplayer",
      connection_method: "email",
      status: isReady ? "ready" : "setup_required",
      settings: {
        setup_started: true,
        email_provider: mailbox.email_provider,
        permanent_inbound_address: true,
        mailbox_status: mailbox.status,
        verified_at: mailbox.verified_at,
        last_received_at: mailbox.last_received_at,
      },
      last_sync_at: mailbox.last_received_at,
      updated_at: now,
    },
    { onConflict: "user_id,marketplace_id" },
  );

  if (error) throw error;
  return isReady ? "ready" : "setup_required";
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
  const capability = await requireApiCapability("marketplaces.manage");
  if (!capability.ok) return capability.response;
  const user = capability.user!;

  const workspaceId = capability.access.workspaceId;
  if (!workspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 409 });
  }

  try {
    const mailbox = await getOrCreatePermanentMailbox(workspaceId, user.id);
    const connectionStatus = await syncMarketplaceConnection(user.id, mailbox);
    return NextResponse.json({ ...publicMailbox(mailbox), connectionStatus });
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
  const capability = await requireApiCapability("marketplaces.manage");
  if (!capability.ok) return capability.response;
  const user = capability.user!;

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

  const workspaceId = capability.access.workspaceId;
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
    const connectionStatus = await syncMarketplaceConnection(user.id, mailbox);
    return NextResponse.json({ ...publicMailbox(mailbox), connectionStatus });
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
  const capability = await requireApiCapability("marketplaces.manage");
  if (!capability.ok) return capability.response;
  const user = capability.user!;

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

  const workspaceId = capability.access.workspaceId;
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
