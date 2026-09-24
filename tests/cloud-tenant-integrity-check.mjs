// Fails on structural tenancy drift. Runs only against the disconnected rehearsal.
// The SQL itself is read-only and can also be reviewed for production preflight.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const container='supabase_db_trading-docks-recovery-test';
const state=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.deepEqual(state.NetworkSettings.Networks,{});
const database=JSON.parse(readFileSync('.local-fixtures/cloud-tenant-repair-test-results.json','utf8')).database;
assert.match(database,/^tenant_audit_\d+$/);
const query=readFileSync('tests/cloud-tenant-integrity.sql','utf8').trim().replace(/;$/,'');
const output=execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1'],{
 input:`begin read only;select jsonb_agg(to_jsonb(q)) from (${query}) q;rollback;`,encoding:'utf8',timeout:60000});
const rows=JSON.parse(output.trim());
const findings=rows.filter(r=>!['inventory_rows','inventory_quantity'].includes(r.check_name)&&Number(r.actual)!==0);
assert.deepEqual(findings,[],'TENANT_INTEGRITY_DRIFT');
console.log(`PASS ${rows.length-2} structural integrity checks; totals are informational, not fixed business limits`);
