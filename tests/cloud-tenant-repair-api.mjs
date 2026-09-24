// Real PostgREST boundary probes, confined to the disconnected rehearsal network.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHmac,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const container='supabase_db_trading-docks-recovery-test';
assert.deepEqual(JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0].NetworkSettings.Networks,{});
const {database}=JSON.parse(readFileSync('.local-fixtures/cloud-tenant-repair-test-results.json','utf8'));
assert.match(database,/^tenant_audit_\d+$/);
const sql=q=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8'}).trim();
const owner='11111111-1111-4111-8111-111111111171';
const old=sql(`select active_workspace_id from user_preferences where user_id='${owner}'`);
const ids=JSON.parse(sql("select jsonb_object_agg(id,workspace_id) from inventory_items where id in ('tenant-a-item','tenant-a2-item')"));
const before=sql("select md5(string_agg(to_jsonb(i)::text,',' order by user_id,id)) from inventory_items i");
const secret=randomBytes(32).toString('hex');
const b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const head=b64({alg:'HS256',typ:'JWT'})+'.'+b64({role:'authenticated',sub:owner,exp:Math.floor(Date.now()/1000)+1800});
const jwt=head+'.'+createHmac('sha256',secret).update(head).digest('base64url');
const name='tenant-api-'+Date.now();
let checks=0;
function request(path,{method='GET',body,anonymous=false}={}){
 const args=['exec',container,'curl','--silent','--show-error','--max-time','10','-w','\n%{http_code}','-X',method,'-H','Content-Type: application/json','-H','Prefer: return=representation'];
 if(!anonymous)args.push('-H','Authorization: Bearer '+jwt);
 if(body)args.push('--data',JSON.stringify(body));
 args.push('http://127.0.0.1:3000/'+path);
 const output=execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const at=output.lastIndexOf('\n');return {status:Number(output.slice(at+1)),data:JSON.parse(output.slice(0,at)||'null')};
}
try{
 execFileSync('docker',['run','-d','--rm','--name',name,'--network','container:'+container,
  '-e',`PGRST_DB_URI=postgresql://authenticator@127.0.0.1:5432/${database}?sslmode=disable`,
  '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_JWT_SECRET='+secret,
  'public.ecr.aws/supabase/postgrest:v16.2'],{stdio:'pipe'});
 let ready=false;
 for(let i=0;i<10;i++){try{if(request('rpc/current_inventory_workspace',{method:'POST',body:{}}).status===200){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,500));}
 assert.ok(ready,'disposable REST server ready');
 for(const [active,foreign] of [['tenant-a-item','tenant-a2-item'],['tenant-a2-item','tenant-a-item']]){
  sql(`update user_preferences set active_workspace_id='${ids[active]}' where user_id='${owner}'`);
  assert.equal(request(`inventory_items?id=eq.${active}&select=id`).data.length,1);checks++;
  assert.deepEqual(request(`inventory_items?id=eq.${foreign}&select=id`).data,[]);checks++;
  assert.deepEqual(request(`inventory_items?id=eq.${foreign}`,{method:'PATCH',body:{asking_price:99}}).data,[]);checks++;
  const removal=request('rpc/remove_inventory_lot_quantity',{method:'POST',body:{p_inventory_item_id:foreign,p_quantity:1,p_reason:'Forbidden API probe',p_idempotency_key:'foreign-api'}});
  assert.equal(removal.status,403);assert.equal(removal.data.message,'INVENTORY_WORKSPACE_FORBIDDEN');checks++;
  const labels=request('rpc/label_targets',{method:'POST',body:{p_workspace_id:ids[foreign],p_ids:[foreign]}});
  assert.ok(labels.status>=400);assert.notEqual(labels.data.code,'PGRST202','must exercise an existing RPC');checks++;
 }
 const anon=request('inventory_items?id=eq.tenant-a-item&select=id',{anonymous:true});
 assert.ok(anon.status===401||anon.status===403||(anon.status===200&&anon.data.length===0));checks++;
 assert.equal(sql("select md5(string_agg(to_jsonb(i)::text,',' order by user_id,id)) from inventory_items i"),before);checks++;
 console.log(`PASS ${checks} real REST isolation/preservation assertions`);
}finally{
 sql(`update user_preferences set active_workspace_id='${old}' where user_id='${owner}'`);
 try{execFileSync('docker',['stop',name],{stdio:'pipe'});}catch{}
}
