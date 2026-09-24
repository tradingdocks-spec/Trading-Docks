// Real Supabase-compatible RPC checks. Disconnected disposable clone only.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const container = 'supabase_db_trading-docks-recovery-test';
const state = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0];
assert.deepEqual(state.NetworkSettings.Networks, {});
assert.match(state.Config.Image, /supabase\/postgres:17\./);
const database = 'chaos_mode_' + Date.now();
const sql = (input, db = database) => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
sql(`create database ${database} template tenant_execution_rehearsal_20260924`, 'template1');
sql('begin;' + readFileSync('supabase/migrations/20260924043103_chaos_intake_mode_switch.sql', 'utf8') + 'commit;');
const owner = crypto.randomUUID(), other = crypto.randomUUID();
sql(`insert into auth.users(id,email) values('${owner}','mode-owner@example.invalid'),('${other}','mode-other@example.invalid');
update user_preferences set active_workspace_id=(select id from workspaces where owner_id=user_preferences.user_id limit 1) where user_id in ('${owner}','${other}');`);
const as = (q, who = owner) => `begin;set local request.jwt.claim.sub='${who}';set local role authenticated;${q};commit;`;
sql(as(`insert into inventory_locations(id,user_id,name) values('mode-box','${owner}','Mode test')`));
const call = (action, payload = {}, who = owner) => JSON.parse(sql(as(`select chaos_scan_command('${action}','${JSON.stringify(payload).replaceAll("'", "''")}'::jsonb)`, who)));
let checks = 0;
const equal = (a,b) => { assert.deepEqual(a,b); checks++; };
const deny = (f, pattern) => { assert.throws(f, e => pattern.test(String(e.stderr || e))); checks++; };
const album = call('create', { requestId: crypto.randomUUID(), destinationId: 'mode-box', intakeMode: 'upload' });
const mode = (intakeMode, expectedMode, who = owner) => call('mode', { batchId: album.id, intakeMode, expectedMode }, who);
const invariant = () => sql(`select json_build_object('albums',(select count(*) from chaos_scan_albums),'batches',(select count(*) from chaos_sort_batches),'inventory',(select md5(string_agg(to_jsonb(i)::text,',' order by user_id,id)) from inventory_items i),'events',(select count(*) from inventory_events),'album',(select to_jsonb(a)-'intake_mode'-'updated_at' from chaos_scan_albums a where id='${album.id}'))`);
const baseline = invariant();
equal(mode('live','upload'), { intake_mode:'live' });
equal(call('current').album.intake_mode, 'live'); // independent DB connection, like refresh/second browser
equal(mode('live','upload'), { intake_mode:'live' }); // response-loss retry
equal(mode('upload','live'), { intake_mode:'upload' });
equal(mode('csv','upload'), { intake_mode:'csv' });
deny(() => mode('live','upload'), /SCAN_MODE_CONFLICT/);
deny(() => mode('bogus','csv'), /SCAN_INTAKE_MODE_INVALID/);
deny(() => mode('live','csv',other), /SCAN_UNAUTHORIZED/);
deny(() => sql(`begin;set local role anon;select chaos_scan_command('mode','{}');rollback;`), /permission denied|SCAN_UNAUTHORIZED/);
equal(invariant(), baseline); // same batch/destination/settings/device, no inventory/event mutation
const foreignWorkspace = crypto.randomUUID();
sql(`insert into workspaces(id,name,owner_id) values('${foreignWorkspace}','Second mode workspace','${owner}');insert into workspace_members(workspace_id,user_id,role) values('${foreignWorkspace}','${owner}','owner');update user_preferences set active_workspace_id='${foreignWorkspace}' where user_id='${owner}';`);
deny(() => mode('live','csv'), /SCAN_UNAUTHORIZED/);
sql(`update user_preferences set active_workspace_id='${album.workspace_id}' where user_id='${owner}'`);
mode('live','csv');
const captureId = crypto.randomUUID();
call('reserve',{batchId:album.id,captureId,sha256:'a'.repeat(64)});
deny(() => mode('upload','live'), /SCAN_INTAKE_BUSY/);
// Fixture-only states represent staging then recognition on an accepted image.
sql(`begin;set local request.jwt.claim.sub='${owner}';update chaos_scan_captures set status='RECEIVED' where capture_id='${captureId}';commit;`);
deny(() => mode('upload','live'), /SCAN_INTAKE_BUSY/);
const item = {id:captureId,captureId,batchId:album.id,quantity:1,cardName:'Fixture card',setCode:'KTK',collectorNumber:'204',condition:'NM',finish:'nonfoil',humanState:'confirmed',recognitionState:'high_confidence',processingState:'processing'};
call('review',{batchId:album.id,captureId,item,revision:0});
deny(() => mode('upload','live'), /SCAN_INTAKE_BUSY/);
call('review',{batchId:album.id,captureId,item:{...item,processingState:'ready'},revision:1});
equal(mode('upload','live'), {intake_mode:'upload'});
deny(() => call('start',{batchId:album.id,deviceId:'fixture',workstationId:'fixture',backend:'fixture'}), /SCAN_MODE_CONFLICT/);
call('commit',{batchId:album.id});
deny(() => mode('live','upload'), /SCAN_BATCH_CLOSED/);
equal(call('snapshot',{batchId:album.id}).album.state,'CLOSED');
equal(sql('select count(*) from pos_workspace_settings where enabled'),'0');
console.log(JSON.stringify({database,checks,passed:true,productionTouched:false}));
