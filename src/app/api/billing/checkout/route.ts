import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import {
  getPriceId,
  isBillingCycle,
  isPaidPlan,
} from "@/lib/stripe/plans";

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

  if (!user?.email) {
    return NextResponse.json({ error: "Sign in to choose a plan." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    plan?: unknown;
    billing?: unknown;
  } | null;

  if (!isPaidPlan(body?.plan) || !isBillingCycle(body?.billing)) {
    return NextResponse.json({ error: "Choose a valid plan and billing cycle." }, { status: 400 });
  }

  const stripe = getStripe();
  const { data: existing } = await supabase
    .from("billing_subscriptions")
    .select("stripe_customer_id,stripe_subscription_id,status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    existing?.stripe_subscription_id &&
    ["active", "trialing", "past_due", "unpaid", "paused"].includes(existing.status)
  ) {
    return NextResponse.json(
      { error: "Use Manage billing to change an existing subscription." },
      { status: 409 },
    );
  }

  const origin = appOrigin(request);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: existing?.stripe_customer_id || undefined,
    customer_email: existing?.stripe_customer_id ? undefined : user.email,
    client_reference_id: user.id,
    line_items: [{ price: getPriceId(body.plan, body.billing), quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${origin}/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard/plans?checkout=cancelled`,
    subscription_data: {
      metadata: {
        supabase_user_id: user.id,
        plan: body.plan,
        billing_cycle: body.billing,
      },
    },
    metadata: {
      supabase_user_id: user.id,
      plan: body.plan,
      billing_cycle: body.billing,
    },
  });

  return NextResponse.json({ url: session.url });
}
