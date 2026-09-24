import {test,expect} from '@playwright/test';
import {mock,open,pair} from '../helpers/mock-scanner-bridge';

test('100 kept cards: remove, refresh, replace with new identity, commit excludes immutable history',async({page})=>{
 expect((await page.request.post('/api/reset-fixture')).ok()).toBe(true);
 const state=await mock(page);state.external=true;
 await open(page);await pair(page);
 await page.getByRole('button',{name:'Arm One Capture',exact:true}).click();
 await expect.poll(()=>state.ack).toBe(1);
 const current=async()=> (await (await page.request.get('/api/chaos-sort/scans')).json());
 const initial=await current(),id=initial.album.id,first=initial.captures[0];
 const source=await (await page.request.get(`/api/chaos-sort/scans?captureId=${first.capture_id}`)).body();
 // Fill through the real server/RPC, then use the actual scanner UI at the boundary.
 for(let i=0;i<98;i++){
   const captureId=crypto.randomUUID();
   expect((await page.request.post('/api/chaos-sort/scans',{multipart:{batchId:id,captureId,image:{name:'fixture.jpg',mimeType:'image/jpeg',buffer:source}}})).ok()).toBe(true);
   expect((await page.request.post('/api/chaos-sort/scans',{data:{action:'review',payload:{batchId:id,captureId,revision:0,item:{...first.item,id:captureId,captureId}}}})).ok()).toBe(true);
 }
 await page.reload();
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','99');
 await page.getByRole('button',{name:'Arm One Capture',exact:true}).click();
 await expect.poll(()=>state.ack).toBe(2);
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');
 await expect(page.getByRole('button',{name:'Arm One Capture',exact:true})).toBeDisabled();
 const full=await current(),removed=full.captures.at(-1);
 await page.getByRole('button',{name:'Remove latest',exact:true}).click();
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','99');
 await expect(page.getByRole('button',{name:'Arm One Capture',exact:true})).toBeEnabled();
 const afterRemove=await current();
 expect(afterRemove.physicalCount).toBe(99);expect(afterRemove.captures).toHaveLength(100);
 const tombstone=afterRemove.captures.at(-1);expect(tombstone.status).toBe('REMOVED');
 await page.reload();
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','99');
 await page.getByRole('button',{name:'Arm One Capture',exact:true}).click();
 await expect.poll(()=>state.ack).toBe(3);
 await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','100');
 const replaced=await current(),replacement=replaced.captures.at(-1);
 expect(replaced.album.id).toBe(id);expect(replaced.album.destination_id).toBe(initial.album.destination_id);
 expect(replaced.captures).toHaveLength(101);expect(replacement.ordinal).toBe(101);
 expect(replacement.capture_id).not.toBe(removed.capture_id);
 expect(replaced.captures.find((c:{capture_id:string})=>c.capture_id===removed.capture_id)).toEqual(tombstone);
 const restore=await page.request.post('/api/chaos-sort/scans',{data:{action:'review',payload:{batchId:id,captureId:tombstone.capture_id,revision:tombstone.revision,item:{...tombstone.item,humanState:'confirmed'}}}});
 expect(restore.ok()).toBe(false);expect((await restore.json()).error).toContain('SCAN_CAPTURE_REMOVED_IMMUTABLE');
 expect((await page.request.get(`/api/chaos-sort/scans?captureId=${tombstone.capture_id}`)).ok()).toBe(true);
 await page.getByRole('button',{name:'Commit 100 Cards to Inventory',exact:true}).click();
 await expect(page.getByRole('heading',{name:'100 cards added',exact:true})).toBeVisible();
 expect(await (await page.request.get('/api/evidence')).json()).toMatchObject({cards:100,positions:100,events:100,captures:101,objects:101,closed:1});
 expect((await current()).captures.find((c:{capture_id:string})=>c.capture_id===removed.capture_id)).toEqual(tombstone);
 await expect(page.getByRole('link',{name:'Print Batch Label',exact:true})).toBeVisible();
});
