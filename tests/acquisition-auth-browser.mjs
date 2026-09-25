// Real Next application, GoTrue login, PostgREST and RLS; synthetic local users.
// Requires acquisition-auth-setup.mjs. Never uses a hosted Supabase URL.
import {chromium,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,openSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const runtime=JSON.parse(readFileSync(join(tmpdir(),'td-phase1g-local-runtime.json'),'utf8'));
assert.equal(runtime.url,'http://127.0.0.1:55321');
assert.equal(runtime.target,'supabase_db_td-phase1g-auth-20260924');
const admin=createClient(runtime.url,runtime.service,{auth:{persistSession:false,autoRefreshToken:false}});
const sql=q=>execFileSync('docker',['exec','-i',runtime.target,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']}).trim();
sql(readFileSync('supabase/migrations/20260925002945_acquisition_legacy_write_gate.sql','utf8'));
const password=randomUUID()+'!aA8';const email='phase1g-'+randomUUID()+'@example.invalid';
const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
if(created.error) throw Error('Local fixture user creation failed: '+created.error.message);
const owner=created.data.user.id;
sql(`insert into admin_membership_overrides(user_id,plan_id,granted_by) values('${owner}','business','${owner}') on conflict(user_id) do update set plan_id='business';
update user_preferences set active_workspace_id=(select workspace_id from workspace_members where user_id='${owner}' limit 1) where user_id='${owner}';`);
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:runtime.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:runtime.anon,NEXT_PUBLIC_SUPABASE_ANON_KEY:runtime.anon,NODE_ENV:'development',VERCEL_ENV:'development',NEXT_TELEMETRY_DISABLED:'1'};
for(const key of Object.keys(env)) if(/SQUARE|STRIPE|OPENAI|ANTHROPIC|SERVICE_ROLE|SUPABASE_SECRET|CRON_SECRET/i.test(key)) delete env[key];
const log=openSync(join(tmpdir(),'td-phase1g-next.log'),'w');
const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','4331'],{cwd:process.cwd(),env,stdio:['ignore',log,log],windowsHide:true});
let browser;const results=[];
const totals=()=>JSON.parse(sql(`select jsonb_build_object('purchases',(select count(*) from purchase_ledger where user_id='${owner}'),'cost',(select coalesce(sum(total_cost),0) from purchase_ledger where user_id='${owner}'),'items',(select count(*) from inventory_items where user_id='${owner}'),'units',(select coalesce(sum(quantity),0) from inventory_items where user_id='${owner}'),'events',(select count(*) from inventory_events where user_id='${owner}'))`));
try {
 for(let i=0;i<90;i++){try{if((await fetch('http://127.0.0.1:4331/sign-in')).ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
 browser=await chromium.launch({headless:true});
 // The production CSP allows hosted Supabase; only this local test context
 // bypasses CSP so it can reach loopback GoTrue. App authorization is unchanged.
 const context=await browser.newContext({bypassCSP:true,reducedMotion:'reduce',viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.setDefaultTimeout(30000);
 await page.goto('http://127.0.0.1:4331/sign-in');
 await page.getByLabel(/email address/i).fill(email);await page.getByLabel(/^password$/i).fill(password);
 await page.getByLabel(/^password$/i).press('Enter');
 await page.waitForURL(/\/dashboard/,{timeout:60000});results.push('Real GoTrue sign-in and application session');
 await page.goto('http://127.0.0.1:4331/dashboard/collection-buying');
 await page.getByPlaceholder('Card name',{exact:true}).fill('Phase 1G Fixture Card');
 await page.getByPlaceholder('Language',{exact:true}).fill('English');
 await page.getByPlaceholder('Set',{exact:true}).fill('TST');await page.getByPlaceholder('#',{exact:true}).fill('1');
 const row=page.locator('tbody tr').first();await row.locator('td').nth(2).locator('input').fill('NM');
 await row.locator('td').nth(3).locator('select').selectOption('nonfoil');
 await row.locator('td').nth(4).locator('input').fill('2');await row.getByPlaceholder('0.00').fill('3');
 const saved=page.waitForResponse(r=>r.url().endsWith('/api/collection-intake')&&r.request().method()==='POST');
 await page.getByRole('button',{name:/save draft/i}).click();assert.equal((await saved).status(),200);
 assert.deepEqual(totals(),{purchases:0,cost:0,items:0,units:0,events:0});
 await page.reload();await expect(page.getByPlaceholder('Card name',{exact:true})).toHaveValue('Phase 1G Fixture Card');
 results.push('Draft/review persisted through reload with no finance or stock');
 const draft=JSON.parse(sql(`select jsonb_build_object('id',id,'revision',revision) from collection_intakes where user_id='${owner}' order by created_at desc limit 1`));
 const post=body=>page.evaluate(async body=>{const r=await fetch('/api/collection-intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};},body);
 const completion={intakeId:draft.id,actualOffer:4,idempotencyKey:'collection-intake:'+draft.id+':complete',receiveNow:false};
 const commitment=await post({action:'complete',completion});assert.equal(commitment.status,200);assert.equal(commitment.body.result.status,'completed');
 assert.deepEqual(totals(),{purchases:1,cost:4,items:0,units:0,events:0});results.push('Authenticated financial commitment without physical receipt');
 const receipt=await post({action:'complete',completion:{...completion,receiveNow:true}});assert.equal(receipt.status,200);
 assert.deepEqual(totals(),{purchases:1,cost:4,items:1,units:2,events:1});
 for(let i=0;i<2;i++)assert.equal((await post({action:'complete',completion:{...completion,receiveNow:true}})).body.result.purchaseId,receipt.body.result.purchaseId);
 await page.reload();assert.equal((await post({action:'complete',completion:{...completion,receiveNow:true}})).status,200);
 assert.deepEqual(totals(),{purchases:1,cost:4,items:1,units:2,events:1});results.push('Receipt, duplicate submissions and refresh retry preserve one purchase/receipt');
 await page.goto('http://127.0.0.1:4331/dashboard/analytics');
 await expect(page.getByText('Financial purchases: 1')).toBeVisible();await expect(page.getByText('Agreed acquisition cost: $4.00')).toBeVisible();
 results.push('Real analytics page shows authoritative purchase count and cost');
 const userClient=createClient(runtime.url,runtime.anon,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.equal((await userClient.auth.signInWithPassword({email,password})).error,null);
 const itemId=receipt.body.result.items[0].inventoryItemId;
 const location='fixture-'+randomUUID();assert.equal((await userClient.from('inventory_locations').insert({id:location,user_id:owner,name:'Fixture receiving box'})).error,null);
 for(const change of [{p_mutation_type:'condition',p_condition:'LP'},{p_mutation_type:'storage',p_location_id:location}]) {
  const result=await userClient.rpc('apply_collector_inventory_mutation',{p_inventory_item_id:itemId,p_quantity:null,p_condition:null,p_finish:null,p_location_id:null,p_idempotency_key:randomUUID(),p_source:'collector_workspace',...change});
  assert.equal(result.error,null,JSON.stringify(result.error));
 }
 const item=await userClient.from('inventory_items').select('data,workspace_id').eq('id',itemId).single();assert.equal(item.error,null);
 assert.equal((await userClient.from('inventory_items').update({inventory_value:7,asking_price:8,data:{...item.data.data,notes:'Post-purchase note'}}).eq('id',itemId)).error,null);
 assert.ok((await userClient.from('inventory_items').update({data:{...item.data.data,costBasis:99}}).eq('id',itemId)).error);
 const afterEdits=totals();assert.equal(afterEdits.purchases,1);assert.equal(afterEdits.cost,4);assert.equal(afterEdits.units,2);
 await page.reload();await expect(page.getByText('Financial purchases: 1')).toBeVisible();await expect(page.getByText('Agreed acquisition cost: $4.00')).toBeVisible();
 results.push('Authenticated condition/location/notes/market/list-price edits preserve ledger; cost overwrite denied');
 const alternate=randomUUID();sql(`insert into workspaces(id,name,owner_id) values('${alternate}','Second fixture workspace','${owner}');insert into workspace_members(workspace_id,user_id,role) values('${alternate}','${owner}','owner') on conflict do nothing;update user_preferences set active_workspace_id='${alternate}' where user_id='${owner}';`);
 assert.deepEqual((await userClient.from('purchase_ledger').select('id').eq('id',receipt.body.result.purchaseId)).data,[]);
 assert.equal((await post({action:'complete',completion})).status,403);
 sql(`update user_preferences set active_workspace_id='${item.data.workspace_id}' where user_id='${owner}';`);
 const strangerEmail='phase1g-'+randomUUID()+'@example.invalid';const stranger=await admin.auth.admin.createUser({email:strangerEmail,password,email_confirm:true});assert.equal(stranger.error,null);
 const otherClient=createClient(runtime.url,runtime.anon,{auth:{persistSession:false,autoRefreshToken:false}});assert.equal((await otherClient.auth.signInWithPassword({email:strangerEmail,password})).error,null);
 assert.ok((await otherClient.rpc('finalize_intake_purchase',{p_intake_id:draft.id,p_actual_offer:4,p_idempotency_key:completion.idempotencyKey})).error);
 assert.deepEqual((await otherClient.from('purchase_ledger').select('id').eq('id',receipt.body.result.purchaseId)).data,[]);
 results.push('Same-owner cross-workspace read/mutation and unrelated authenticated user denied');
 const forgedId=randomUUID();const forgedLine=randomUUID();const forged=await post({action:'save',intake:{id:forgedId,revision:0,title:'Reviewed collection',workspaceId:'malformed-workspace',userId:stranger.data.user.id,status:'evaluating',items:[{id:forgedLine,cardName:'Second fixture',gameId:'magic',setCode:'TST',collectorNumber:'2',condition:'NM',finish:'nonfoil',language:'English',quantity:1,unitMarketValue:2,reviewState:'ready'}]}});
 assert.equal(forged.status,200);assert.equal(sql(`select user_id::text||':'||workspace_id::text from collection_intakes where id='${forgedId}'`),owner+':'+item.data.workspace_id);
 const duplicates=await Promise.all([post({action:'complete',completion:{intakeId:forgedId,actualOffer:1,idempotencyKey:forgedId}}),post({action:'complete',completion:{intakeId:forgedId,actualOffer:1,idempotencyKey:forgedId}})]);
 assert.equal(duplicates[0].status,200);assert.equal(duplicates[1].status,200);assert.equal(duplicates[0].body.result.purchaseId,duplicates[1].body.result.purchaseId);
 assert.equal(totals().purchases,2);assert.equal(totals().cost,5);
 results.push('Forged workspace ignored; simultaneous authenticated duplicate requests create one purchase');
 await page.goto('http://127.0.0.1:4331/dashboard/collection-buying');
 await page.getByRole('button',{name:'New intake',exact:true}).click();
 await page.getByPlaceholder('Card name',{exact:true}).fill('Single card UI purchase');
 await page.getByPlaceholder('Language',{exact:true}).fill('English');await page.getByPlaceholder('Set',{exact:true}).fill('TST');await page.getByPlaceholder('#',{exact:true}).fill('3');
 const uiRow=page.locator('tbody tr').first();await uiRow.locator('td').nth(2).locator('input').fill('NM');await uiRow.locator('td').nth(3).locator('select').selectOption('nonfoil');await uiRow.getByPlaceholder('0.00').fill('3');
 await page.getByLabel('Your offer',{exact:true}).fill('2');page.on('dialog',dialog=>dialog.accept());
 const finished=page.waitForResponse(r=>r.url().endsWith('/api/collection-intake')&&r.request().method()==='POST'&&JSON.parse(r.request().postData()||'{}').action==='complete');
 await page.getByRole('button',{name:'Complete purchase',exact:true}).dblclick();assert.equal((await finished).status(),200);
 assert.equal(totals().purchases,3);assert.equal(totals().cost,7);assert.equal(totals().units,4);
 results.push('Actual Complete purchase button, confirmation and double-click create one $2 single-card purchase');
 const anonymous=createClient(runtime.url,runtime.anon,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.ok((await anonymous.rpc('finalize_intake_purchase',{p_intake_id:draft.id,p_actual_offer:4,p_idempotency_key:completion.idempotencyKey})).error);
 sql(`insert into workspace_members(workspace_id,user_id,role) values('${item.data.workspace_id}','${stranger.data.user.id}','manager');update user_preferences set active_workspace_id='${item.data.workspace_id}' where user_id='${stranger.data.user.id}';insert into admin_membership_overrides(user_id,plan_id,granted_by) values('${stranger.data.user.id}','business','${owner}');`);
 const partnerDraft=randomUUID();const partnerSave=await otherClient.rpc('save_collection_intake',{p_intake:{id:partnerDraft,revision:0,status:'offer_ready',items:[{id:randomUUID(),cardName:'Manager-owned fixture',gameId:'magic',setCode:'TST',collectorNumber:'4',condition:'NM',finish:'nonfoil',language:'English',quantity:1,unitMarketValue:2,reviewState:'ready'}]}});assert.equal(partnerSave.error,null);
 assert.equal((await otherClient.rpc('finalize_intake_purchase',{p_intake_id:partnerDraft,p_actual_offer:1,p_idempotency_key:partnerDraft})).error,null);
 assert.ok((await otherClient.rpc('finalize_intake_purchase',{p_intake_id:draft.id,p_actual_offer:4,p_idempotency_key:completion.idempotencyKey})).error);
 results.push('Anonymous denied; manager can receive own intake in shared workspace but cannot finalize owner intake');
 await page.screenshot({path:join(tmpdir(),'td-phase1g-analytics.png'),fullPage:true});
 console.log('PASS '+results.join('; '));
 writeFileSync(join(tmpdir(),'td-phase1g-browser-results.json'),JSON.stringify({results,counts:totals()},null,2));
} catch(error) {
 console.error('Acceptance failed: '+error.message);
 if(browser){const page=browser.contexts()[0]?.pages()[0];if(page)await page.screenshot({path:join(tmpdir(),'td-phase1g-failure.png'),fullPage:true});}
 process.exitCode=1;
} finally {await browser?.close();child.kill();}
