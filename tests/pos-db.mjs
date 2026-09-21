// Native, loopback-only disposable Postgres. Never reads app .env or remote URLs.
// Install test runtime separately: npm install --prefix .local-fixtures/pos-db
//   embedded-postgres@17.10.0-beta.17 pg@8.16.3
import EmbeddedPostgres from '../.local-fixtures/pos-db/node_modules/embedded-postgres/dist/index.js';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { verifyStaffingBoundary } from './pos-staffing-boundary.mjs';

const root = resolve('.local-fixtures/pos-db');
const cluster = resolve(root, `cluster-${Date.now()}`);
assert.ok(cluster.startsWith(root + '\\') || cluster.startsWith(root + '/'));
mkdirSync(root, { recursive: true });
const pg = new EmbeddedPostgres({ databaseDir: cluster, user: 'postgres', password: 'pos-test-only', port: 55439, persistent: true, postgresFlags: ['-c', 'listen_addresses=127.0.0.1'], onLog() {}, onError(message) { if (String(message).includes('FATAL')) console.error(String(message)); } });
let admin; let passed = 0;
const sql = path => readFileSync(path,'utf8');
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherWorkspace = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const batch = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
async function client(user=owner) {
  const c = pg.getPgClient('postgres','127.0.0.1'); await c.connect();
  await c.query('set role authenticated'); await c.query("select set_config('request.jwt.claim.sub',$1,false)",[user]); return c;
}
async function command(c, action, body={}, w=workspace) {
  if (!['availability','bootstrap','search','history','receipt','recover','cancel','setup','access','sessions','session_detail','daily','approvals','quote'].includes(action)) {
    body={...body,key:body.key??randomUUID()};
    if(action==='open') body.openingMinor??=0;
    if(['close','begin_close','resume','cash_event'].includes(action)&&!body.sessionId){
      const current=(await admin.query('select id from pos_register_sessions where register_id=$1 and closed_at is null',[body.registerId])).rows[0];
      body.sessionId=current?.id;
    }
    if(action==='close'&&body.countedMinor===undefined) body.countedMinor=Number((await admin.query('select pos_private.expected_cash($1) n',[body.sessionId])).rows[0].n);
  }
  return (await c.query('select public.pos_command($1,$2,$3) as result',[w,action,body])).rows[0].result;
}
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
try {
  await pg.initialise(); await pg.start(); admin=pg.getPgClient('postgres','127.0.0.1'); await admin.connect();
  await admin.query(sql('tests/fixtures/pos-prerequisites.sql'));
  for (const file of ['202607280004_inventory_persistence.sql','20260917014520_entitlement_production_repair.sql','202608090001_label_studio_inventory_qr_proposal.sql',...(process.argv.includes('--enum-ledger') ? ['202608120002_inventory_event_ledger.sql'] : ['202609060002_inventory_events.sql']),'202609070001_chaos_sort_sessions_and_positions.sql','20260918173226_selling_marketplace_platform_foundation.sql','20260918174321_selling_allocation_and_candidate_workflow.sql','20260918190000_selling_chaos_position_multiplicity.sql']) await admin.query(sql(`supabase/migrations/${file}`));
  await admin.query(sql('supabase/migrations/20260920181448_pos_cash_foundation.sql'));
  await admin.query(sql('supabase/migrations/20260920190428_pos_barcode_labels.sql'));
  await admin.query(sql('supabase/migrations/20260920201259_pos_staff_delegation.sql'));
  await admin.query(sql('supabase/migrations/20260920201754_pos_register_operations.sql'));
  await admin.query(sql('supabase/migrations/20260920211929_pos_payment_framework.sql'));
  await admin.query(sql('supabase/migrations/20260920220340_pos_square_sandbox.sql'));
  await admin.query(sql('supabase/migrations/20260920235705_pos_square_terminal.sql'));
  await admin.query(sql('supabase/migrations/20260921004339_pos_provider_request_budget.sql'));
  await admin.query(sql('supabase/migrations/20260921010637_pos_employee_permission_precedence.sql'));
  await admin.query(sql('supabase/migrations/20260921014756_pos_search_authority_scope.sql'));
  await admin.query(sql('supabase/migrations/20260921020747_pos_cart_scale_500.sql'));
  console.log('Migrations applied to disposable PostgreSQL');
  if (process.argv.includes('--advisors')) {
    try { console.log(execFileSync('powershell.exe',['-NoProfile','-Command','supabase db advisors --db-url postgresql://postgres:pos-test-only@127.0.0.1:55439/postgres?sslmode=disable --type security --level warn --fail-on error'],{encoding:'utf8',timeout:60000})); } catch(error) { console.log('LOCAL ADVISORS:',error.stdout?.toString(),error.stderr?.toString()); }
  }
  await admin.query(`insert into auth.users(id) values($1),($2);`,[owner,other]);
  await admin.query(`insert into workspaces values($1,'Store A',$2),($3,'Store B',$4)`,[workspace,owner,otherWorkspace,other]);
  await admin.query(`insert into workspace_members values($1,$2,'owner'),($3,$4,'owner');`,[workspace,owner,otherWorkspace,other]);
  await admin.query(`insert into profiles values($1),($2);`,[owner,other]);
  await admin.query(`insert into user_preferences(user_id,active_workspace_id) values($1,$2),($3,$4)`,[owner,workspace,other,otherWorkspace]);
  await admin.query(`insert into admin_membership_overrides values($1,'store'),($2,'store')`,[owner,other]);
  await admin.query(`insert into pos_workspace_settings values($1,true),($2,true)`,[workspace,otherWorkspace]);
  const a=await client(); const b=await client(); const stranger=await client(other);
  const clients=[a,b,stranger];
  try {
    await a.query(`insert into inventory_locations(id,user_id,name) values('case',$1,'Showcase A'),('spare',$1,'Spare')`,[owner]);
    await a.query(`insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price,data) values('bolt',$1,$2,'case','Lightning Bolt','TD-ABCD-EFGH',1,12.99,'{"condition":"NM","finish":"nonfoil","language":"EN"}')`,[owner,workspace]);
    const setup=await command(a,'setup',{name:'Phoenix',registerName:'Front',locationId:'case',taxBps:850});
    const session=await command(a,'open',{registerId:setup.registerId});
    const second=await admin.query(`insert into pos_registers(workspace_id,site_id,name) values($1,$2,'Second') returning id`,[workspace,setup.siteId]);
    const session2=await command(b,'open',{registerId:second.rows[0].id});
    const request=(sessionId=session.id)=>({key:randomUUID(),siteId:setup.siteId,sessionId,expectedMinor:1409,cashMinor:2000,discountReason:'',lines:[{itemId:'bolt',quantity:1,discountBps:0}]});
    await verifyStaffingBoundary({ admin, staff: stranger, ownerClient:a, owner, other, workspace, setup, request, command, check });
    await check('exact barcode resolves only authorized real inventory',async()=>{const rows=await command(a,'search',{siteId:setup.siteId,query:'TD-ABCD-EFGH',exact:true});assert.equal(rows.length,1);assert.equal(rows[0].unit_price_minor,1299);});
    await check('canonical label SKU remains stable through repricing',async()=>{
      const identity=(await a.query(`insert into inventory_label_identities(workspace_id,inventory_user_id,inventory_item_id,target_type,sku,qr_token) values($1,$2,'bolt','single','','') returning sku,qr_token`,[workspace,owner])).rows[0];
      assert.match(identity.sku,/^TD-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      await a.query("update inventory_items set asking_price=13 where id='bolt'");
      assert.equal((await command(a,'search',{siteId:setup.siteId,query:identity.sku,exact:true}))[0].unit_price_minor,1300);
      assert.equal((await command(a,'search',{siteId:setup.siteId,query:identity.qr_token,exact:true}))[0].id,'bolt');
      await a.query("update inventory_items set asking_price=12.99 where id='bolt'");
    });
    await check('cross-tenant search and setup denied',async()=>{await assert.rejects(command(stranger,'search',{siteId:setup.siteId,query:'Bolt'},workspace),/POS_FORBIDDEN/);await assert.rejects(command(stranger,'setup',{name:'Bad',registerName:'X',locationId:'case',taxBps:0},otherWorkspace),/POS_FORBIDDEN/);});
    await check('anonymous RPC execution denied',async()=>{const c=pg.getPgClient();await c.connect();await c.query('set role anon');await assert.rejects(command(c,'bootstrap'),/permission denied/);await c.end();});
    await check('direct ledger/table writes denied',async()=>{await assert.rejects(a.query('select * from pos_sales'),/permission denied/);await assert.rejects(a.query(`insert into inventory_events(user_id,event_type,source,related_entity_type) values($1,'quantity_removed','system','pos_sale')`,[owner]),/POS_FORBIDDEN|permission denied/);});
    await check('server rejects forged total with no writes',async()=>{await assert.rejects(command(a,'checkout',{...request(),expectedMinor:1}),/POS_QUOTE_CHANGED/);assert.equal((await admin.query('select count(*)::int n from pos_sales')).rows[0].n,0);});
    let completed; const req=request();
    await check('two registers compete for final copy: exactly one sale',async()=>{const results=await Promise.allSettled([command(a,'checkout',req),command(b,'checkout',request(session2.id))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1,results.map(r=>r.status==='rejected'?r.reason.stack:'ok').join('\n'));const failed=results.find(r=>r.status==='rejected');assert.match(failed.reason.message,/POS_STOCK_UNAVAILABLE/);completed=results.find(r=>r.status==='fulfilled').value;assert.equal((await admin.query(`select quantity from inventory_items where id='bolt'`)).rows[0].quantity,0);assert.equal((await admin.query('select count(*)::int n from pos_sales')).rows[0].n,1);});
    await check('cash totals, receipt and event are atomic',async()=>{assert.equal(completed.receipt.totalMinor,1409);assert.equal(completed.receipt.changeMinor,591);assert.equal((await admin.query("select count(*)::int n from inventory_events where related_entity_type='pos_sale'")).rows[0].n,1);});
    await check('replay returns original sale; changed intent rejected',async()=>{const original=(await admin.query('select request,idempotency_key from pos_sales')).rows[0];const replay={...original.request,key:original.idempotency_key};assert.equal((await command(a,'checkout',replay)).saleId,completed.saleId);await assert.rejects(command(a,'checkout',{...replay,cashMinor:3000}),/POS_IDEMPOTENCY_CONFLICT/);});
    await check('sale and canonical POS events cannot be changed',async()=>{await assert.rejects(admin.query('update pos_sales set total_minor=0'),/POS_IMMUTABLE/);await assert.rejects(admin.query("delete from inventory_events where related_entity_type='pos_sale'"),/POS_IMMUTABLE|append-only/);});
    await check('receipt survives current product changes',async()=>{await a.query("update inventory_items set card_name='Renamed',asking_price=99 where id='bolt'");assert.equal((await command(a,'receipt',{saleId:completed.saleId})).receipt.lines[0].name,'Lightning Bolt');assert.equal((await command(stranger,'receipt',{saleId:completed.saleId},otherWorkspace)).status,'not_found');});
    // Additional stock/cross-channel fixtures use the canonical owner path.
    await a.query(`insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price) values('reserved',$1,$2,'case','Reserved','RESERVED',1,1),('positioned',$1,$2,'case','Positioned','POSITIONED',3,1)`,[owner,workspace]);
    await admin.query(`insert into chaos_sort_batches(id,user_id,batch_code,current_quantity,initial_quantity) values($1,$2,'B1',3,3)`,[batch,owner]);
    await a.query(`insert into chaos_sort_inventory_positions(id,user_id,batch_id,item_id,quantity,location_id) values('p1',$1,$2,'positioned',1,'case'),('p2',$1,$2,'positioned',2,'case')`,[owner,batch]);
    const listingBatch=(await admin.query(`insert into selling_listing_batches(user_id,workspace_id,name) values($1,$2,'Test') returning id`,[owner,workspace])).rows[0].id;
    const candidate=(await admin.query(`insert into selling_listing_candidates(user_id,workspace_id,listing_batch_id,inventory_item_id,quantity) values($1,$2,$3,'reserved',1) returning id`,[owner,workspace,listingBatch])).rows[0].id;
    const reservedRequest={...request(),expectedMinor:109,lines:[{itemId:'reserved',quantity:1,discountBps:0}]};
    await check('marketplace reservation racing POS cannot double allocate',async()=>{const r=await Promise.allSettled([a.query('select reserve_selling_inventory($1,$2,1,$3)',[workspace,candidate,randomUUID()]),command(b,'checkout',reservedRequest)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);const state=(await admin.query(`select quantity,(select coalesce(sum(quantity),0)::int from selling_inventory_allocations where inventory_item_id='reserved' and status in ('ALLOCATED','RESERVED')) reserved from inventory_items where id='reserved'`)).rows[0];assert.ok(state.quantity>=state.reserved);});
    await check('exact position decrements parent, position and batch once',async()=>{const r=await command(a,'checkout',{...request(),expectedMinor:109,lines:[{itemId:'positioned',quantity:1,discountBps:0,positionId:'p2'}]});assert.equal(r.receipt.totalMinor,109);assert.equal((await admin.query("select quantity from chaos_sort_inventory_positions where id='p1'")).rows[0].quantity,1);assert.equal((await admin.query("select quantity from chaos_sort_inventory_positions where id='p2'")).rows[0].quantity,1);assert.equal((await admin.query('select current_quantity from chaos_sort_batches where id=$1',[batch])).rows[0].current_quantity,2);});
    await check('direct stock writes cannot invalidate positions',async()=>{await assert.rejects(a.query("update inventory_items set quantity=0 where id='positioned'"),/POS_STOCK_UNAVAILABLE/);});
    await check('exact unavailable position cannot fall back to another batch',async()=>{await assert.rejects(command(a,'checkout',{...request(),expectedMinor:217,lines:[{itemId:'positioned',quantity:2,positionId:'p1'}]}),/POS_STOCK_UNAVAILABLE/);assert.equal((await admin.query("select quantity from inventory_items where id='positioned'")).rows[0].quantity,2);});
    await check('discounts require manager and reason; totals calculated by database',async()=>{await assert.rejects(command(a,'checkout',{...request(),expectedMinor:55,lines:[{itemId:'positioned',quantity:1,discountBps:5000}]}),/POS_DISCOUNT_REASON/);const r=await command(a,'checkout',{...request(),expectedMinor:54,discountReason:'Manager markdown',lines:[{itemId:'positioned',quantity:1,discountBps:5000}]});assert.equal(r.receipt.discountMinor,50);assert.equal(r.receipt.taxMinor,4);});
    await check('same-tenant viewer cannot open/search/checkout',async()=>{await admin.query("update workspace_members set role='viewer' where user_id=$1",[owner]);await assert.rejects(command(a,'bootstrap'),/POS_FORBIDDEN/);await admin.query("update workspace_members set role='owner' where user_id=$1",[owner]);});
    await check('member cannot configure sites or discount',async()=>{await admin.query("update workspace_members set role='member' where user_id=$1",[owner]);await assert.rejects(command(a,'setup',{name:'X',registerName:'X',locationId:'spare',taxBps:0}),/POS_FORBIDDEN/);await assert.rejects(command(a,'checkout',{...request(),expectedMinor:54,discountReason:'Not authorized',lines:[{itemId:'positioned',quantity:1,discountBps:5000}]}),/POS_APPROVAL_REQUIRED/);await admin.query("update workspace_members set role='owner' where user_id=$1",[owner]);});
    await check('suspended account and inactive employee denied',async()=>{await admin.query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[owner]);await assert.rejects(command(a,'bootstrap'),/POS_FORBIDDEN/);await admin.query('update auth.users set banned_until=null where id=$1',[owner]);await admin.query("insert into workspace_employees(workspace_id,linked_user_id,employment_status) values($1,$2,'inactive')",[workspace,owner]);await assert.rejects(command(a,'bootstrap'),/POS_FORBIDDEN/);await admin.query("update workspace_employees set employment_status='active'");});
    await a.query(`insert into inventory_items(id,user_id,workspace_id,location_id,card_name,sku,quantity,asking_price,data) values('rollback',$1,$2,'case','Rollback','ROLLBACK',10,1,'{}'),('no-price',$1,$2,'case','No price','NO-PRICE',1,null,'{}'),('exempt',$1,$2,'case','Exempt','EXEMPT',1,1,'{"taxable":false}')`,[owner,workspace]);
    await check('missing price and inadequate cash never commit',async()=>{await assert.rejects(command(a,'checkout',{...request(),expectedMinor:0,lines:[{itemId:'no-price',quantity:1}]}),/POS_PRICE_REQUIRED/);await assert.rejects(command(a,'checkout',{...request(),expectedMinor:109,cashMinor:100,lines:[{itemId:'rollback',quantity:1}]}),/POS_CASH_INSUFFICIENT/);});
    await check('non-taxable stock has zero tax',async()=>{const r=await command(a,'checkout',{...request(),expectedMinor:100,lines:[{itemId:'exempt',quantity:1}]});assert.equal(r.receipt.taxMinor,0);});
    await check('failure after inventory writes rolls back sale, items and events',async()=>{const before=(await admin.query('select count(*)::int n from pos_sales')).rows[0].n;await admin.query(`create function pos_private.test_fail() returns trigger language plpgsql as $$begin raise exception 'INJECTED_TEST_FAILURE'; end$$;create trigger test_tender_failure before insert on pos_tenders for each row execute function pos_private.test_fail();`);await assert.rejects(command(a,'checkout',{...request(),expectedMinor:109,lines:[{itemId:'rollback',quantity:1}]}),/INJECTED_TEST_FAILURE/);await admin.query('drop trigger test_tender_failure on pos_tenders;drop function pos_private.test_fail()');assert.equal((await admin.query('select count(*)::int n from pos_sales')).rows[0].n,before);assert.equal((await admin.query("select quantity from inventory_items where id='rollback'")).rows[0].quantity,10);assert.equal((await admin.query("select count(*)::int n from inventory_events where inventory_item_id='rollback'")).rows[0].n,0);});
    await check('simultaneous duplicate checkout commits once',async()=>{const duplicate={...request(),expectedMinor:109,lines:[{itemId:'rollback',quantity:1}]};const [x,y]=await Promise.all([command(a,'checkout',duplicate),command(b,'checkout',duplicate)]);assert.equal(x.saleId,y.saleId);assert.equal((await admin.query("select quantity from inventory_items where id='rollback'")).rows[0].quantity,9);});
    await check('cancellation persists and prevents a delayed checkout request',async()=>{const canceled={...request(),expectedMinor:109,lines:[{itemId:'rollback',quantity:1}]};assert.equal((await command(a,'cancel',{key:canceled.key})).status,'canceled');await assert.rejects(command(b,'checkout',canceled),/POS_CHECKOUT_CANCELED/);assert.equal((await command(a,'recover',{key:canceled.key})).status,'canceled');});
    await check('canceling a completed checkout returns its receipt without reversal',async()=>{const saved=(await admin.query('select idempotency_key from pos_sales where id=$1',[completed.saleId])).rows[0];assert.equal((await command(a,'cancel',{key:saved.idempotency_key})).saleId,completed.saleId);});
    await check('history cursor uses timestamp plus ID and stays tenant scoped',async()=>{const history=await command(a,'history',{});assert.ok(history.length>1);const next=await command(a,'history',{before:history[0].created_at,beforeId:history[0].id});assert.deepEqual(next.map(x=>x.id),history.slice(1).map(x=>x.id));assert.deepEqual(await command(stranger,'history',{},otherWorkspace),[]);});
    await check('raw client cannot execute private helpers',async()=>{await assert.rejects(a.query('select pos_private.authorize($1)',[workspace]),/permission denied/);});
    await check('closed register prevents checkout',async()=>{await command(a,'close',{registerId:setup.registerId});await assert.rejects(command(a,'checkout',{...request(),lines:[{itemId:'positioned',quantity:1}]}),/POS_SESSION_CLOSED/);});
    await check('rollout off blocks new actions but permits receipt recovery',async()=>{await admin.query('update pos_workspace_settings set enabled=false where workspace_id=$1',[workspace]);await assert.rejects(command(a,'search',{siteId:setup.siteId,query:'Bolt'}),/POS_DISABLED/);assert.equal((await command(a,'receipt',{saleId:completed.saleId})).status,'completed');});
    await admin.query('update pos_workspace_settings set enabled=true where workspace_id=$1',[workspace]);
    const { verifyLabels } = await import('./label-db.mjs');
    await verifyLabels({admin,a,stranger,command,workspace,otherWorkspace,owner,other,check});
    const staffedSession=await command(a,'open',{registerId:setup.registerId});
    await verifyStaffingBoundary({ admin, staff:stranger, ownerClient:a, owner, other, workspace, setup, request:()=>request(staffedSession.id), command, check, extended:true });
    await command(a,'close',{registerId:setup.registerId});
    const {verifyOperations}=await import('./pos-operations-db.mjs');
    await verifyOperations({admin,a,b,staff:stranger,command,workspace,owner,other,setup,check,createClient:client});
    const {verifyPayments}=await import('./pos-payments-db.mjs');
    await verifyPayments({admin,a,b,stranger,command,workspace,owner,setup,check});
    const {verifySquare}=await import('./pos-square-db.mjs');
    const squareFixture=await verifySquare({admin,a,b,stranger,command,workspace,owner,setup,check});
    const {verifyTerminal}=await import('./pos-terminal-db.mjs');
    const terminalFixture=await verifyTerminal({admin,a,b,stranger,command,workspace,owner,setup,check});
    const {verifyMixedShift}=await import('./pos-mixed-shift.mjs');
    await verifyMixedShift({admin,a,command,workspace,owner,setup,check});
    if (process.argv.includes('--large-cart')) {
      const { verifyLargeCart } = await import('./pos-large-cart.mjs');
      await verifyLargeCart({admin,a,b,command,workspace,owner,setup,check});
    }
    if (process.argv.includes('--browser')) {
      await admin.query('update pos_workspace_settings set enabled=true where workspace_id=$1',[workspace]);
      if (!process.argv.includes('--shift')) {
        const {verifyTerminalBrowser}=await import('./pos-terminal-browser.mjs');
        await verifyTerminalBrowser({admin,a,command,workspace,owner,setup,terminalFixture});
        const { verifyLabelWorkflow }=await import('./label-workflow-browser.mjs');
        await verifyLabelWorkflow({a,admin,command:(action,body)=>command(a,action,body),workspace,owner});
      }
      const { verifyBrowser }=await import('./pos-browser.mjs');
      await verifyBrowser({admin, a, command: (action,body)=>command(a,action,body), workspace, owner});
      if (!process.argv.includes('--shift')) {
        const {verifyOperationsBrowser}=await import('./pos-operations-browser.mjs');
        await verifyOperationsBrowser({admin,a,staff:stranger,command,workspace,owner,other,setup});
        const {verifyPaymentsBrowser}=await import('./pos-payments-browser.mjs');
        await verifyPaymentsBrowser({admin,a,command,workspace,owner,setup,squareFixture});
      }
    }
  } finally { for(const c of clients) await c.end(); }
  console.log(`POS database checks: ${passed} passed`);
} finally { await admin?.end(); await pg.stop(); }
