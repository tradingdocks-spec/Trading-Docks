// Real Supabase Storage HTTP acceptance on an internal-only disposable network.
// No hosted credentials, production endpoints, external integrations or .env files.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, createHmac, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const dbContainer='supabase_db_trading-docks-recovery-test', stamp=Date.now();
const database=`chaos_storage_${stamp}`, role=`scan_storage_${stamp}`, network=`td-scan-storage-${stamp}`, container=`td-scan-storage-${stamp}`;
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:120000});
const current=JSON.parse(docker('inspect',dbContainer))[0];
assert.deepEqual(current.NetworkSettings.Networks,{});assert.equal(current.State.Running,true);assert.match(current.Config.Image,/supabase\/postgres:17\./);
const sql=(query,db=database,user='postgres')=>execFileSync('docker',['exec','-i',dbContainer,'psql','-U',user,'-d',db,'-X','-qAt','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:120000}).trim();
const owner='11111111-1111-4111-8111-111111111177', other='11111111-1111-4111-8111-111111111178', batch=crypto.randomUUID();
const secret=randomBytes(32).toString('hex'), password=randomBytes(32).toString('hex');
const token=(role,sub)=>{const a=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),b=Buffer.from(JSON.stringify({role,sub,iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return `${a}.${b}.${createHmac('sha256',secret).update(`${a}.${b}`).digest('base64url')}`};
const directory=mkdtempSync(join(tmpdir(),'td-storage-acceptance-')),envFile=join(directory,'storage.env');
let connected=false,created=false;
try {
  sql(`create database ${database} template collector_removal_rehearsal;`,'template1');
  sql(readFileSync('supabase/migrations/20260923204804_chaos_scan_albums_v2.sql','utf8'));
  sql(`create role ${role} login password '${password}';`);created=true;
  sql(`grant supabase_storage_admin,authenticated,anon,service_role to ${role};`,database,'supabase_admin');
  sql(`insert into auth.users(id,email) values('${owner}','storage-owner@example.invalid'),('${other}','storage-other@example.invalid'); update public.user_preferences set active_workspace_id=(select workspace_id from public.workspace_members where user_id='${owner}' limit 1) where user_id='${owner}';begin;set local request.jwt.claim.sub='${owner}';set local role authenticated;insert into public.inventory_locations(id,user_id,name) values('storage-box','${owner}','Storage fixture'); select public.chaos_scan_command('start','${JSON.stringify({batchId:batch,destinationId:'storage-box',deviceId:'fixture',workstationId:'fixture',backend:'SCANSNAP'})}'::jsonb);commit;`);
  const jpeg=await sharp({create:{width:100,height:150,channels:3,background:'#ffffff'}}).jpeg().toBuffer(),hash=createHash('sha256').update(jpeg).digest('hex');
  sql(`begin;set local request.jwt.claim.sub='${owner}';set local role authenticated;do $$ begin for i in 1..100 loop perform public.chaos_scan_command('reserve',jsonb_build_object('batchId','${batch}','captureId',gen_random_uuid(),'sha256','${hash}'));end loop;end $$;commit;`);
  const captures=JSON.parse(sql(`select json_agg(json_build_object('id',capture_id,'path',object_path)) from public.chaos_scan_captures where album_id='${batch}'`));
  writeFileSync(envFile,[`DATABASE_URL=postgresql://${role}:${password}@database:5432/${database}`,`AUTH_JWT_SECRET=${secret}`,`ANON_KEY=${token('anon')}`,`SERVICE_KEY=${token('service_role')}`,'TENANT_ID=stub','GLOBAL_S3_BUCKET=stub','STORAGE_BACKEND=file','FILE_STORAGE_BACKEND_PATH=/mnt','FILE_SIZE_LIMIT=8388608','UPLOAD_FILE_SIZE_LIMIT=8388608','UPLOAD_FILE_SIZE_LIMIT_STANDARD=8388608','ENABLE_IMAGE_TRANSFORMATION=false','IMAGE_TRANSFORMATION_ENABLED=false','S3_PROTOCOL_ENABLED=false','VECTOR_ENABLED=false','VECTOR_STORE_MIGRATIONS_ENABLED=false'].join('\n'));
  if(process.platform==='win32')execFileSync('icacls',[envFile,'/inheritance:r','/grant:r',`${process.env.USERDOMAIN}\\${process.env.USERNAME}:F`],{stdio:'ignore'});
  docker('network','create','--internal',network);docker('network','connect','--alias','database',network,dbContainer);connected=true;
  docker('run','-d','--name',container,'--network',network,'--env-file',envFile,'public.ecr.aws/supabase/storage-api:v1.72.1');
  // HTTP stays inside the isolated network/container; no published host port.
  const script=String.raw`
const assert=require('node:assert/strict'),{createHash,randomUUID}=require('node:crypto');
const p=JSON.parse(require('node:fs').readFileSync(0,'utf8'));
(async()=>{
 const base='http://127.0.0.1:5000';let ready=false,last=0;
 for(let i=0;i<60;i++){try{const r=await fetch(base+'/status',{signal:AbortSignal.timeout(3000)});last=r.status;ready=r.ok}catch{}if(ready)break;await new Promise(r=>setTimeout(r,1000))}assert.ok(ready,'Storage readiness '+last);
 const headers={Authorization:'Bearer '+p.ownerToken,'Content-Type':'image/jpeg'},jpeg=Buffer.from(p.jpeg,'base64');
 for(let start=0;start<p.captures.length;start+=8)await Promise.all(p.captures.slice(start,start+8).map(async capture=>{const response=await fetch(base+'/object/chaos-scans/'+capture.path,{method:'POST',headers,body:jpeg});if(!response.ok){const error=await response.json();throw Error('Storage upload '+response.status+': '+error.message)}}));
 const path=p.captures[0].path;
 const own=await fetch(base+'/object/authenticated/chaos-scans/'+path,{headers});assert.equal(own.status,200);assert.equal(createHash('sha256').update(Buffer.from(await own.arrayBuffer())).digest('hex'),p.hash);
 for(const jwt of [p.otherToken,p.anonToken]){const denied=await fetch(base+'/object/authenticated/chaos-scans/'+path,{headers:{Authorization:'Bearer '+jwt}});assert.ok(denied.status>=400,'protected object denial')}
 assert.ok((await fetch(base+'/object/public/chaos-scans/'+path)).status>=400,'private bucket public URL');
 assert.ok((await fetch(base+'/object/chaos-scans/'+path,{method:'POST',headers,body:jpeg})).status>=400,'immutable object');
 const arbitrary=path.slice(0,path.lastIndexOf('/')+1)+randomUUID()+'.jpg';
 assert.ok((await fetch(base+'/object/chaos-scans/'+arbitrary,{method:'POST',headers,body:jpeg})).status>=400,'unreserved upload');
 console.log('Storage HTTP PASS');
})().catch(error=>{console.error(error.message);process.exitCode=1});`;
  execFileSync('docker',['exec','-i',container,'node','-e',script],{input:JSON.stringify({captures,jpeg:jpeg.toString('base64'),hash,ownerToken:token('authenticated',owner),otherToken:token('authenticated',other),anonToken:token('anon')}),encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:120000});
  assert.equal(sql(`select count(*) from storage.objects where bucket_id='chaos-scans'`),'100');
  console.log(JSON.stringify({database,storageImage:'v1.72.1',uploads:100,objects:100,ownerRead:'PASS',crossTenant:'DENIED',anonymous:'DENIED',publicURL:'DENIED',overwrite:'DENIED',unreservedUpload:'DENIED'}));
} finally {
  try{docker('rm','-f',container)}catch{}
  if(connected)docker('network','disconnect',network,dbContainer);
  try{docker('network','rm',network)}catch{}
  writeFileSync(envFile,'# Disposable credentials destroyed after acceptance.\n');
  if(created){sql(`alter role ${role} nologin password null; reassign owned by ${role} to postgres; drop role ${role};`,database,'supabase_admin')}
  assert.deepEqual(JSON.parse(docker('inspect',dbContainer))[0].NetworkSettings.Networks,{});
}
