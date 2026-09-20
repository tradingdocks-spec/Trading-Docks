import { notFound, redirect } from "next/navigation";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { captureSecretFingerprint, verifyCanonicalCaptureTokenDetailed } from "@/lib/marketing/canonical-capture-auth";
import { getMarketingDemoFixture } from "@/lib/marketing/marketing-demo-fixtures";
import { registryFeatureFor } from "@/lib/marketing/product-marketing-registry";

export const dynamic = "force-dynamic";

export default async function MarketingCapturePage({ params, searchParams }: { params: Promise<{ feature: string; state: string }>; searchParams: Promise<{ capture_token?: string | string[] }> }) {
  const { feature: featureSlug, state } = await params;
  const query = await searchParams;
  const token = Array.isArray(query.capture_token) ? query.capture_token[0] : query.capture_token;
  const tokenResult = token
    ? verifyCanonicalCaptureTokenDetailed(token, featureSlug, state, process.env.MARKETING_CAPTURE_SECRET ?? "")
    : { code: "TOKEN_MISSING" as const };
  const tokenAuthorized = tokenResult.code === "VALID";
  if (!tokenAuthorized) {
    if (token) console.warn("[marketing-capture-auth]", {
      code: tokenResult.code,
      feature: featureSlug,
      state,
      secretConfigured: Boolean(process.env.MARKETING_CAPTURE_SECRET),
      secretFingerprint: process.env.MARKETING_CAPTURE_SECRET ? captureSecretFingerprint(process.env.MARKETING_CAPTURE_SECRET) : null,
      verifierDeploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      verifierHost: process.env.VERCEL_URL ? new URL(process.env.VERCEL_URL.includes("://") ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`).hostname : null,
    });
    const actor = await requireServerPlatformRole("admin");
    if (!actor) {
      if (token) notFound();
      redirect("/dashboard");
    }
  }
  const feature = registryFeatureFor(featureSlug);
  const fixture = getMarketingDemoFixture(featureSlug, state);
  if (!feature || !fixture) notFound();
  return (
    <main data-marketing-capture-ready="true" className="min-h-screen bg-td-canvas p-8 text-td-primary">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between border-b border-td-ink/10 pb-6"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-td-accent">Trading Docks · canonical product capture</p><h1 className="mt-2 text-3xl font-semibold">{feature.name}</h1><p className="mt-2 text-sm text-td-secondary">{fixture.label} · Synthetic demo state only</p></div><span className="rounded-full border border-td-success/30 bg-td-success/10 px-3 py-1.5 text-xs font-semibold text-td-success">Admin capture</span></div>
        <section className="mt-8 rounded-2xl border border-td-ink/10 bg-td-surface/60 p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-td-accent">{feature.route}</p><h2 className="mt-2 text-xl font-semibold">{fixture.label}</h2><p className="mt-2 text-sm text-td-muted">Data source: Approved product metadata + synthetic demo state</p></div><div className="rounded-xl border border-td-warning/20 bg-td-warning/5 px-4 py-3 text-xs text-td-warning">No customer records · No real user IDs · No live account data</div></div><div className="mt-6 grid gap-4 md:grid-cols-3">{fixture.records.map((record, index) => <article key={index} className="rounded-xl border border-td-ink/10 bg-td-canvas p-4"><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-td-muted">Synthetic record {index + 1}</p>{Object.entries(record).map(([key, value]) => <div key={key} className="mt-3 flex items-start justify-between gap-3 border-b border-td-ink/[.06] pb-2 text-sm last:border-0"><span className="text-td-muted">{key.replaceAll("_", " ")}</span><span className="text-right font-medium text-td-primary">{Array.isArray(value) ? value.join(" · ") : String(value)}</span></div>)}</article>)}</div></section>
      </div>
    </main>
  );
}
