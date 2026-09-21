import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base='https://trading-docks-pos-staging.vercel.app';
const f=JSON.parse(readFileSync('.local-fixtures/phase7-auth-fixture.json','utf8'));
const owner=JSON.parse(readFileSync('.local-fixtures/pos-staging-owner.json','utf8'));
assert.equal(f.project,'ukrcbmujzdyclrkghbvo'); assert.equal(owner.project,f.project);
const keys=JSON.parse(readFileSync('.local-fixtures/phase7-staging-keys.json','utf8').replace(/^\uFEFF/,''));
const results=[];
const c=createClient(`https://${f.project}.supabase.co`,keys.find(k=>k.name==='anon').api_key,{auth:{persistSession:false,autoRefreshToken:false}});
assert.equal((await c.auth.signInWithPassword(f.users.owner)).error,null);
for(const game of ['magic','pokemon']) {
  const r=await c.from('inventory_items').select('id,game_id,product_type,tcgplayer_product_id,tcgplayer_sku_id').eq('game_id',game).limit(20);
  assert.equal(r.error,null); assert.ok(r.data.every(x=>x.game_id===game));
  if(game==='magic') assert.ok(r.data.length>0);
  results.push(`Authenticated ${game} game filter PASS`);
}
for(const exact of [false,true]) {
  const r=await c.rpc('pos_command',{p_workspace_id:f.workspace,p_action:'search',p_body:{siteId:f.setup.siteId,query:'P7-PERF-5000',exact}});
  assert.equal(r.error,null);assert.ok(r.data.length>0);
  results.push(`POS ${exact?'exact barcode':'inventory search'} PASS`);
}
const browser=await chromium.launch({channel:'chrome',headless:true});
let page;
try {
  const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000}});
  await context.route('**/*',r=>new URL(r.request().url()).hostname.endsWith('.supabase.co') && new URL(r.request().url()).hostname!==`${f.project}.supabase.co`?r.abort():r.continue());
  page=await context.newPage();
  const failedInventory=[];
  page.on('response',r=>{if(r.url().includes('/rest/v1/inventory_items') && r.status()>=400) failedInventory.push(r.status());});
  await page.goto(base+'/sign-in');
  await page.getByLabel(/email address/i).fill(owner.email);
  await page.getByLabel(/^password$/i).fill(owner.password);
  await page.getByRole('button',{name:/^sign in$/i}).focus();await page.keyboard.press('Enter');
  await page.waitForURL(u=>u.pathname==='/dashboard',{timeout:60000});
  await page.goto(base+'/dashboard/inventory');
  await expect(page.getByLabel('Select Sandbox sample 1',{exact:true}).locator('visible=true')).toBeVisible({timeout:30000});
  await page.getByPlaceholder('Search inventory...').fill('Sandbox sample 1');
  await expect(page.getByLabel('Select Sandbox sample 2',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Select Sandbox sample 1',{exact:true}).locator('visible=true')).toBeVisible();
  results.push('Hosted Inventory renders and search narrows results PASS');
  const filters=page.getByRole('group',{name:'Collection game filter'});
  await filters.getByRole('button',{name:/PKM/i}).click();
  await expect(page.getByLabel('Select Sandbox sample 1',{exact:true})).toHaveCount(0);
  await filters.getByRole('button',{name:/MTG/i}).click();
  await expect(page.getByLabel('Select Sandbox sample 1',{exact:true}).locator('visible=true')).toBeVisible();
  results.push('Hosted game-context filter excludes other games and restores legacy Magic PASS');
  assert.deepEqual(failedInventory,[]);
  await expect(page.getByText(/Collection storage is unavailable/)).toHaveCount(0);
  for (const exact of ['false','true']) {
    const r=await context.request.get(base+'/api/pos?'+new URLSearchParams({action:'search',siteId:owner.setup.siteId,query:'SANDBOX-1',exact}));
    assert.equal(r.status(),200);assert.ok((await r.json()).length>0);
  }
  results.push('Deployed POS search/barcode API PASS');
  await page.screenshot({path:'.local-fixtures/inventory-staging-fixed.png',fullPage:true});
  writeFileSync('docs/inventory-staging-acceptance.json',JSON.stringify({at:new Date().toISOString(),base,project:f.project,status:'PASS',results},null,2));
  console.log(results.join('\n'));
} catch(e) {if(page) await page.screenshot({path:'.local-fixtures/inventory-staging-failure.png',fullPage:true});throw e;}
finally {await browser.close();}

