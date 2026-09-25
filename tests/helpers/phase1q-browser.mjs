import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export async function phase1qBrowser({page,userClient,owner,sql}) {
 const workspace=(await userClient.rpc('current_inventory_workspace')).data;
 const manifestId=randomUUID();
 const children=[2,4].map(quantity=>{const id=randomUUID(),key=manifestId+':'+id;return {version:1,operationId:key,userId:owner,workspaceId:workspace,inventoryItemId:id,endpoint:'create_inventory_item_with_event',args:{p_inventory:{id,user_id:owner,workspace_id:workspace,card_name:'Manifest browser fixture',quantity,data:{}},p_source:'csv_import',p_idempotency_key:key,p_related_entity_type:'inventory_append',p_related_entity_id:manifestId}};});
 const manifest={version:1,purpose:'append_import',userId:owner,workspaceId:workspace,commands:children};
 const sendManifest=m=>page.evaluate(async args=>{const r=await fetch('/api/collector-workspace/mutations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({command:{endpoint:'apply_inventory_manifest',args}})});return {status:r.status,body:await r.json()};},{p_operation_id:manifestId,p_manifest:m});
 const original=await sendManifest(manifest);assert.equal(original.status,200,JSON.stringify(original.body));
 assert.equal((await userClient.rpc('apply_collector_inventory_mutation',{p_inventory_item_id:children[0].inventoryItemId,p_mutation_type:'quantity',p_quantity:9,p_idempotency_key:randomUUID(),p_source:'collector_workspace'})).error,null);
 assert.deepEqual((await sendManifest({...manifest,commands:[...children].reverse()})).body,original.body);
 const different=structuredClone(manifest);different.commands[0].args.p_inventory.quantity=7;
 const conflict=await sendManifest(different);assert.equal(conflict.status,409);assert.match(conflict.body.error.message,/MANIFEST_IDEMPOTENCY_CONFLICT/);
 assert.equal(sql(`select quantity from inventory_items where user_id='${owner}' and id='${children[0].inventoryItemId}'`),'9');
 const post=body=>page.evaluate(async body=>{const r=await fetch('/api/chaos-sort/scans',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};},body);
 const location='phase1q-'+randomUUID();
 assert.equal((await userClient.from('inventory_locations').insert({id:location,user_id:owner,name:'Installed artifact fixture destination'})).error,null);
 const created=await post({action:'create',payload:{requestId:randomUUID(),destinationId:location,intakeMode:'live'}});
 assert.equal(created.status,200,JSON.stringify(created.body));const album=created.body;
 const captureId=randomUUID(),dir=mkdtempSync(join(tmpdir(),'td-phase1q-browser-agent-'));
 const input=join(dir,'scope.json'),output=join(dir,'capture.json');
 writeFileSync(input,JSON.stringify({User:owner,Workspace:workspace,Batch:album.id,Destination:location,Capture:captureId}));
 const log=execFileSync('pwsh',['-NoProfile','-File',resolve('tests/phase1m-installed-agent-evidence.ps1')],{env:{...process.env,TD_AGENT_PARITY_INPUT:input,TD_AGENT_PARITY_OUTPUT:output},encoding:'utf8',timeout:180000});
 writeFileSync(join(dir,'installed-evidence.log'),log);
 const artifact=JSON.parse(readFileSync(output,'utf8'));
 assert.equal(artifact.captureId,captureId);assert.equal(artifact.calls,1);assert.equal(artifact.binding.WorkspaceId,workspace);assert.equal(artifact.binding.BatchId,album.id);
 const upload=()=>page.evaluate(async ({album,id,image})=>{const form=new FormData();form.set('batchId',album);form.set('captureId',id);form.set('image',new Blob([Uint8Array.from(atob(image),c=>c.charCodeAt(0))],{type:'image/png'}),'fixture.png');const r=await fetch('/api/chaos-sort/scans',{method:'POST',body:form});return {status:r.status,body:await r.json()};},{album:album.id,id:captureId,image:artifact.capture.image});
 const uploaded=await upload();assert.equal(uploaded.status,200,JSON.stringify(uploaded.body));const duplicateUpload=await upload();assert.equal(duplicateUpload.status,200,JSON.stringify(duplicateUpload.body));
 // Real existing catalog adapter in the Next API resolves this public printing.
 // No recognition request/credit, private image, production user or stock is used.
 const named=await fetch('https://api.scryfall.com/cards/named?exact=Opt',{headers:{Accept:'application/json','User-Agent':'TradingDocks/1.0 card-intelligence acceptance'}});assert.equal(named.status,200);
 const card=await named.json();assert.ok(card.id&&card.lang&&card.finishes.length);
 const base={id:captureId,captureId,batchId:album.id,quantity:1,humanState:'confirmed',processingState:'ready',recognitionState:'high_confidence',scryfallId:card.id,gameId:'magic',cardName:card.name,setCode:card.set,collectorNumber:card.collector_number,condition:'NM',finish:card.finishes[0],language:card.lang};
 let revision=0;
 const review=async item=>{const r=await post({action:'review',payload:{batchId:album.id,captureId,revision,item}});assert.equal(r.status,200,JSON.stringify(r.body));revision=r.body.revision;};
 const events=()=>Number(sql(`select count(*) from inventory_events where user_id='${owner}' and related_entity_type='chaos_sort_batch'`));
 const before=events();
 for(const changes of [{finish:'invented'},{setCode:'wrong'},{condition:null},{recognitionState:'unknown'}]) {
  await review({...base,...changes});const result=await post({action:'commit',payload:{batchId:album.id}});
  assert.equal(result.status,409);assert.match(result.body.error,/REVIEW_REQUIRED/);assert.equal(events(),before);
  const direct=await userClient.rpc('chaos_scan_command',{action:'commit',payload:{batchId:album.id}});assert.match(direct.error?.message??'',/REVIEW_REQUIRED/);
 }
 await review(base);
 // The browser loses the reply AFTER SQL commits. Retrying keeps the batch ID.
 let lost=false;
 await page.route('**/api/chaos-sort/scans',async route=>{
  if(!lost&&route.request().postDataJSON()?.action==='commit'){lost=true;const response=await route.fetch();assert.equal(response.status(),200,await response.text());await route.abort('failed');}
  else await route.continue();
 });
 await assert.rejects(post({action:'commit',payload:{batchId:album.id}}));
 await page.unroute('**/api/chaos-sort/scans');assert.equal(events(),before+1);
 await page.reload();
 const replay=await post({action:'commit',payload:{batchId:album.id}});assert.equal(replay.status,200);assert.equal(replay.body.committedCount,1);
 assert.equal(events(),before+1);
 const row=sql(`select item_id from chaos_sort_inventory_positions where batch_id='${album.id}'`);
 assert.equal(sql(`select quantity from inventory_items where user_id='${owner}' and id='${row}'`),'1');
 assert.equal(sql(`select count(*) from chaos_scan_captures where album_id='${album.id}'`),'1');
 const committedRequest=JSON.parse(sql(`select committed_request from chaos_scan_private.commit_validation where batch_id='${album.id}'`));
 const altered=structuredClone(committedRequest);altered.items[0].quantity=2;
 const wrong=await userClient.rpc('commit_chaos_sort_batch',{payload:altered});assert.match(wrong.error?.message??'',/CHAOS_IDEMPOTENCY_CONFLICT/);
 assert.equal(events(),before+1);
 // A later deliberate stock edit is not undone by a restored old agent/browser operation.
 assert.equal((await userClient.rpc('apply_collector_inventory_mutation',{p_inventory_item_id:row,p_mutation_type:'quantity',p_quantity:3,p_idempotency_key:randomUUID(),p_source:'collector_workspace'})).error,null);
 assert.deepEqual((await post({action:'commit',payload:{batchId:album.id}})).body,replay.body);
 assert.equal(sql(`select quantity from inventory_items where user_id='${owner}' and id='${row}'`),'3');
 assert.equal(events(),before+1);
 const objectPath=sql(`select object_path from chaos_scan_captures where capture_id='${captureId}'`);
 const image=await userClient.storage.from('chaos-scans').download(objectPath);assert.equal(image.error,null);assert.ok(image.data.size>0);
 console.log('Phase1Q installed artifact/browser evidence: '+dir);
 return ['Real manifest API: ordered/reordered receipt replay, changed manifest HTTP 409, later stock preserved', 'Installed signed Core output → browser multipart API → private Storage → cloud review → existing Scryfall provider → trusted SQL commit → one inventory event; invalid attributes denied; native restart/duplicate + browser lost response/reload preserve one capture and commit'];
}
