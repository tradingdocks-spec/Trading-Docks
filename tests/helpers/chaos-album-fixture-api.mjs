// Generated only inside the loopback fixture app. Never imported by production.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export function albumFixture({put,copy,sql,container,database,owner,root}) {
  sql(`update public.user_preferences set active_workspace_id=(select workspace_id from public.workspace_members where user_id='${owner}' limit 1) where user_id='${owner}';`);
  copy('src/app/api/chaos-sort/scans/route.ts');
  copy('src/lib/chaos-sort/capture-permit.ts');
  put('src/lib/chaos-sort/scanner-bridge-access.ts','export async function scannerBridgeOwnerAccess(){return true}');
  put('src/app/page.tsx',`import {ChaosSortWorkspace} from '@/components/dashboard/inventory/ChaosSortWorkspace';export default function Page(){return <ChaosSortWorkspace scannerBridgeEnabled={${process.env.NEXT_PUBLIC_SCANNER_BRIDGE_V1 === "1"}} scanAlbumsEnabled/>}`);
  put('src/lib/platform/server-access.ts',String.raw`
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
const owner='${owner}',container='${container}',baseline='${database}',root=${JSON.stringify(root)};
const quote=(v)=>"'"+String(v).replaceAll("'","''")+"'";
let database=baseline;let chain=Promise.resolve();let child;let sequence=0;
function sql(query){const task=chain.then(()=>new Promise((resolve,reject)=>{
 const pointer=join(root,'..','active-database.txt');const selected=existsSync(pointer)?readFileSync(pointer,'utf8'):baseline;
 if(selected!==database){child?.stdin.end();child=null;database=selected}
 child??=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=0']);
 const marker='DONE_'+(++sequence);let output='',errors='';
 const err=data=>{errors+=data.toString()};
 const done=data=>{output+=data.toString();if(output.includes(marker)){child.stdout.off('data',done);child.stderr.off('data',err);if(errors.includes('ERROR:'))reject(new Error(errors));else resolve(output.split(marker)[0].trim())}};
 child.stderr.on('data',err);child.stdout.on('data',done);
 child.stdin.write("begin;set local request.jwt.claim.sub='"+owner+"';set local role authenticated;"+query+";commit;\n\\echo "+marker+"\n");
 }));chain=task.catch(()=>{});return task}
function table(name){if(!['chaos_scan_albums','chaos_scan_captures','storage.objects'].includes(name))throw Error('Unexpected fixture relation');const filters=[];let columns='*',order='';
 const identifier=value=>{if(!/^[a-z_]+$/.test(value))throw Error('Invalid column');return value};
 async function run(single=false){try{const data=JSON.parse(await sql('select coalesce(json_agg(t),\'[]\'::json) from (select '+columns+' from '+name+(filters.length?' where '+filters.join(' and '):'')+order+') t'));return {data:single?data[0]??null:data,error:null}}catch(error){return {data:null,error:{message:error.message}}}}
 const q={select(value){columns=value==='*'?'*':value.split(',').map(identifier).join(',');return q},eq(key,value){filters.push(identifier(key)+'='+quote(value));return q},order(key){order=' order by '+identifier(key);return q},maybeSingle(){return run(true)},then(resolve,reject){return run().then(resolve,reject)}};return q}
const storage={from(bucket){if(bucket!=='chaos-scans')throw Error('Unexpected bucket');const path=name=>{if(!new RegExp('^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}[.]jpg$').test(name))throw Error('Invalid object path');return join(root,name)};return {
 async upload(name,bytes){try{const file=path(name);await sql('insert into storage.objects(bucket_id,name) values(\'chaos-scans\','+quote(name)+')');await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes,{flag:'wx'});return {error:null}}catch(error){return {error:{message:error.message}}}},
 async download(name){try{const row=await table('storage.objects').select('name').eq('bucket_id',bucket).eq('name',name).maybeSingle();if(!row.data)throw Error('Forbidden');return {data:new Blob([await readFile(path(name))],{type:'image/jpeg'}),error:null}}catch(error){return {data:null,error:{message:error.message}}}}
 }}};
export async function resetFixture(){
 await chain;
 if(child){const previous=child;child=null;previous.stdin.end();await new Promise(resolve=>previous.once('close',resolve))}
 const fresh=baseline+'_t'+Date.now();
 execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','template1','-X','-qAt','-v','ON_ERROR_STOP=1'],{input:'create database '+fresh+' template '+baseline,encoding:'utf8',timeout:60000});
 const pointer=join(root,'..','active-database.txt');writeFileSync(pointer+'.tmp',fresh);renameSync(pointer+'.tmp',pointer);database=fresh;return {ok:true};
}
export async function requireApiCapability(){return {ok:true,user:{id:owner},supabase:{from:table,storage,rpc:async(name,args)=>{try{if(!['chaos_scan_command','commit_chaos_sort_batch','chaos_batch_history'].includes(name))throw Error('Unexpected RPC');const call=name==='chaos_batch_history'?'public.chaos_batch_history('+ (args.p_before?quote(args.p_before)+'::timestamptz':'null')+','+(args.p_id?quote(args.p_id)+'::uuid':'null')+',25)':name==='chaos_scan_command'?'public.chaos_scan_command('+quote(args.action)+','+quote(JSON.stringify(args.payload))+'::jsonb)':'public.commit_chaos_sort_batch('+quote(JSON.stringify(args.payload))+'::jsonb)';return {data:JSON.parse(await sql('select '+call)),error:null}}catch(error){return {data:null,error:{message:error.message}}}}}}}
export async function fixtureEvidence(){return JSON.parse(await sql("reset role;select json_build_object('captures',(select count(*) from public.chaos_scan_captures where user_id='"+owner+"'),'objects',(select count(*) from storage.objects where bucket_id='chaos-scans'),'cards',(select coalesce(sum(quantity),0) from public.inventory_items where user_id='"+owner+"'),'positions',(select count(*) from public.chaos_sort_inventory_positions where user_id='"+owner+"'),'events',(select count(*) from public.inventory_events where user_id='"+owner+"'),'batches',(select count(*) from public.chaos_sort_batches where user_id='"+owner+"'),'enabled',(select count(*) from public.pos_workspace_settings where enabled),'closed',(select count(*) from public.chaos_scan_albums where user_id='"+owner+"' and state='CLOSED'))"))}
`);
  put('src/app/api/reset-fixture/route.ts',`import {resetFixture} from '@/lib/platform/server-access';export async function POST(){return Response.json(await resetFixture())}`);
  put('src/app/api/evidence/route.ts',`import {fixtureEvidence} from '@/lib/platform/server-access';export async function GET(){return Response.json(await fixtureEvidence())}`);
  if(process.env.TD_PHYSICAL_CAPTURE==='1') {
    put('src/app/page.tsx',`import {ChaosSortWorkspace} from '@/components/dashboard/inventory/ChaosSortWorkspace';export default function Page(){return <><aside role="status">LOCAL PHYSICAL CAPTURE CHECKPOINT — disposable fixture workspace. Recognition is disabled; inventory commit is blocked. Capture one card, then pause for owner verification.</aside><ChaosSortWorkspace scannerBridgeEnabled={${process.env.NEXT_PUBLIC_SCANNER_BRIDGE_V1 === "1"}} scanAlbumsEnabled/></>}`);
    put('src/app/api/purchasing/card-photo-scan/route.ts',`export async function POST(){return Response.json({identification:{name:'',setCode:null,collectorNumber:null,confidence:0,notes:['Physical capture checkpoint: inspect source image; recognition intentionally disabled.']},candidates:[],requiresConfirmation:true})}`);
    // Keep the actual scan API intact, but deny commit in the isolated fixture
    // capability adapter. No physical acceptance image can become inventory.
    const adapter='src/lib/platform/server-access.ts';
    copyGuardedAdapter(adapter);
  }
  function copyGuardedAdapter(path) {
    // The generated fixture is local only; its fixed owner has no hosted identity.
    const file=readFileSync(join(root,'..',path),'utf8');
    if (!file.includes("if(!['chaos_scan_command'")) throw Error("Physical fixture commit guard unavailable");
    put(path,file.replace("if(!['chaos_scan_command'", "if(name==='chaos_scan_command'&&args.action==='commit')throw Error('Physical checkpoint: inventory commit disabled');if(!['chaos_scan_command'"));
  }
}
