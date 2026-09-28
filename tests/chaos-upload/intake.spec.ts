import { test, expect, type Page } from '@playwright/test';
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAHUlEQVQokWP4TyJgGNVABGAgRhEyGNVADKB9KAEAr639H8LdEzEAAAAASUVORK5CYII=', 'base64');
const front = (name: string) => ({name, mimeType:'image/png', buffer:Buffer.concat([image,Buffer.from(name)])});
test.beforeEach(async ({page,request}) => {
  await request.delete('/api/chaos-sort/scans');
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Choose Card Images',exact:true})).toBeEnabled();
});
async function identify(page: Page, count: number) {
  await expect(page.getByText(`${count} scans ready`,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Identify Cards',exact:true}).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow',String(count));
  await expect(page.getByRole('button',{name:`Resolve ${count} Items`,exact:true})).toBeEnabled();
}
test('multiple front files, visible removal, counts and refresh persistence', async ({page,request}) => {
  await expect(page.getByRole('button',{name:'Upload Scans',exact:true}).first()).toHaveAttribute('aria-pressed','true');
  await page.getByLabel('Card front images').setInputFiles([front('one.png'),front('two.png')]);
  await identify(page,2);
  let state = await (await request.get('/api/chaos-sort/scans')).json();
  expect(state.uploads).toBe(2); expect(new Set(state.captures.map((c: {capture_id: string; back_object_path?: string; status: string})=>c.capture_id)).size).toBe(2);
  expect(state.captures.every((c: {capture_id: string; back_object_path?: string; status: string})=>!c.back_object_path)).toBe(true);
  await page.getByRole('button',{name:'Resolve 2 Items',exact:true}).click();
  const remove = page.getByRole('button',{name:'Remove from Batch',exact:true});
  await expect(remove).toBeVisible();
  page.once('dialog',dialog=>dialog.accept()); await remove.click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');
  await page.reload();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');
  state=await (await request.get('/api/chaos-sort/scans')).json();
  expect(state.captures.filter((c: {capture_id: string; back_object_path?: string; status: string})=>c.status==='REMOVED')).toHaveLength(1);
  expect(state.commits).toBe(0);
});
test('whole drop zone accepts multiple files and reports unsupported files',async ({page,request})=>{
  const transfer=await page.evaluateHandle(({bytes})=>{const data=new DataTransfer();for(const name of ['one.png','two.png'])data.items.add(new File([new Uint8Array(bytes),name],name,{type:'image/png'}));data.items.add(new File(['unsupported'],'notes.txt',{type:'text/plain'}));return data;},{bytes:Array.from(image)});
  await page.getByTestId('card-image-dropzone').dispatchEvent('drop',{dataTransfer:transfer});
  await expect(page.getByText('1 file skipped. JPG, JPEG, PNG, and WebP are supported.',{exact:true})).toBeVisible();
  await identify(page,2);
  expect((await (await request.get('/api/chaos-sort/scans')).json()).uploads).toBe(2);
});
test('unsupported-only drop gives feedback without adding a capture',async ({page,request})=>{
  const transfer=await page.evaluateHandle(()=>{const data=new DataTransfer();data.items.add(new File(['no'],'notes.txt',{type:'text/plain'}));return data;});
  await page.getByTestId('card-image-dropzone').dispatchEvent('drop',{dataTransfer:transfer});
  await expect(page.getByText('Use JPG, JPEG, PNG, or WebP files.',{exact:true})).toBeVisible();
  expect((await (await request.get('/api/chaos-sort/scans')).json()).uploads).toBe(0);
});
test('oversized images are reported while valid selected fronts continue',async ({page,request})=>{
  await page.getByLabel('Card front images').setInputFiles([front('valid.png'),{name:'oversized.png',mimeType:'image/png',buffer:Buffer.alloc(3_900_001)}]);
  await expect(page.getByText('1 image skipped: the upload limit is 3.9 MB per image.',{exact:true})).toBeVisible();
  await identify(page,1);
  expect((await (await request.get('/api/chaos-sort/scans')).json()).uploads).toBe(1);
});
test('100-card capacity reports excess files rather than silently dropping them',async ({page,request})=>{
  await page.getByLabel('Card front images').setInputFiles(Array.from({length:101},(_,i)=>front(`front-${i}.png`)));
  await expect(page.getByText('100 scans ready',{exact:true})).toBeVisible({timeout:45000});
  await expect(page.getByText('Only 100 physical cards fit in this batch. 1 additional files skipped.',{exact:true})).toBeVisible();
  const state=await (await request.get('/api/chaos-sort/scans')).json();
  expect(state.uploads).toBe(100);expect(state.commits).toBe(0);
});
test('mobile upload stays usable and live scanner controls remain reachable',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByText('Select card photos',{exact:true})).toBeVisible();
  await expect(page.getByText('Drop scanned card images here',{exact:true})).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByLabel('Card front images').setInputFiles([front('mobile-one.png'),front('mobile-two.png')]);
  await identify(page,2);
  await expect(page.getByText('Cloud draft synchronized.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Live Scanner',exact:true}).click();
  await expect(page.getByRole('button',{name:'Connect Scanner',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Connect Scanner',exact:true}).click();
  await expect(page.getByRole('button',{name:'Scan One',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Test Scan',exact:true})).toBeVisible();
});
