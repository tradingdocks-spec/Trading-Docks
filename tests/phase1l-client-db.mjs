// Real authoritative RPC acceptance. The private candidate is a frozen source
// package of these exact modules, not the old installed private binary.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

export async function runClientRecoveryFixtures({ admin, client, owner, workspace }) {
  const candidate = mkdtempSync(join(tmpdir(), 'td-phase1l-private-candidate-'));
  const files = ['scanner-foundation.ts', 'scanner-replay.ts', 'inventory-command.ts', 'collector-workspace.ts', 'inventory-valuation.ts', 'membership-catalog.ts', 'storage/offline-core.ts'];
  const manifest = {};
  for (const file of files) {
    const bytes = readFileSync(join('mobile/services', file)), target = join(candidate, file);
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes);
    manifest[file] = createHash('sha256').update(bytes).digest('hex');
  }
  writeFileSync(join(candidate, 'manifest.json'), JSON.stringify({ kind: 'PRIVATE_SOURCE_ACCEPTANCE_CANDIDATE_NOT_INSTALLED_BINARY', files: manifest }, null, 2));
  const paths = [resolve('mobile/services'), candidate];
  const matrix = [];
  const fixtures = ['online', 'timeout_before_response', 'response_lost', 'offline_restart', 'duplicate', 'changed_payload', 'legacy_review', 'invalid_mutation', 'location_retry', 'partial_batch', 'crash_before_ack', 'reconnect_resume'];
  for (const fixture of fixtures) {
    const results = [];
    for (const directory of paths) {
      const { createOfflineQueue, createQueueLock } = await import(pathToFileURL(join(directory, 'storage/offline-core.ts')));
      const { deliverInventoryCommand, classifyInventoryCommandError } = await import(pathToFileURL(join(directory, 'inventory-command.ts')));
      const { buildScannerInventoryCommand, normalizeScannerCandidate } = await import(pathToFileURL(join(directory, 'scanner-foundation.ts')));
      const { replayQueuedScannerAddsWithDependencies } = await import(pathToFileURL(join(directory, 'scanner-replay.ts')));
      const id = randomUUID(), kind = 'collector_scanner_collection_add';
      const confirmation = { userId: owner, candidate: normalizeScannerCandidate({ id: 'fixture-printing', name: 'Synthetic parity card', gameId: 'magic', setCode: 'tst', collectorNumber: '1', finishes: ['normal'], identityAuthority: 'provider_confirmed', providerSource: 'scryfall', providerIds: { scryfall: 'fixture-printing' }, confidence: 1 }), quantity: 1, condition: 'near_mint', finish: 'normal', language: 'en', storageLocationId: null, tradeStatus: 'not_for_trade', addToWishlist: false };
      const cmd = buildScannerInventoryCommand(confirmation, id, workspace, '2026-09-24T00:00:00.000Z');
      if (fixture === 'invalid_mutation') cmd.args.p_inventory.location_id = randomUUID();
      let raw = '[]', calls = 0, lost = ['response_lost', 'timeout_before_response'].includes(fixture), failAck = fixture === 'crash_before_ack';
      const lock = createQueueLock();
      const storage = { getItem: async () => raw, setItem: async (_key, value) => { if (failAck && JSON.parse(value).some(r => r.status === 'committed')) throw Error('Simulated force-close before acknowledgement'); raw = value; } };
      const fresh = () => createOfflineQueue({ storage, lock, runtimeId: randomUUID(), newId: randomUUID });
      let queue = fresh(); const requests = [];
      const deliver = op => deliverInventoryCommand(op, {
        context: async () => ({ userId: owner, workspaceId: workspace }),
        async rpc(endpoint, args) {
          calls++; requests.push(JSON.parse(JSON.stringify(args)));
          assert.equal(JSON.parse(raw).find(r => r.id === op.id).status, 'processing');
          if (fixture === 'timeout_before_response' && lost) { lost = false; throw Error('transport unavailable before send'); }
          let data;
          try {
            if (endpoint === 'create_inventory_item_with_event') data = (await client.query('select to_jsonb(create_inventory_item_with_event($1,$2,$3,$4,$5)) r', [args.p_inventory, args.p_source, args.p_idempotency_key, args.p_related_entity_type, args.p_related_entity_id])).rows[0].r;
            else data = (await client.query('select to_jsonb(apply_collector_inventory_mutation($1,$2,$3,$4,$5,$6,$7,$8)) r', [args.p_inventory_item_id,args.p_mutation_type,args.p_quantity,args.p_condition,args.p_finish,args.p_location_id,args.p_idempotency_key,args.p_source])).rows[0].r;
          } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
          if (lost) { lost = false; throw Error('response lost after committed SQL transaction'); }
          return { data, error: null };
        },
      });
      const enqueue = c => queue.prepare(kind, owner, c.operationId, async () => ({ payload: { command: c, confirmation, inventoryItemId: c.inventoryItemId, idempotencyKey: c.operationId } }));
      const process = key => queue.process(key, owner, kind, async op => { await deliver(op); }, { retrySafe: true, classify: classifyInventoryCommandError });
      await enqueue(cmd);
      if (fixture === 'legacy_review') {
        const rows = JSON.parse(raw); delete rows[0].payload.command; raw = JSON.stringify(rows);
      }
      if (fixture === 'offline_restart') queue = fresh();
      if (fixture === 'reconnect_resume') {
        const deps = () => ({ getQueue: queue.list, processOperation: queue.process, getAuthenticatedUserId: async () => owner, deliverCommand: deliver });
        await Promise.all(['network_reconnect', 'app_resume'].map(trigger => replayQueuedScannerAddsWithDependencies({ userId: owner, membershipTier: 'collector', trigger }, deps())));
      } else if (fixture === 'crash_before_ack') {
        await assert.rejects(process(id), /force-close/); failAck = false; queue = fresh(); await process(id);
      } else await process(id);
      if (['response_lost', 'timeout_before_response', 'duplicate'].includes(fixture)) { queue = fresh(); await process(id); }
      if (fixture === 'changed_payload') {
        // Simulate a malformed older client using the same key: server rejects
        // it; the current queue must never auto-rekey the conflict.
        const rows = JSON.parse(raw); rows[0].status = 'pending'; rows[0].payload.command.args.p_inventory.quantity = 4; raw = JSON.stringify(rows);
        await process(id); queue = fresh(); await process(id);
      }
      if (fixture === 'location_retry') {
        const locations = [randomUUID(), randomUUID()];
        for (const l of locations) await admin.query('insert into inventory_locations(id,user_id,name) values($1,$2,$3)', [l,owner,'Parity box']);
        const move = (key, l) => ({ ...cmd, operationId: key, endpoint: 'apply_collector_inventory_mutation', args: { p_inventory_item_id: id, p_mutation_type: 'storage', p_quantity: null, p_condition: null, p_finish: null, p_location_id: l, p_idempotency_key: key, p_source: 'mobile' } });
        const a = move(randomUUID(), locations[0]), b = move(randomUUID(), locations[1]);
        await enqueue(a); await process(a.operationId); await enqueue(b); await process(b.operationId);
        const rows = JSON.parse(raw); rows.find(r => r.id === a.operationId).status = 'processing'; raw = JSON.stringify(rows); queue = fresh(); await process(a.operationId);
        assert.equal((await admin.query('select location_id from inventory_items where id=$1',[id])).rows[0].location_id, locations[1]);
      }
      if (fixture === 'partial_batch') {
        const b = buildScannerInventoryCommand(confirmation, randomUUID(), workspace, cmd.createdAt), c = buildScannerInventoryCommand(confirmation, randomUUID(), workspace, cmd.createdAt);
        await enqueue(b); await enqueue(c);
        await queue.process(b.operationId,owner,kind,async()=>{throw Error('offline');},{retrySafe:true,classify:classifyInventoryCommandError});
        await process(c.operationId); queue=fresh(); for(const key of [id,b.operationId,c.operationId]) await process(key);
        assert.equal((await admin.query('select count(*)::int n from inventory_items where id=any($1)',[[id,b.operationId,c.operationId]])).rows[0].n,3);
      }
      const final = JSON.parse(raw).find(r => r.id === id);
      const facts = (await admin.query('select (select count(*)::int from inventory_items where id=$1) items,(select coalesce(sum(quantity),0)::int from inventory_items where id=$1) units,(select count(*)::int from inventory_events where user_id=$2 and idempotency_key=$1) events',[id,owner])).rows[0];
      assert.deepEqual(facts, ['legacy_review','invalid_mutation'].includes(fixture) ? {items:0,units:0,events:0} : {items:1,units:1,events:1});
      if (['response_lost','timeout_before_response','crash_before_ack'].includes(fixture)) assert.deepEqual(requests[0],requests[1]);
      assert.equal(final.status, ['legacy_review','invalid_mutation','changed_payload'].includes(fixture) ? 'review_required':'committed');
      results.push({ ...facts, status: final.status, code: final.errorCode ?? null, calls, endpoint: cmd.endpoint, keyPreserved: final.id === id });
    }
    assert.deepEqual(results[0],results[1],`Private candidate parity: ${fixture}`);
    matrix.push({ fixture, production: results[0], privateCandidate: results[1], equivalent: true });
  }
  console.log(JSON.stringify({ verdict: 'PHASE_1L_SOURCE_CANDIDATE_RPC_PARITY_PASS', privateSourceCandidate: candidate, manifest, matrix, limitation: 'Not an installed private binary or physical device certification. Retained 3269e252 is not upgraded by this test.' },null,2));
}
