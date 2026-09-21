import { notFound, redirect } from "next/navigation";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { captureSecretFingerprint, verifyCanonicalCaptureTokenDetailed } from "@/lib/marketing/canonical-capture-auth";
import { getMarketingDemoFixture } from "@/lib/marketing/marketing-demo-fixtures";
import { registryFeatureFor } from "@/lib/marketing/product-marketing-registry";
import { ProductCaptureShell } from "@/components/marketing/MarketingProductShell";

export const dynamic = "force-dynamic";
// ProductCaptureShell renders the server-side product-only capture region and ready marker.

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
  return <ProductCaptureShell featureName={feature.name} state={state} />;
}
