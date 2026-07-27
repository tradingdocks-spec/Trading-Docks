import { CalendarClock, PanelsTopLeft, ShieldCheck } from "lucide-react";

import { PortalButton } from "@/components/billing/PortalButton";
import { PageHeader } from "@/components/dashboard/common/PageHeader";
import { WorkspaceFrame } from "@/components/dashboard/common/WorkspaceFrame";
import { PLAN_ENTITLEMENTS, normalizeAccountTier } from "@/lib/plan-entitlements";
import { createClient } from "@/lib/supabase/server";

function readableStatus(status?: string | null) {
  if (!status) return "Free plan";
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: subscription } = user
    ? await supabase
        .from("billing_subscriptions")
        .select("plan_id,billing_cycle,status,current_period_end,cancel_at_period_end")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const plan = normalizeAccountTier(subscription?.plan_id);
  const renewalDate = subscription?.current_period_end
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
        new Date(subscription.current_period_end),
      )
    : null;

  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Manage account, integrations, preferences, and security."
        icon={PanelsTopLeft}
      />
      <section className="mt-7 rounded-[26px] border border-white/[0.08] bg-[#07141d] p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
              <ShieldCheck className="h-4 w-4" />
              Subscription
            </div>
            <h2 className="mt-3 text-2xl font-semibold">
              {PLAN_ENTITLEMENTS[plan].name}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {subscription
                ? `${readableStatus(subscription.status)} · ${subscription.billing_cycle === "annual" ? "Annual" : "Monthly"} billing`
                : "No paid subscription is connected to this account."}
            </p>
            {renewalDate && (
              <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <CalendarClock className="h-4 w-4" />
                {subscription?.cancel_at_period_end
                  ? `Access ends ${renewalDate}`
                  : `Renews ${renewalDate}`}
              </p>
            )}
          </div>
          {subscription ? (
            <PortalButton />
          ) : (
            <a
              href="/dashboard/plans"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-[#001018]"
            >
              View plans
            </a>
          )}
        </div>
      </section>
    </WorkspaceFrame>
  );
}
