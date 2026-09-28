import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { mock, open, pair } from '../helpers/mock-scanner-bridge';
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAHUlEQVQokWP4TyJgGNVABGAgRhEyGNVADKB9KAEAr639H8LdEzEAAAAASUVORK5CYII=','base64');
const front=(name:string)=>({name,mimeType:'image/png',buffer:image});
test.beforeEach(async({request})=>{expect((await request.post('/api/reset-fixture')).ok()).toBe(true);});

test('real local SQL: provider recovery retries stored identity, including a replacement beside its tombstone',async({page,request})=>{
 let unavailable=true,calls=0;
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.route('**/api/purchasing/card-photo-scan',async route=>{
  calls++;
  if(unavailable) await route.fulfill({status:503,json:{failureReason:'quota_exhausted',providerCode:'credit_balance_exhausted'}});
  else await route.continue();
 });
 await page.goto('/');
 await page.getByRole('combobox',{name:'Destination storage location',exact:true}).selectOption('scanner-fixture-location');
 await page.getByRole('button',{name:'Create Cloud Batch',exact:true}).click();
 const current=async()=> (await (await request.get('/api/chaos-sort/scans')).json());
 await expect(page.getByText('Cloud draft synchronized.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Choose Card Images',exact:true})).toBeEnabled();
 await page.getByLabel('Card front images').setInputFiles(front('review-one.png'));
 await page.getByRole('button',{name:'Identify Cards',exact:true}).click();
 await expect(page.getByRole('button',{name:'Retry Failed (1)',exact:true})).toBeVisible();
 await expect.poll(async()=> (await current()).captures[0].item?.processingState).toBe('failed');
 const first=(await current()).captures[0].capture_id;
 unavailable=false;
 await page.getByRole('button',{name:'Retry Failed (1)',exact:true}).click();
 await expect.poll(async()=> (await current()).captures[0].item?.processingState).toBe('ready');
 expect((await current()).captures.map((c:{capture_id:string})=>c.capture_id)).toEqual([first]);
 expect((await current()).physicalCount).toBe(1);
 await expect(page.getByText('Cloud draft synchronized.',{exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('article').getByRole('button',{name:'Remove',exact:true}).click();
 await expect.poll(async()=> (await current()).captures[0].status).toBe('REMOVED');
 await expect(page.getByText('Cloud draft synchronized.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Choose Card Images',exact:true})).toBeEnabled();
 await page.getByLabel('Card front images').setInputFiles(front('review-one.png'));
 await page.getByRole('button',{name:'Identify Cards',exact:true}).click();
 await expect.poll(async()=> (await current()).captures[1]?.item?.processingState).toBe('ready');
 await page.getByRole('button',{name:'Fixture Sol Ring',exact:true}).click();
 await page.getByRole('button',{name:'Retry recognition',exact:true}).click();
 await expect.poll(()=>calls).toBe(4);
 await expect.poll(async()=> (await current()).captures[1].item?.duplicateOfItemId).toBeNull();
 await page.reload();
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');
 const after=await current();
 expect(after.captures).toHaveLength(2);expect(after.captures[0].status).toBe('REMOVED');
 expect(await (await request.get('/api/evidence')).json()).toMatchObject({captures:2,objects:2,cards:0,positions:0,events:0});
 // Replay the same stored intake event: one row and one capacity slot.
 const second=after.captures[1].capture_id;
 for(let replay=0;replay<2;replay++) {
  expect((await request.post('/api/chaos-sort/scans',{multipart:{batchId:after.album.id,captureId:second,image:{name:'review-one.png',mimeType:'image/png',buffer:image}}})).ok()).toBe(true);
 }
 expect((await current()).captures).toHaveLength(2);
 expect((await current()).physicalCount).toBe(1);
 // A new upload with active identical bytes is rejected before another row exists.
 await expect(page.getByRole('button',{name:'Choose Card Images',exact:true})).toBeEnabled();
 await page.getByLabel('Card front images').setInputFiles(front('same-active.png'));
 await expect(page.getByText(/Duplicate scan image\. Retry recognition/)).toBeVisible();
 expect((await current()).captures).toHaveLength(2);
 // Removing B permits C; A/B remain tombstones, including after refresh.
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('article').getByRole('button',{name:'Remove',exact:true}).click();
 await expect.poll(async()=> (await current()).physicalCount).toBe(0);
 await expect(page.getByText('Cloud draft synchronized.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Choose Card Images',exact:true})).toBeEnabled();
 await page.getByLabel('Card front images').setInputFiles(front('review-one.png'));
 await page.getByRole('button',{name:'Identify Cards',exact:true}).click();
 await expect.poll(()=>calls).toBe(5);
 await expect.poll(async()=> (await current()).captures[2]?.item?.processingState).toBe('ready');
 await page.reload();
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');
 const third=await current();
 expect(third.captures).toHaveLength(3);
 expect(new Set(third.captures.map((c:{capture_id:string})=>c.capture_id)).size).toBe(3);
 expect(third.captures.slice(0,2).map((c:{status:string})=>c.status)).toEqual(['REMOVED','REMOVED']);
 expect(third.captures[2].item.duplicateOfItemId).toBeNull();
 expect(third.captures[2].item.cardName).toBe('Fixture Sol Ring');
 expect(await (await request.get('/api/evidence')).json()).toMatchObject({captures:3,objects:3,cards:0,positions:0,events:0});
});
test('real local SQL: one front review/removal persists, ten fronts commit once with unchanged destination',async({page,request})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('/');await page.getByRole('combobox',{name:'Destination storage location',exact:true}).selectOption('scanner-fixture-location');
 await page.getByRole('button',{name:'Create Cloud Batch',exact:true}).click();
 const files=page.getByLabel('Card front images');await expect(files).toBeEnabled();
 await files.setInputFiles(front('review-one.png'));
 await expect(page.getByText('1 scans ready',{exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Upload card scans'}).getByText('1 cards',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Identify Cards',exact:true}).click();
 await expect(page.getByRole('button',{name:'Resolve 1 Items',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Resolve 1 Items',exact:true}).click();
 await page.getByRole('button',{name:'Rotate 90°',exact:true}).click();
 await page.getByRole('button',{name:'Retry recognition',exact:true}).click();
 await expect(page.locator('details[open]').getByRole('button',{name:'Confirm',exact:true})).toBeEnabled();
 await page.locator('details[open]').getByRole('button',{name:'Confirm',exact:true}).click();
 const current=async()=> (await (await request.get('/api/chaos-sort/scans')).json());
 await expect.poll(async()=> (await current()).captures[0].item?.humanState).toBe('confirmed');
 const before=await current();expect(before.physicalCount).toBe(1);expect(before.captures[0].item.rotation).toBe(90);
 await page.reload();await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');
 if (!await page.getByRole('button',{name:'Remove from Batch',exact:true}).isVisible()) await page.locator('summary').filter({hasText:'Review inspector'}).click();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove from Batch',exact:true}).click();
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');await page.reload();
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');
 const tombstone=(await current()).captures[0];expect(tombstone.status).toBe('REMOVED');
 expect((await request.post('/api/chaos-sort/scans',{data:{action:'review',payload:{batchId:before.album.id,captureId:tombstone.capture_id,revision:tombstone.revision,item:before.captures[0].item}}})).ok()).toBe(false);
 expect((await request.get('/api/chaos-sort/scans?captureId='+tombstone.capture_id)).status()).toBe(404);
 expect(await (await request.get('/api/evidence')).json()).toMatchObject({cards:0,positions:0,events:0});
 const mixed=await Promise.all(Array.from({length:10},async(_,i)=>({name:`front-${i}.png`,mimeType:'image/png',buffer:await sharp({create:{width:16,height:16,channels:3,background:{r:10+i*20,g:50,b:150}}}).png().toBuffer()})));
 await expect(page.getByText('Cloud draft synchronized.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Choose Card Images',exact:true})).toBeEnabled();
 await files.setInputFiles(mixed);
 await expect(page.getByText('10 scans ready',{exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Upload card scans'}).getByText('10 cards',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Identify Cards',exact:true}).click();
 await expect(page.getByRole('button',{name:'Commit 10 Cards to Inventory',exact:true})).toBeEnabled();
 await expect.poll(async()=> (await current()).captures.filter((c:{status:string;item?:{humanState:string}})=>c.status!=='REMOVED'&&c.item?.humanState==='confirmed').length).toBe(10);
 await page.reload();await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','10');
 const ten=await current();expect(ten.album.destination_id).toBe('scanner-fixture-location');expect(new Set(ten.captures.map((c:{capture_id:string})=>c.capture_id)).size).toBe(11);
 expect(ten.captures.filter((c:{status:string;back_object_path:string|null})=>c.status!=='REMOVED').every((c:{back_object_path:string|null})=>c.back_object_path===null)).toBe(true);
 await page.getByRole('button',{name:'Commit 10 Cards to Inventory',exact:true}).click();
 await expect(page.getByRole('heading',{name:'10 cards added',exact:true})).toBeVisible();
 expect(await (await request.get('/api/evidence')).json()).toMatchObject({cards:10,positions:10,events:10,closed:1});
 expect((await request.post('/api/chaos-sort/scans',{data:{action:'commit',payload:{batchId:ten.album.id}}})).ok()).toBe(true);
 expect(await (await request.get('/api/evidence')).json()).toMatchObject({cards:10,positions:10,events:10});expect(errors).toEqual([]);
});


test('separate physical scanner events with identical bytes coexist without duplicate markers',async({page,request})=>{
 const scanner=await mock(page);scanner.external=true;
 let calls=0;
 await page.route('**/api/purchasing/card-photo-scan',async route=>{calls++;await route.continue();});
 await open(page);await pair(page);
 for(let i=1;i<=2;i++) {
  await page.getByRole('button',{name:'Arm One Capture',exact:true}).click();
  await expect.poll(()=>scanner.ack).toBe(i);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow',String(i));
 }
 const snapshot=await (await request.get('/api/chaos-sort/scans')).json();
 expect(snapshot.captures).toHaveLength(2);
 expect(new Set(snapshot.captures.map((c:{capture_id:string})=>c.capture_id)).size).toBe(2);
 expect(new Set(snapshot.captures.map((c:{sha256:string})=>c.sha256)).size).toBe(1);
 expect(snapshot.captures.every((c:{item:{duplicateOfItemId:string|null;processingState:string}})=>c.item.duplicateOfItemId===null&&c.item.processingState==='ready')).toBe(true);
 expect(calls).toBe(2);
 expect(await (await request.get('/api/evidence')).json()).toMatchObject({captures:2,cards:0,positions:0,events:0});
});
