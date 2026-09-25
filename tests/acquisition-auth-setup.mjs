// Private local acceptance setup: schema-only recovery copy, real Supabase Auth.
// Never copies production rows, credentials or sessions. No remote URL accepted.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const target='supabase_db_td-phase1g-auth-20260924';
const source='supabase_db_trading-docks-recovery-test';
const database='acquisition_rehearsal_1790295038844';
const run=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024,stdio:['pipe','pipe','pipe']});
const state=JSON.parse(run(['inspect',source]))[0];assert.deepEqual(state.NetworkSettings.Networks,{});
assert.equal(JSON.parse(run(['inspect',target]))[0].Name,'/'+target);
const sql=q=>run(['exec','-i',target,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],q).trim();
const schemas=run(['exec',source,'psql','-U','postgres','-d',database,'-X','-At','-c',"select nspname from pg_namespace where nspname='public' or nspname like '%_private' order by nspname"]).trim().split(/\r?\n/);
const dump=run(['exec',source,'pg_dump','-U','postgres','-d',database,'--schema-only','--no-owner',...schemas.flatMap(name=>['--schema',name])]).replace(/ALTER DEFAULT PRIVILEGES[\s\S]*?;/g,'');
// This target is dedicated/empty; refusing an accidental rerun over test data.
assert.equal(sql('select count(*) from auth.users'),'0');
if(sql("select to_regclass('public.inventory_items') is not null")==='t') assert.equal(sql('select count(*) from public.inventory_items'),'0');
for(const schema of schemas) sql(`drop schema if exists ${schema} cascade;`);
try {sql(dump);} catch(error) {writeFileSync(join(tmpdir(),'td-phase1g-schema-error.log'),String(error.stderr));throw Error('Schema restore failed; private error log recorded.');}
// Restore custom public-function Auth hooks omitted by schema selection.
const hooks=run(['exec',source,'psql','-U','postgres','-d',database,'-X','-At','-c',"select pg_get_triggerdef(t.oid)||';' from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace where t.tgrelid='auth.users'::regclass and not t.tgisinternal and n.nspname='public'"]);
sql(hooks);
const keys=JSON.parse(readFileSync(join(tmpdir(),'td-phase1g-auth-20260924/start.log'),'utf8').split(/\r?\n/).find(line=>line.startsWith('{"DB_URL"')));
assert.equal(keys.API_URL,'http://127.0.0.1:55321');
// Only the private local keys go to the private runtime config, never Git/logs.
writeFileSync(join(tmpdir(),'td-phase1g-local-runtime.json'),JSON.stringify({url:keys.API_URL,anon:keys.PUBLISHABLE_KEY,service:keys.SECRET_KEY,target}));
console.log('PASS schema-only recovery copy and auth hooks installed into dedicated local Supabase; no production data copied.');
