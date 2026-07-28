import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { planForPriceId } from "@/lib/stripe/plans";
import { getStripe } from "@/lib/stripe/server";

function unixDate(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

async function saveSubscription(subscription: Stripe.Subscription) {
  const firstItem = subscription.items.data[0];
  const mapping = firstItem ? planForPriceId(firstItem.price.id) : null;
  const userId = subscription.metadata.supabase_user_id;

  if (!userId || !mapping) {
    throw new Error(`Subscription ${subscription.id} is missing recognized plan metadata.`);
  }

  const supabase = createAdminClient();
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const { error } = await supabase.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: firstItem.price.id,
      plan_id: mapping.plan,
      billing_cycle: mapping.billing,
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start: unixDate(firstItem.current_period_start),
      current_period_end: unixDate(firstItem.current_period_end),
      canceled_at: unixDate(subscription.canceled_at),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await saveSubscription(event.data.object);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (typeof session.subscription === "string") {
        const subscription = await getStripe().subscriptions.retrieve(session.subscription);
        await saveSubscription(subscription);
      }
    }
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
