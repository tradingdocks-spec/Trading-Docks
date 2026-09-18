export type EbayEnvironment = "sandbox" | "production";
export type EbayDeploymentEnvironment = "staging" | "production";

type EbayCredentialPayload = { environment?: unknown };

export function resolveEbayEnvironment(
  credentials: EbayCredentialPayload,
  deploymentEnvironment: EbayDeploymentEnvironment,
): EbayEnvironment {
  const configured = typeof credentials.environment === "string"
    ? credentials.environment.trim().toLowerCase()
    : "";

  if (configured !== "sandbox" && configured !== "production") {
    throw new Error("eBay configuration blocked: environment must be explicitly sandbox or production.");
  }
  if (deploymentEnvironment !== "production" && configured !== "sandbox") {
    throw new Error("eBay configuration blocked: staging requires Sandbox credentials.");
  }
  return configured;
}

export function currentEbayDeploymentEnvironment(): EbayDeploymentEnvironment {
  return process.env.VERCEL_ENV === "production" ? "production" : "staging";
}

export function ebayAuthEndpoint(environment: EbayEnvironment) {
  return environment === "sandbox"
    ? "https://auth.sandbox.ebay.com/oauth2/authorize"
    : "https://auth.ebay.com/oauth2/authorize";
}

export function ebayApiBase(environment: EbayEnvironment) {
  return environment === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}
