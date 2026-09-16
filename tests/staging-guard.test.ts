import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertStagingTarget, assertStagingDatabase, guardPlaywrightTarget } from './helpers/staging-guard.ts';

const ref = 'abcdefghijklmnopqrst';
const target = { projectRef: ref, previewOrigin: 'https://verified-staging-example.vercel.app' };
const env = { APP_ENV: 'staging', NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co` };

test('staging guard allows matching explicitly verified configuration', () => {
  assert.doesNotThrow(() => assertStagingTarget(target, env, target.previewOrigin));
  assert.doesNotThrow(() => assertStagingDatabase(target, { ...env, DATABASE_URL: `postgresql://postgres:secret@db.${ref}.supabase.co:5432/postgres` }));
  assert.doesNotThrow(() => assertStagingDatabase(target, { ...env, DATABASE_URL: `postgresql://postgres.${ref}:secret@aws-0-us-west-1.pooler.supabase.com:5432/postgres` }));
});

test('staging guard rejects production markers, missing configuration, and shared project', () => {
  for (const changed of [{}, { ...env, APP_ENV: 'production' }, { ...env, VERCEL_ENV: 'production' }, { ...env, VERCEL_TARGET_ENV: 'production' }, { ...env, NEXT_PUBLIC_SUPABASE_URL: 'https://bohddnajlnmknngzjsjk.supabase.co' }]) {
    assert.throws(() => assertStagingTarget(target, changed));
  }
  assert.throws(() => assertStagingTarget({ ...target, projectRef: 'bohddnajlnmknngzjsjk' }, env));
});

test('staging guard rejects mismatched origins and deceptive URLs', () => {
  for (const url of ['https://tradingdocks.com', 'https://other.vercel.app', `${target.previewOrigin}.evil.test`, `${target.previewOrigin}/dashboard`, 'http://127.0.0.1:4173']) {
    assert.throws(() => assertStagingTarget(target, env, url));
  }
  assert.throws(() => assertStagingTarget(target, { ...env, NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co.evil.test` }));
});

test('database guard rejects foreign projects and does not expose credentials in errors', () => {
  for (const url of ['invalid-secret', 'postgresql://postgres:private-password@db.bohddnajlnmknngzjsjk.supabase.co/postgres', `postgresql://postgres.wrong:private-password@aws-0-us-west-1.pooler.supabase.com/postgres`, `postgresql://postgres:private-password@db.${ref}.supabase.co/postgres?host=evil.test`]) {
    assert.throws(() => assertStagingDatabase(target, { ...env, DATABASE_URL: url }), error => error instanceof Error && !error.message.includes('private-password') && !error.message.includes(url));
  }
});

test('default synthetic public Playwright smoke remains available', () => {
  assert.doesNotThrow(() => guardPlaywrightTarget({}));
});
