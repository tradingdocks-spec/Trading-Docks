// Loopback-only scanner rehearsal. Real UI/API/commit RPC; synthetic recognition.
// No .env files, hosted clients or production mutations. Disposable DB ONLY.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
import {albumFixture} from './helpers/chaos-album-fixture-api.mjs';
const container='supabase_db_trading-docks-recovery-test';
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
const state=JSON.parse(docker('inspect',container))[0];
assert.equal(state.State.Running,true); assert.match(state.Config.Image,/supabase\/postgres:17\./); assert.deepEqual(state.NetworkSettings.Networks,{});
const database='chaos_live_'+Date.now();
const sql=(query,db=database)=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',timeout:120000});
sql(`create database ${database} template collector_removal_rehearsal;`,'template1');
const owner='11111111-1111-4111-8111-111111111199';
sql(`begin;
insert into auth.users(id,email) values('${owner}','scanner-fixture@example.invalid');
do $$ begin if (select count(*) from public.workspace_members where user_id='${owner}')<>1 then raise exception 'FIXTURE_REQUIRES_ONE_AUTO_PROVISIONED_WORKSPACE'; end if; end $$;
set local request.jwt.claim.sub='${owner}'; set local role authenticated;
insert into public.inventory_locations(id,user_id,name) values('scanner-fixture-location','${owner}','Fixture Box');
commit;`);
const root=process.cwd(),dir=mkdtempSync(join(tmpdir(),'td-chaos-live-'));
for(const name of ['20260923204804_chaos_scan_albums_v2.sql','20260924000100_chaos_cloud_authority.sql']) sql(readFileSync('supabase/migrations/'+name,'utf8'));
for(const name of ['20260924005111_chaos_legacy_workspace_normalization.sql','20260924013600_cloud_active_workspace_authority.sql','20260924043103_chaos_intake_mode_switch.sql']) sql(readFileSync('supabase/migrations/'+name,'utf8'));
sql(readFileSync('supabase/migrations/20260924220000_chaos_active_capture_capacity.sql','utf8'));
const put=(path,content)=>{mkdirSync(dirname(join(dir,path)),{recursive:true});writeFileSync(join(dir,path),content);};
const copy=path=>put(path,readFileSync(path,'utf8'));
symlinkSync(join(root,'node_modules'),join(dir,'node_modules'),'junction');
put('package.json',JSON.stringify({private:true,dependencies:{next:'16.3.4',react:'19.2.4','react-dom':'19.2.4'}}));
put('tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022',jsx:'react-jsx',moduleResolution:'bundler',module:'esnext',allowImportingTsExtensions:true,paths:{'@/*':['./src/*']}}}));
put('next.config.mjs',`export default {devIndicators:false};`); copy('postcss.config.mjs');
for(const path of ['src/components/dashboard/inventory/ChaosSortWorkspace.tsx','src/components/dashboard/inventory/LiveScanStation.tsx','src/components/dashboard/common/PageHeader.tsx','src/components/dashboard/common/WorkspaceFrame.tsx','src/components/dashboard/styles.module.css','src/components/design-system/td-primitives.tsx','src/lib/utils.ts','src/lib/csv-simple.ts','src/lib/chaos-sort/domain.ts','src/lib/chaos-sort/batch-queue.ts','src/lib/chaos-sort/live-intake.ts','src/lib/chaos-sort/scan-album-client.ts','src/lib/chaos-sort/scanner-provider.ts','src/lib/chaos-sort/local-scanner-provider.ts','src/components/dashboard/inventory/ScannerBridgeControls.tsx','src/app/api/chaos-sort/route.ts','src/app/globals.css','src/app/theme.css']) copy(path);
put('src/app/layout.tsx',`import './globals.css'; export default function Layout({children}) {return <html data-theme="dark"><body>{children}</body></html>}`);
put('src/app/page.tsx',`import {ChaosSortWorkspace} from '@/components/dashboard/inventory/ChaosSortWorkspace';export default function Page(){return <ChaosSortWorkspace/>}`);
put('src/lib/supabase/client.ts',`export function createClient(){ return {auth:{getUser:async()=>({data:{user:{id:'${owner}'}}})},from(name){const q={select(){return q},order(){return q},limit:async()=>({data:name==='inventory_locations'?[{id:'scanner-fixture-location',name:'Fixture Box',location_type:'box'}]:name==='chaos_sort_batches'?[{id:'historical-fixture',batch_code:'CS-HISTORY',status:'committed',status_v2:'CLOSED',current_quantity:10,initial_quantity:10,destination_label:'Fixture Box',created_at:'2026-09-01T00:00:00Z'}]:[]})};return q}}}`);
put('src/lib/platform/server-access.ts',`import {execFileSync} from 'node:child_process';
function sql(query){return execFileSync('docker',['exec','-i','${container}','psql','-U','postgres','-d','${database}','-X','-qAt','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',timeout:120000}).trim();}
export async function requireApiCapability(capability){if(capability!=='collection.write')throw Error('Unexpected capability');return {ok:true,user:{id:'${owner}'},supabase:{rpc:async(name,args)=>{if(name!=='commit_chaos_sort_batch')throw Error('Unexpected RPC');try{const payload=JSON.stringify(args.payload).replaceAll("'","''");const result=sql("begin;set local request.jwt.claim.sub='${owner}';set local role authenticated; select public.commit_chaos_sort_batch('"+payload+"'::jsonb);commit;");return {data:JSON.parse(result)};}catch(error){return {data:null,error:{message:'Disposable RPC rejected: '+String(error.stderr||error.message)}}}}}}}
export function fixtureEvidence(){return JSON.parse(sql("select json_build_object('cards',coalesce((select sum(quantity) from public.inventory_items where user_id='${owner}'),0),'positions',(select count(*) from public.chaos_sort_inventory_positions where user_id='${owner}'),'events',(select count(*) from public.inventory_events where user_id='${owner}'),'batches',(select count(*) from public.chaos_sort_batches where user_id='${owner}'),'enabled',(select count(*) from public.pos_workspace_settings where enabled))"));}`);
put('src/app/api/evidence/route.ts',`import {fixtureEvidence} from '@/lib/platform/server-access';export async function GET(){return Response.json(fixtureEvidence())}`);
put('src/app/evidence/page.tsx',`import {fixtureEvidence} from '@/lib/platform/server-access';export const dynamic='force-dynamic';export default function Page(){return <pre>{JSON.stringify(fixtureEvidence(),null,2)}</pre>}`);
put('src/app/api/purchasing/card-photo-scan/route.ts',`let calls=0;export async function POST(request){const form=await request.formData();const file=form.get('image');calls++;await new Promise(resolve=>setTimeout(resolve,60));const review=file.name.includes('review');const unknown=file.name.includes('unknown');const failed=file.name.includes('failed');if(failed)return Response.json({failureReason:'provider'},{status:502});return Response.json({identification:{name:unknown?'':'Fixture Sol Ring',setCode:unknown?null:'CMM',collectorNumber:unknown?null:'396',confidence:review?0.6:0.99,language:'en',finish:'nonfoil',notes:['Synthetic fixture']},candidates:unknown?[]:[{id:'33333333-3333-4333-8333-333333333399',name:'Fixture Sol Ring',setCode:'CMM',collectorNumber:'396',language:'en',prices:[]}],requiresConfirmation:review});}`);
put('src/app/api/card-intelligence/search/route.ts',`export async function GET(){return Response.json({candidates:[{id:'33333333-3333-4333-8333-333333333399',name:'Fixture Sol Ring',setCode:'CMM',collectorNumber:'396',language:'en'}]})}`);
albumFixture({put,copy,sql,container,database,owner,root:join(dir,'private-fixture-objects')});
const port=process.env.TD_CHAOS_TEST_PORT || '4320';
console.log('Local scanner rehearsal http://127.0.0.1:'+port+' — database '+database);
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',port],{cwd:dir,stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
let cleaned=false;
function cleanup(){if(cleaned)return;cleaned=true;child.kill(); /* Keep disposable DB for evidence; never overwrite a prior rehearsal. */ console.log('Retained isolated fixture DB: '+database);}
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,cleanup);
child.on('exit',code=>{cleanup();process.exit(code??0)});
