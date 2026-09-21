import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const f = JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json', 'utf8'));
assert.equal(f.project, 'ukrcbmujzdyclrkghbvo');
const keys = JSON.parse(readFileSync('.local-fixtures/phase7-staging-keys.json', 'utf8').replace(/^\uFEFF/, ''));
const clients = {}, results = [];
for (const role of ['owner','cashier','delegated','nondelegated','manager','other']) {
  const c = createClient(`https://${f.project}.supabase.co`, keys.find(k => k.name === 'anon').api_key, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.equal((await c.auth.signInWithPassword(f.users[role])).error, null); clients[role] = c;
}
const checked = async p => { const r = await p; if (r.error) throw Error(r.error.message); return r.data; };
const command = (role, action, body = {}) => checked(clients[role].rpc('pos_command', { p_workspace_id: f.workspace, p_action: action, p_body: { key: randomUUID(), ...body } }));
const siteId = f.setup.siteId;
const deny = async (name, fn) => { await assert.rejects(fn, /POS_FORBIDDEN/); results.push({ name, status: 'PASS' }); };
const register = await command('owner','configure_register',{siteId,name:`Staff matrix ${Date.now()}`});
const session = await command('owner','open',{registerId:register.id,openingMinor:0});
const itemId = `staff-matrix-${Date.now()}`;
await checked(clients.owner.from('inventory_items').insert({id:itemId,user_id:f.users.owner.id,workspace_id:f.workspace,location_id:f.location,card_name:itemId,sku:itemId,quantity:5,asking_price:1}));
const intent = {key:randomUUID(),siteId,sessionId:session.id,expectedMinor:109,cashMinor:109,lines:[{ownerId:f.users.owner.id,itemId,quantity:1}]};
const grant = role => command('owner','grant',{siteId,employeeId:f.users[role].id,capabilities:['sell']});
await grant('delegated');
await command('owner','staff_permissions',{employeeId:f.users.delegated.id,permissions:{'pos.sell':true}});
const managerGrant = await grant('manager');
await command('owner','revoke',{id:managerGrant.id});
try {
  for (const role of ['nondelegated','manager','other']) for (const [action,body] of [['search',{siteId,query:itemId}],['search',{siteId,query:itemId,exact:true}],['quote',intent],['checkout',intent]])
    await deny(`${role} denied ${action}${body.exact?' barcode':''} on owner stock`,()=>command(role,action,body));
  for (const role of ['owner','delegated']) for (const exact of [false,true]) {
    const found = await command(role,'search',{siteId,query:itemId,exact});
    assert.equal(found[0].ownerId,f.users.owner.id);
    results.push({name:`${role} authorized ${exact?'barcode':'search'}`,status:'PASS'});
  }
  const sale = await command('delegated','checkout',intent);
  assert.equal(sale.receipt.actorId,f.users.delegated.id);
  const detail = await command('delegated','receipt',{saleId:sale.saleId});
  const refund = {saleId:sale.saleId,sessionId:session.id,expectedMinor:109,reason:'Staff permission acceptance',lines:[{saleItemId:detail.items[0].id,quantity:1,returnInventory:true}]};
  await deny('Delegated sell-only employee cannot refund',()=>command('delegated','refund',refund));
  await deny('Delegated sell-only employee cannot read manager daily report',()=>command('delegated','daily',{siteId}));
  await command('owner','staff_permissions',{employeeId:f.users.delegated.id,permissions:{'pos.sell':true,'pos.refund':true}});
  await command('owner','grant',{siteId,employeeId:f.users.delegated.id,capabilities:['sell','return']});
  await command('delegated','refund',refund);
  results.push({name:'Explicit refund permission and return delegation allow one restocking refund',status:'PASS'});
  await command('owner','staff_permissions',{employeeId:f.users.delegated.id,permissions:{'pos.sell':false,'pos.refund':true}});
  for (const [action,body] of [['search',{siteId,query:itemId}],['search',{siteId,query:itemId,exact:true}],['quote',intent],['checkout',intent],['refund',refund],['daily',{siteId}]])
    await deny(`Explicit sell=false cannot bypass via ${action}${body.exact?' barcode':''}`,()=>command('delegated',action,body));
  for (const [rpc,action] of [['pos_payment_command','capabilities'],['pos_payment_refund_command','create'],['pos_terminal_devices','get'],['pos_square_settings','get']]) {
    await deny(`Explicit sell=false cannot bypass via ${rpc}`,()=>checked(clients.delegated.rpc(rpc,{p_workspace_id:f.workspace,p_action:action,p_body:{siteId}})));
  }
  const closed = await command('owner','close',{registerId:register.id,sessionId:session.id,countedMinor:0});
  assert.equal(Number(closed.variance_minor),0);
} finally {
  await command('owner','staff_permissions',{employeeId:f.users.delegated.id,permissions:{'pos.sell':true}});
  await grant('delegated'); await grant('manager');
  writeFileSync('docs/pos-phase7b-staff-matrix.json',JSON.stringify({at:new Date().toISOString(),results},null,2));
}
console.log(`PASS ${results.length} hosted staff permission/ownership/refund/report boundaries`);
