// Server-only private acceptance guard. Unset in normal deployments.
export function privateScannerAcceptance() {
  return process.env.SCANNER_PRIVATE_ACCEPTANCE === "1";
}

export function privateAcceptanceRequestAllowed(path: string, method: string) {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  // The existing sign-in page submits a Next.js Server Action, not a client
  // Supabase request. Permit login without opening other page mutations.
  return method === "POST" && ["/sign-in", "/api/chaos-sort/scans", "/api/purchasing/card-photo-scan"].includes(path);
}

export function privateAcceptanceScanAllowed(action: string, batchId: unknown) {
  const expected = process.env.SCANNER_PRIVATE_ACCEPTANCE_BATCH_ID;
  return Boolean(expected && batchId === expected && ["authorize-capture", "start", "review", "upload"].includes(action));
}
