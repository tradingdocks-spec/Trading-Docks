import { PanelsTopLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard/common/PageHeader";
import { WorkspaceFrame } from "@/components/dashboard/common/WorkspaceFrame";
import { SettingsCenter } from "@/components/dashboard/settings/SettingsCenter";
import { getEffectivePlan } from "@/lib/effective-plan";
import { PLAN_ENTITLEMENTS, normalizeAccountTier } from "@/lib/plan-entitlements";
import { createClient } from "@/lib/supabase/server";

function readableStatus(status?: string | null) {
  if (!status) return "Free plan";
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const supabase = await createClient();
  const { section = "overview" } = await searchParams;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: subscription }, { data: preferencesRow }, effectivePlan] = user
    ? await Promise.all([
        supabase
        .from("billing_subscriptions")
        .select("plan_id,billing_cycle,status,current_period_end,cancel_at_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),
        supabase
          .from("user_preferences")
          .select("preferences")
          .eq("user_id", user.id)
          .maybeSingle(),
        getEffectivePlan(),
      ])
    : [{ data: null }, { data: null }, normalizeAccountTier("free")] as const;
  const plan = effectivePlan;
  const renewalDate = subscription?.current_period_end
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
        new Date(subscription.current_period_end),
      )
    : null;

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Settings"
        title="Your control center"
        description="Manage your account, selling workflows, inventory rules, integrations, team access, billing, and security from one place."
        icon={PanelsTopLeft}
      />
      <SettingsCenter
        initialSection={section}
        initialSettings={
          preferencesRow?.preferences &&
          typeof preferencesRow.preferences === "object" &&
          !Array.isArray(preferencesRow.preferences) &&
          preferencesRow.preferences.settings &&
          typeof preferencesRow.preferences.settings === "object" &&
          !Array.isArray(preferencesRow.preferences.settings)
            ? preferencesRow.preferences.settings
            : {}
        }
        email={user?.email ?? ""}
        plan={plan}
        planName={PLAN_ENTITLEMENTS[plan].name}
        subscription={
          subscription
            ? {
                status: readableStatus(subscription.status),
                billingCycle: subscription.billing_cycle === "annual" ? "Annual" : "Monthly",
                renewalDate,
                cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
              }
            : null
        }
      />
    </WorkspaceFrame>
  );
}
