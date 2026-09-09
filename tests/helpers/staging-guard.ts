import fs from 'node:fs';

// No production override. Populate the ignored manifest only after provider-side
// project/deployment identity verification. A preview URL alone is not proof.
export const stagingManifestPath = '.local-fixtures/staging-target.json';
const productionRef = 'bohddnajlnmknngzjsjk';

type StagingTarget = { projectRef: string; previewOrigin: string };

function refuse(): never {
  // Never echo supplied URLs: database URLs may contain passwords.
  throw new Error('Launch verification refused: a verified, isolated staging target and matching staging configuration are required. No production override is supported.');
}

function parseURL(value: string | undefined): URL {
  try { return new URL(value ?? ''); } catch { return refuse(); }
}

export function readStagingTarget(): StagingTarget {
  try { return JSON.parse(fs.readFileSync(stagingManifestPath, 'utf8')); }
  catch { return refuse(); }
}

export function assertStagingTarget(
  target: StagingTarget,
  env: NodeJS.ProcessEnv,
  appURL?: string,
) {
  if (!target || !/^[a-z]{20}$/.test(target.projectRef) || target.projectRef === productionRef) refuse();
  if (env.APP_ENV !== 'staging' || env.VERCEL_ENV === 'production' || env.VERCEL_TARGET_ENV === 'production') refuse();
  const supabase = parseURL(env.NEXT_PUBLIC_SUPABASE_URL);
  if (supabase.origin !== `https://${target.projectRef}.supabase.co` || supabase.username || supabase.password || supabase.search || supabase.hash || supabase.pathname !== '/') refuse();
  const preview = parseURL(target.previewOrigin);
  if (preview.protocol !== 'https:' || !preview.hostname.endsWith('.vercel.app') || preview.username || preview.password || preview.port || preview.pathname !== '/' || preview.search || preview.hash) refuse();
  if (appURL !== undefined) {
    const app = parseURL(appURL);
    if (app.origin !== preview.origin || app.username || app.password || app.pathname !== '/' || app.search || app.hash) refuse();
  }
  return target;
}

// Call before constructing a database client. Pooler identities include the
// project reference in the user; direct hosts include it in the hostname.
export function assertStagingDatabase(target: StagingTarget, env: NodeJS.ProcessEnv) {
  assertStagingTarget(target, env);
  const db = parseURL(env.DATABASE_URL);
  const direct = db.hostname === `db.${target.projectRef}.supabase.co` && db.username === 'postgres';
  const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(db.hostname)
    && db.username === `postgres.${target.projectRef}`;
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || (!direct && !pooler) || db.pathname !== '/postgres' || db.search || db.hash) refuse();
}

export function guardPlaywrightTarget(env: NodeJS.ProcessEnv) {
  const hasQaCredentials = Object.entries(env).some(([name, value]) => /^PLAYWRIGHT_.+_(EMAIL|PASSWORD)$/.test(name) && !!value);
  // Default public smoke tests use synthetic Supabase configuration. Any custom
  // target or supplied QA credentials requires verified staging before launch.
  if (env.PLAYWRIGHT_BASE_URL || hasQaCredentials) {
    assertStagingTarget(readStagingTarget(), env, env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173');
  }
}
