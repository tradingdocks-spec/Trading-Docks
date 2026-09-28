import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAHUlEQVQokWP4TyJgGNVABGAgRhEyGNVADKB9KAEAr639H8LdEzEAAAAASUVORK5CYII=', 'base64');
const front = { name: 'card-A.png', mimeType: 'image/png', buffer: bytes };
const state = async (request: APIRequestContext) => (await request.get('/api/chaos-sort/scans')).json();

test.beforeEach(async ({ page, request }) => {
  await request.delete('/api/chaos-sort/scans');
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Choose Card Images', exact: true })).toBeEnabled();
});

async function upload(page: Page) {
  await page.getByLabel('Card front images').setInputFiles(front);
  await page.getByRole('button', { name: 'Identify Cards', exact: true }).click();
}
async function provider(page: Page) {
  const control = { failed: true, calls: 0 };
  await page.route('**/api/purchasing/card-photo-scan', async route => {
    control.calls++;
    await route.fulfill({ status: control.failed ? 503 : 200, json: control.failed
      ? { failureReason: 'quota_exhausted', providerCode: 'credit_balance_exhausted' }
      : { identification: { name: 'Recovered card', confidence: 0.5 }, candidates: [], requiresConfirmation: true } });
  });
  return control;
}
async function failed(page: Page) {
  await expect(page.getByRole('button', { name: 'Retry Failed (1)', exact: true })).toBeVisible();
  await expect(page.getByText('Cloud draft synchronized.', { exact: true })).toBeVisible();
}
async function retrySelected(page: Page) {
  await page.getByRole('button', { name: 'Recovered card', exact: true }).click();
  await page.getByRole('button', { name: 'Retry recognition', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recovered card', exact: true })).toBeVisible();
}

test('new duplicate intake is blocked before capture storage; provider recovery retries the same capture repeatedly', async ({ page, request }) => {
  const p = await provider(page);
  await upload(page); await failed(page);
  const before = await state(request), id = before.captures[0].capture_id;
  expect(before.uploads).toBe(1);
  await page.getByLabel('Card front images').setInputFiles({ ...front, name: 'renamed-same-image.png' });
  await expect(page.getByText(/Duplicate scan image\. Retry recognition on the existing capture instead/)).toBeVisible();
  expect((await state(request)).uploads).toBe(1);
  p.failed = false;
  await page.getByRole('button', { name: 'Retry Failed (1)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recovered card', exact: true })).toBeVisible();
  await retrySelected(page); await retrySelected(page);
  await expect.poll(() => p.calls).toBe(4);
  await expect.poll(async () => (await state(request)).captures[0].item.cardName).toBe('Recovered card');
  const after = await state(request);
  expect(after.captures.map((c: {capture_id: string}) => c.capture_id)).toEqual([id]);
  expect(after.uploads).toBe(1); expect(after.commits).toBe(0);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Recovered card', exact: true })).toBeVisible();
});

test('existing capture retries past historical duplicate markers without resurrecting tombstones', async ({ page, request }) => {
  const p = await provider(page);
  await upload(page); await failed(page);
  const s = await state(request), original = s.captures[0], removedId = '22222222-2222-4222-8222-222222222222';
  original.item = { ...original.item, processingState: 'ready', duplicateOfItemId: removedId, notes: 'Duplicate scan image.' };
  const tombstone = { ...original, capture_id: removedId, status: 'REMOVED', item: { ...original.item, id: removedId, captureId: removedId, humanState: 'removed' } };
  await request.post('/api/chaos-sort/scans', { data: { action: 'fixture-seed', payload: { captures: [tombstone, original] } } });
  await page.reload(); p.failed = false;
  await page.getByRole('button', { name: 'card-A.png', exact: true }).click();
  await page.getByRole('button', { name: 'Retry recognition', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recovered card', exact: true })).toBeVisible();
  await expect.poll(async () => (await state(request)).captures[1].item.duplicateOfItemId).toBeNull();
  const after = await state(request);
  expect(after.captures).toHaveLength(2); expect(after.captures[0]).toEqual(tombstone);
  expect(after.uploads).toBe(1); expect(p.calls).toBe(2);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
});

test('overlapping bulk and individual retries claim the capture before image retrieval', async ({ page, request }) => {
  const p = await provider(page); await upload(page); await failed(page);
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  await page.route('**/api/chaos-sort/scans?captureId=*', async route => { reads++; await blocked; await route.continue(); });
  p.failed = false;
  await page.getByRole('button', { name: 'Retry Failed (1)', exact: true }).click();
  await expect.poll(() => reads).toBe(1);
  await page.getByRole('button', { name: 'Retry recognition', exact: true }).first().click();
  release();
  await expect(page.getByRole('button', { name: 'Recovered card', exact: true })).toBeVisible();
  expect(p.calls).toBe(2); expect(reads).toBe(1);
  expect((await state(request)).captures).toHaveLength(1);
});

test('removal during a pending retry prevents recognition and resurrection after refresh', async ({ page, request }) => {
  const p = await provider(page); await upload(page); await failed(page);
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  await page.route('**/api/chaos-sort/scans?captureId=*', async route => { reads++; await blocked; await route.continue(); });
  await page.getByRole('button', { name: 'Retry Failed (1)', exact: true }).click();
  await expect.poll(() => reads).toBe(1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('article').getByRole('button', { name: 'Remove', exact: true }).click();
  await expect.poll(async () => (await state(request)).captures[0].status).toBe('REMOVED');
  release();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await page.reload();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  expect(p.calls).toBe(1);
  expect((await state(request)).captures[0].status).toBe('REMOVED');
});

test('retry at full capacity does not claim another slot or reject same-hash existing captures', async ({ page, request }) => {
  const p = await provider(page); await upload(page); await failed(page);
  const s = await state(request), first = s.captures[0];
  const captures = Array.from({ length: 100 }, (_, i) => {
    const id = i ? `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` : first.capture_id;
    return { ...first, capture_id: id, item: { ...first.item, id, captureId: id, sourceFileName: `card-${i}.png` } };
  });
  await request.post('/api/chaos-sort/scans', { data: { action: 'fixture-seed', payload: { captures } } });
  await page.reload(); p.failed = false;
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await page.getByRole('button', { name: 'Retry recognition', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Recovered card', exact: true })).toBeVisible();
  const after = await state(request);
  expect(after.captures.map((c: {capture_id: string}) => c.capture_id)).toEqual(captures.map(c => c.capture_id));
  expect(after.uploads).toBe(1); expect(p.calls).toBe(2);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
});


test('three admitted captures recover historical duplicate markers without new intake', async ({ page, request }) => {
  const p = await provider(page); await upload(page); await failed(page);
  const original = (await state(request)).captures[0];
  const tombstones = [], active = [];
  for (let i = 4; i <= 6; i++) {
    const removedId = crypto.randomUUID(), id = crypto.randomUUID();
    tombstones.push({ ...original, capture_id: removedId, status: 'REMOVED', item: { ...original.item, id: removedId, captureId: removedId, humanState: 'removed' } });
    active.push({ ...original, capture_id: id, item: { ...original.item, id, captureId: id, sourceFileName: `Card000${i}.jpg`, processingState: 'ready', humanState: 'unknown', duplicateOfItemId: removedId, notes: 'Duplicate scan image.' } });
  }
  await request.post('/api/chaos-sort/scans', { data: { action: 'fixture-seed', payload: { captures: [...tombstones, ...active] } } });
  await page.reload(); p.failed = false;
  for (let i = 4; i <= 6; i++) {
    await page.getByRole('button', { name: `Card000${i}.jpg`, exact: true }).click();
    await page.getByRole('button', { name: 'Retry recognition', exact: true }).click();
    await expect.poll(async () => (await state(request)).captures[i - 1].item.cardName).toBe('Recovered card');
  }
  const after = await state(request);
  expect(after.captures.slice(0, 3)).toEqual(tombstones);
  expect(after.captures.slice(3).map((c: {capture_id: string}) => c.capture_id)).toEqual(active.map(c => c.capture_id));
  expect(after.captures.slice(3).every((c: {item: {duplicateOfItemId: string | null; notes: string}}) => c.item.duplicateOfItemId === null && !c.item.notes.includes('Duplicate scan image'))).toBe(true);
  expect(after.uploads).toBe(1); expect(after.commits).toBe(0); expect(p.calls).toBe(4);
  await page.reload();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
});
