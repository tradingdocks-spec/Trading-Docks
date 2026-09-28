import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import sharp from 'sharp';

const state = async (request: APIRequestContext) => (await request.get('/api/chaos-sort/scans')).json();
const printing = { id: '27baccc0-7e25-4f39-be0d-31cd98ca0dc5', name: 'Professor Zei, Anthropologist', setCode: 'TLA', setName: 'Avatar: The Last Airbender', collectorNumber: '238', language: 'en', prices: [{ label: 'Nonfoil reference', available: true, value: 0.23, currency: 'USD', source: 'Scryfall' }] };

async function uploadResults(page: Page, count = 2) {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.route('**/api/purchasing/card-photo-scan', route => {
    const review = route.request().postData()?.includes('review.png');
    return route.fulfill({ json: { identification: { name: review ? 'Possible card' : printing.name, setCode: 'TLA', collectorNumber: review ? '71' : '238', finish: 'unknown', confidence: review ? 0.55 : 0.99 }, candidates: review ? [] : [printing], requiresConfirmation: Boolean(review), warnings: review ? ['Two printings are possible. Check the collector number.'] : [] } });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Choose Card Images', exact: true })).toBeEnabled();
  const files = await Promise.all(['ready.png', 'review.png'].slice(0, count).map(async (name, i) => ({ name, mimeType: 'image/png', buffer: await sharp({ create: { width: 150, height: 210, channels: 3, background: { r: 32 + i * 25, g: 65, b: 82 } } }).png().toBuffer() })));
  await page.getByLabel('Card front images').setInputFiles(files);
  await page.getByRole('button', { name: 'Identify Cards', exact: true }).click();
  await expect(page.getByRole('button', { name: printing.name, exact: true })).toBeVisible();
  await expect(page.getByText('Cloud draft synchronized.', { exact: true })).toBeVisible();
}

test.beforeEach(async ({ request }) => { await request.delete('/api/chaos-sort/scans'); });

test('ready and review cards use readable metadata, one status, correct actions and selection', async ({ page, request }) => {
  await uploadResults(page);
  const ready = page.getByRole('article').filter({ hasText: printing.name });
  const review = page.getByRole('article').filter({ hasText: 'Possible card' });
  await expect(ready.getByText('Ready to add', { exact: true })).toBeVisible();
  await expect(ready.getByText('Avatar: The Last Airbender · TLA · #238', { exact: true })).toBeVisible();
  await expect(ready.getByText('Finish not determined · English', { exact: true })).toBeVisible();
  await expect(ready.getByText(/Nonfoil reference \$0.23/)).toBeVisible();
  await expect(ready.getByText('99% match · 0 owned', { exact: true })).toBeVisible();
  await expect(ready.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Confirm high confidence', exact: true })).toHaveCount(0);
  await expect(ready).not.toContainText(/BULK_CU|Bulk C\/U|CONFIRMED|Conf 99%/);
  await expect(ready.getByRole('button', { name: 'Remove', exact: true })).toBeEnabled();
  await expect(review.getByText('Review needed', { exact: true })).toBeVisible();
  await expect(review.getByText(/Two printings are possible/)).toBeVisible();
  await expect(review.getByText('Finish not determined · Language not determined', { exact: true })).toBeVisible();
  await expect(review.getByText(/\$0/)).toHaveCount(0);
  await expect(page.getByLabel('Recognition summary')).toContainText('2 cards scanned');
  await expect(page.getByLabel('Recognition summary')).toContainText('1 ready to add · 1 need review');
  await page.getByRole('button', { name: 'Select ready', exact: true }).click();
  await expect(ready.getByRole('checkbox')).toBeChecked(); await expect(review.getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: 'Select needs review', exact: true }).click();
  await expect(review.getByRole('checkbox')).toBeChecked(); await expect(ready.getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await expect(ready.getByRole('checkbox')).toBeChecked(); await expect(review.getByRole('checkbox')).toBeChecked();
  await ready.getByRole('button', { name: 'Change Match', exact: true }).click();
  await expect(page.getByLabel('Search / correct printing')).toBeVisible();
  await expect(page.locator('details[open]').getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
  const corrected = { ...printing, id: '11111111-1111-4111-8111-111111111123', name: 'Corrected exact printing', setName: 'Fixture Expansion', setCode: 'FIX', collectorNumber: '12', prices: [{ market: 0.5, currency: 'USD', source: 'scryfall:nonfoil' }] };
  await page.route('**/api/card-intelligence/search?*', route => route.fulfill({ json: { candidates: [corrected] } }));
  await page.getByLabel('Search / correct printing').fill('Corrected');
  await page.getByRole('button', { name: 'Find printings', exact: true }).click();
  await page.getByRole('button', { name: 'Corrected exact printing · FIX #12', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: corrected.name }).getByText('Review needed', { exact: true })).toBeVisible();
  await page.locator('details[open]').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: corrected.name }).getByText('Ready to add', { exact: true })).toBeVisible();
  await expect.poll(async () => (await state(request)).captures[0].item.scryfallId).toBe(corrected.id);
  await expect(page.getByRole('article').filter({ hasText: corrected.name })).toContainText('Nonfoil reference $0.50');
  expect((await state(request)).captures[0].item.marketPrice).toBe(0.5);
  await review.getByRole('button', { name: 'Review Match', exact: true }).click();
  await review.getByRole('button', { name: 'Mark unknown', exact: true }).click();
  await expect(review.getByText('Unknown', { exact: true })).toBeVisible();
  expect((await state(request)).commits).toBe(0);
});

test('mobile result cards fit the viewport, preserve readable actions and removal', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await uploadResults(page, 1);
  const row = page.getByRole('article');
  await row.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(row.getByRole('button', { name: 'Change Match', exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
  await row.screenshot({ path: '.playwright-results/chaos-results-mobile.png' });
  page.once('dialog', dialog => dialog.accept());
  await row.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(0);
  expect((await state(request)).captures[0].status).toBe('REMOVED');
});

test('desktop result layout screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await uploadResults(page);
  await page.getByLabel('Recognition summary').scrollIntoViewIfNeeded();
  await page.getByRole('article').first().locator('..').screenshot({ path: '.playwright-results/chaos-results-desktop.png' });
});
