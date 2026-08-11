import { NextResponse } from "next/server";

import { revenueCatWebManagementUrlFor } from "@/lib/revenuecat/web-billing";
import { createClient } from "@/lib/supabase/server";

function appOrigin(request: Request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(request.url).origin
  ).replace(/\/$/, "");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: "Sign in to manage billing." }, { status: 401 });
  }

  const url = revenueCatWebManagementUrlFor({
    appUserId: user.id,
    email: user.email ?? null,
    returnUrl: `${appOrigin(request)}/dashboard/settings?billing=revenuecat`,
  });

  if (!url) {
    return NextResponse.json(
      { error: "RevenueCat subscription management is not configured." },
      { status: 503 },
    );
  }

  return NextResponse.json({ url });
}
