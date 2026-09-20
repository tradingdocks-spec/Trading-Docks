export type MarketingCaptureEnvironment = "preview" | "production";
export type MarketingCaptureTarget = {
  environment: MarketingCaptureEnvironment;
  source: "VERCEL_URL" | "MARKETING_CAPTURE_BASE_URL";
  baseUrl: string | null;
  hostMatchesCurrentDeployment: boolean;
};

function normalizeOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function resolveMarketingCaptureBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const preview = env.VERCEL_ENV === "preview";
  if (preview && env.VERCEL_URL?.trim()) return normalizeOrigin(env.VERCEL_URL);
  return normalizeOrigin(env.MARKETING_CAPTURE_BASE_URL);
}

export function describeMarketingCaptureTarget(env: NodeJS.ProcessEnv = process.env): MarketingCaptureTarget {
  const preview = env.VERCEL_ENV === "preview";
  const source = preview && env.VERCEL_URL?.trim() ? "VERCEL_URL" : "MARKETING_CAPTURE_BASE_URL";
  const baseUrl = resolveMarketingCaptureBaseUrl(env);
  const currentDeploymentUrl = normalizeOrigin(env.VERCEL_URL);
  return {
    environment: preview ? "preview" : "production",
    source,
    baseUrl,
    hostMatchesCurrentDeployment: Boolean(baseUrl && currentDeploymentUrl && new URL(baseUrl).host === new URL(currentDeploymentUrl).host),
  };
}
