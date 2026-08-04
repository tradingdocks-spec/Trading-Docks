import { NextResponse } from "next/server";

import { sanitizeLegacyBinderPayload, safeText } from "@/lib/public-share-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type BinderShareRequest = {
  title?: string;
  mode?: "showcase" | "trade";
  payload?: Record<string, unknown>;
  expiresAt?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as BinderShareRequest | null;
  const title = safeText(body?.title, 120);
  const mode = body?.mode === "trade" ? "trade" : "showcase";
  const payload = sanitizeLegacyBinderPayload(body?.payload);

  if (!title || payload.cards.length === 0) {
    return NextResponse.json(
      { error: "Binder title and at least one safe shared card are required." },
      { status: 400 },
    );
  }

  let expiresAt: string | null = null;
  if (body?.expiresAt) {
    const date = new Date(body.expiresAt);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "Expiration must be a valid future date." },
        { status: 400 },
      );
    }
    expiresAt = date.toISOString();
  }

  const token = crypto.randomUUID().replaceAll("-", "");
  const admin = createAdminClient();
  const { error } = await admin.from("binder_shares").insert({
    token,
    owner_id: user.id,
    title,
    mode,
    payload,
    expires_at: expiresAt,
    is_active: true,
    revoked_at: null,
    allow_interested_lists: mode === "trade",
    require_account_for_actions: true,
    noindex: true,
  });

  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes("binder_shares")
          ? "Run the public share security migration first."
          : "The binder share could not be created.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: `${new URL(request.url).origin}/share/binder/${token}`,
  });
}
