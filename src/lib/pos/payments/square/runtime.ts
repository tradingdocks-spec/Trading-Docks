export const POS_STAGING_ORIGIN = "https://trading-docks-pos-staging.vercel.app";
export const POS_STAGING_DATABASE = "https://ukrcbmujzdyclrkghbvo.supabase.co";

/** Build mode is not a payment environment. Only this explicitly isolated Preview may opt in. */
export function squareRuntimeAllowed(
  environment: string | undefined = process.env.NODE_ENV,
  env: Record<string, string | undefined> = process.env,
) {
  if (env.VERCEL_ENV === "production") return false;
  if (environment === "development" || environment === "test") return !env.VERCEL;
  return environment === "production" &&
    env.VERCEL === "1" && env.VERCEL_ENV === "preview" &&
    env.VERCEL_PROJECT_ID === "prj_cthg5hX2ehylcwdnPMPw5ASyfRZX" &&
    env.VERCEL_GIT_COMMIT_REF === "codex/pos-foundation" &&
    env.POS_SQUARE_SANDBOX_ENABLED === "true" &&
    env.NEXT_PUBLIC_SUPABASE_URL === POS_STAGING_DATABASE &&
    env.SQUARE_ENVIRONMENT === "SANDBOX" &&
    env.SQUARE_APPLICATION_ID?.startsWith("sandbox-") === true &&
    env.SQUARE_OAUTH_REDIRECT_URL === `${POS_STAGING_ORIGIN}/api/pos/payments/square/callback` &&
    env.SQUARE_WEBHOOK_NOTIFICATION_URL === `${POS_STAGING_ORIGIN}/api/payments/webhooks/square`;
}
