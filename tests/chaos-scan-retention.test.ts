import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error JavaScript operational helper intentionally has no declaration file.
import { expireScanAlbums } from '../scripts/chaos-scan-retention.mjs';

test('scan retention selects only expired closed albums and removes exact objects before marking metadata', async () => {
  const id = '11111111-1111-4111-8111-111111111111', events: string[] = [];
  const path = `${id}/${id}/${id}.jpg`;
  const client = { from(table: string) {
    const query = { select() { return query; }, is() { return query; }, eq(key: string, value: string) { events.push(`${key}=${value}`); return query; }, lte(key: string) { events.push(key); return query; }, neq() { return query; }, limit() { return query; }, update() { events.push('mark'); return query; }, then(resolve: (value: unknown) => void) { resolve({ data: table === 'chaos_scan_albums' ? [{ id }] : [{ capture_id: id, object_path: path }] }); } }; return query;
  }, storage: { from(bucket: string) { assert.equal(bucket, 'chaos-scans'); return { async remove(paths: string[]) { assert.deepEqual(paths, [path]); events.push('delete'); return {}; } }; } } };
  assert.equal((await expireScanAlbums(client)).objects, 1);
  assert.ok(!events.includes('delete')); events.length = 0;
  assert.equal((await expireScanAlbums(client, { execute: true })).objects, 1);
  assert.ok(events.includes('state=CLOSED')); assert.ok(events.includes('expires_at'));
  assert.ok(events.indexOf('delete') < events.indexOf('mark'));
});
