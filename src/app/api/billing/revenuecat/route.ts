import { NextResponse } from "next/server";

import {
  inspectRevenueCatWebBillingConfiguration,
  isRevenueCatWebBillingCycle,
  isRevenueCatWebPurchasePlan,
  revenueCatWebPurchaseUrlFor,
} from "@/lib/revenuecat/web-billing";
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
    return NextResponse.json({ error: "Sign in to choose a plan." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    plan?: unknown;
    billing?: unknown;
  } | null;

  if (!isRevenueCatWebPurchasePlan(body?.plan) || !isRevenueCatWebBillingCycle(body?.billing)) {
    return NextResponse.json({ error: "Choose a valid plan and billing cycle." }, { status: 400 });
  }

  const url = revenueCatWebPurchaseUrlFor({
    plan: body.plan,
    billing: body.billing,
    appUserId: user.id,
    email: user.email ?? null,
    returnUrl: `${appOrigin(request)}/dashboard/settings?billing=revenuecat`,
  });

  if (!url) {
    const config = inspectRevenueCatWebBillingConfiguration();
    return NextResponse.json(
      {
        error: "RevenueCat web purchases are not configured.",
        missing: config.missingPurchaseEnv,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ url });
}
