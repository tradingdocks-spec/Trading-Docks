import { NextResponse } from "next/server";

import {
  normalizeRevenueCatWebhook,
  providerStateFromRevenueCatEvent,
  resolveEffectiveMembership,
  isSupabaseUserId,
  verifyRevenueCatAuthorization,
  revenueCatAuthorizationDiagnostics,
  type ProviderSubscriptionEntitlement,
  type RevenueCatProviderState,
} from "@/lib/revenuecat/reconciliation";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type SupabaseError = {
  message?: string;
  code?: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown webhook processing error.";
}

function canonicalBillingPlanId(tier: string) {
  return tier === "store" ? "business" : tier;
}

async function assertUserExists(supabase: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) {
    const reason = error?.message ?? "User not found.";
    throw new Error(`RevenueCat appUserID does not resolve to a Supabase user: ${reason}`);
  }
}

async function saveProviderEvent({
  supabase,
  eventId,
  eventType,
  userId,
  payload,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  eventId: string;
  eventType: string;
  userId: string | null;
  payload: unknown;
}) {
  const { error } = await supabase.from("billing_provider_events").insert({
    provider: "revenuecat",
    event_id: eventId,
    event_type: eventType,
    user_id: userId,
    payload,
  });

  if (!error) return { duplicate: false };
  if ((error as SupabaseError).code === "23505") {
    const existing = await supabase
      .from("billing_provider_events")
      .select("processed_at")
      .eq("provider", "revenuecat")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    return { duplicate: Boolean(existing.data?.processed_at) };
  }
  throw error;
}

async function markProviderEventProcessed({
  supabase,
  eventId,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  eventId: string;
}) {
  const { error } = await supabase
    .from("billing_provider_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", "revenuecat")
    .eq("event_id", eventId);
  if (error) throw error;
}

async function saveProviderState({
  supabase,
  state,
  payload,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  state: RevenueCatProviderState;
  payload: unknown;
}) {
  const { error } = await supabase.from("billing_provider_subscriptions").upsert(
    {
      user_id: state.userId,
      provider: state.provider,
      provider_customer_id: state.providerCustomerId,
      provider_subscription_id: state.providerSubscriptionId,
      provider_transaction_id: state.providerTransactionId,
      product_id: state.productId,
      plan_id: state.planId,
      billing_cycle: state.billingCycle,
      status: state.status,
      cancel_at_period_end: state.cancelAtPeriodEnd,
      current_period_start: state.currentPeriodStart,
      current_period_end: state.currentPeriodEnd,
      environment: state.environment,
      raw_event_type: state.rawEventType,
      raw_event: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,provider_subscription_id" },
  );
  if (error) throw error;
}

async function providerEntitlementsForUser(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const [stripeResult, revenueCatResult, overrideResult] = await Promise.all([
    supabase
      .from("billing_subscriptions")
      .select("plan_id,status,current_period_end,updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("billing_provider_subscriptions")
      .select("provider,plan_id,status,current_period_end,updated_at")
      .eq("user_id", userId),
    supabase
      .from("admin_membership_overrides")
      .select("plan_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (stripeResult.error) throw stripeResult.error;
  if (revenueCatResult.error) throw revenueCatResult.error;
  if (overrideResult.error) throw overrideResult.error;

  const entitlements: ProviderSubscriptionEntitlement[] = [];
  if (stripeResult.data) {
    entitlements.push({
      provider: "stripe",
      planId: stripeResult.data.plan_id,
      status: stripeResult.data.status,
      currentPeriodEnd: stripeResult.data.current_period_end,
      updatedAt: stripeResult.data.updated_at,
    });
  }

  for (const row of revenueCatResult.data ?? []) {
    entitlements.push({
      provider: row.provider,
      planId: row.plan_id,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
      updatedAt: row.updated_at,
    });
  }

  return {
    entitlements,
    manualOverride: overrideResult.data?.plan_id as string | null | undefined,
  };
}

async function saveCanonicalMembership({
  supabase,
  userId,
  tier,
  status,
  periodEnd,
}: {
  supabase: ReturnType<typeof createAdminClient>;
  userId: string;
  tier: string;
  status: string;
  periodEnd: string | null;
}) {
  const { error } = await supabase.from("billing_subscriptions").upsert(
    {
      user_id: userId,
      plan_id: tier,
      status,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function POST(request: Request) {
  const authorizationHeader = request.headers.get("authorization");
  const configuredSecret = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
  if (!verifyRevenueCatAuthorization(
    authorizationHeader,
    configuredSecret,
  )) {
    return NextResponse.json(
      {
        error: "Unauthorized webhook.",
        diagnostics: revenueCatAuthorizationDiagnostics(authorizationHeader, configuredSecret),
      },
      { status: 401 },
    );
  }

  const payload = await request.json().catch(() => null);
  const event = normalizeRevenueCatWebhook(payload);
  if (!event) {
    return NextResponse.json({ error: "Malformed RevenueCat event." }, { status: 400 });
  }
  if (event.type === "TEST") {
    return NextResponse.json({ received: true, test: true });
  }
  if (!isSupabaseUserId(event.appUserId)) {
    return NextResponse.json({ error: "Invalid RevenueCat appUserID." }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    await assertUserExists(supabase, event.appUserId);

    const eventAudit = await saveProviderEvent({
      supabase,
      eventId: event.eventId,
      eventType: event.rawType,
      userId: event.appUserId,
      payload,
    });
    if (eventAudit.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.type === "UNKNOWN") {
      await markProviderEventProcessed({ supabase, eventId: event.eventId });
      return NextResponse.json({ received: true, ignored: true });
    }

    const providerState = providerStateFromRevenueCatEvent(event);
    if (!providerState) {
      return NextResponse.json({ error: "RevenueCat event is not actionable." }, { status: 400 });
    }

    await saveProviderState({ supabase, state: providerState, payload });

    const { entitlements, manualOverride } = await providerEntitlementsForUser(
      supabase,
      event.appUserId,
    );
    const effective = resolveEffectiveMembership({ providerEntitlements: entitlements, manualOverride });

    if (effective.source !== "manual") {
      await saveCanonicalMembership({
        supabase,
        userId: event.appUserId,
        tier: canonicalBillingPlanId(effective.tier),
        status: effective.status,
        periodEnd: effective.periodEnd,
      });
    }

    await markProviderEventProcessed({ supabase, eventId: event.eventId });

    return NextResponse.json({
      received: true,
      membership: effective.tier,
      source: effective.source,
    });
  } catch (error) {
    console.error("RevenueCat webhook processing failed", errorMessage(error));
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
