import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type BinderShareRequest = {
  title?: string;
  mode?: "showcase" | "trade";
  payload?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as BinderShareRequest | null;
  const title = String(body?.title ?? "").trim().slice(0, 120);
  const mode = body?.mode === "trade" ? "trade" : "showcase";
  const payload = body?.payload;

  if (!title || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Binder title and showcase data are required." }, { status: 400 });
  }

  const token = crypto.randomUUID().replaceAll("-", "");
  const admin = createAdminClient();
  const { error } = await admin.from("binder_shares").insert({
    token,
    owner_id: user.id,
    title,
    mode,
    payload,
  });

  if (error) {
    return NextResponse.json({ error: error.message.includes("binder_shares") ? "Run the binder share migration first." : error.message }, { status: 500 });
  }

  return NextResponse.json({ url: `${new URL(request.url).origin}/share/binder/${token}` });
}
