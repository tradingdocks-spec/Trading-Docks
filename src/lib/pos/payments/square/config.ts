export const SQUARE_API_VERSION = "2026-09-16";
export const SQUARE_BASE_URL = "https://connect.squareupsandbox.com";
export const SQUARE_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "PAYMENTS_READ",
  "PAYMENTS_WRITE",
] as const;
export const SQUARE_RETURN_PATH = "/dashboard/pos/payments";
export type SquareConfig = {
  applicationId: string;
  applicationSecret: string;
  redirectUrl: string;
  webhookKey: string;
  notificationUrl: string;
  environment: "SANDBOX";
};
export function squareConfig(
  env: Record<string, string | undefined> = process.env,
): SquareConfig {
  if (
    env.SQUARE_ENVIRONMENT !== "SANDBOX" ||
    !env.SQUARE_APPLICATION_ID?.startsWith("sandbox-")
  )
    throw Error("CONFIGURATION_ERROR");
  const required = [
    "SQUARE_APPLICATION_SECRET",
    "SQUARE_OAUTH_REDIRECT_URL",
    "SQUARE_WEBHOOK_SIGNATURE_KEY",
    "SQUARE_WEBHOOK_NOTIFICATION_URL",
    "MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY",
  ];
  if (
    required.some((k) => !env[k]) ||
    env.MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY!.length < 32
  )
    throw Error("CONFIGURATION_ERROR");
  for (const k of [
    "SQUARE_OAUTH_REDIRECT_URL",
    "SQUARE_WEBHOOK_NOTIFICATION_URL",
  ]) {
    const u = new URL(env[k]!);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.hash ||
      u.search
    )
      throw Error("CONFIGURATION_ERROR");
  }
  return {
    environment: "SANDBOX",
    applicationId: env.SQUARE_APPLICATION_ID,
    applicationSecret: env.SQUARE_APPLICATION_SECRET!,
    redirectUrl: env.SQUARE_OAUTH_REDIRECT_URL!,
    webhookKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY!,
    notificationUrl: env.SQUARE_WEBHOOK_NOTIFICATION_URL!,
  };
}
