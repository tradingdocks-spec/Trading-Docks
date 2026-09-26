import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Browser-only acceptance: GET catalog requests and local cart storage; no data writes.
const origin = process.env.STOREFRONT_TEST_ORIGIN ?? 'http://127.0.0.1:3020';
const output = '.local-fixtures/storefront-polish';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [], failures = [];
const noOverflow = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
try {
  for (const theme of ['dark', 'light']) for (const width of [390, 430, 820, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme });
    expect(await context.cookies()).toEqual([]);
    await context.addInitScript((value) => { if (!localStorage.getItem('trading-docks-theme')) localStorage.setItem('trading-docks-theme', value); }, theme);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push({ width, theme, message: error.message }));
    page.on('console', msg => { if (msg.type() === 'error') errors.push({ width, theme, message: msg.text() }); });
    page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) failures.push({ url: response.url(), status: response.status() }); });
    const response = await page.goto(origin + '/shop');
    expect(response.status()).toBe(200);
    expect(response.request().redirectedFrom()).toBeNull();
    expect(response.headers()['content-security-policy']).not.toContain('unsafe-eval');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('#catalog article')).toHaveCount(24);
    const first = page.locator('#catalog article').first();
    await expect.poll(() => first.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(first).toContainText(/\$\d/);
    expect(await first.locator('img').getAttribute('loading')).toBe('lazy');
    const columns = await page.locator('#catalog article').first().evaluate(el => getComputedStyle(el.parentElement).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width >= 1600 ? 6 : width >= 1280 ? 5 : width >= 768 ? 4 : 2);
    await noOverflow(page);
    await expect(page.getByRole('button', { name: /Open cart/ })).toBeVisible();
    await expect(page.getByLabel('Color theme', { exact: true })).toHaveCount(0);
    const contrast = await page.locator('main').evaluate(el => {
      const style = getComputedStyle(el);
      const luminance = color => { let h = color.trim().replace('#', ''); if (h.length === 3) h = h.split('').map(c => c+c).join(''); const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
      const ratio = (a, b) => { const x = luminance(style.getPropertyValue(a)), y = luminance(style.getPropertyValue(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      return { text: ratio('--shop-text', '--shop-surface'), muted: ratio('--shop-muted', '--shop-surface'), accent: ratio('--shop-accent', '--shop-accent-ink') };
    });
    for (const value of Object.values(contrast)) expect(value).toBeGreaterThanOrEqual(4.5);
    if ([390, 430, 820, 1440].includes(width)) await page.screenshot({ path: `${output}/${theme}-${width}.png` });
    // Keyboard-visible focus and modal focus containment / Escape restoration.
    const cartButton = page.getByRole('button', { name: /Open cart/ });
    await cartButton.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    expect(await cartButton.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('Your cart is empty');
    for (let i = 0; i < 7; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('dialog'))).toBe(true); }
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(cartButton).toBeFocused();
    // Mobile/tablet filters are a modal sheet; desktop uses the quiet sidebar.
    let filters;
    if (width < 1024) {
      await expect(page.getByRole('complementary', { name: 'Catalog filters' })).toBeHidden();
      await page.getByRole('button', { name: /^Filters/ }).click();
      filters = page.getByRole('dialog', { name: 'Filters', exact: true });
      await expect(filters).toBeVisible();
      await filters.getByRole('checkbox', { name: /foil/i }).check();
      if (width === 390) await page.screenshot({ path: `${output}/${theme}-filters.png` });
    } else {
      filters = page.getByRole('complementary', { name: 'Catalog filters' });
      await filters.getByRole('checkbox', { name: /foil/i }).check();
    }
    await Promise.all([page.waitForURL(/finish=foil/), filters.getByRole('button', { name: 'Apply filters' }).click()]);
    await expect(page.getByRole('button', { name: 'Remove Finish: foil' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove Finish: foil' }).click();
    await expect(page.getByRole('button', { name: 'Remove Finish: foil' })).toHaveCount(0);
    await expect(page.locator('#catalog article')).toHaveCount(24);
    await page.getByRole('combobox', { name: 'Search store inventory' }).fill('Abzan Charm');
    await Promise.all([page.waitForURL(/q=Abzan/), page.getByRole('button', { name: 'Search', exact: true }).click()]);
    await expect(page.locator('#catalog article')).toHaveCount(3);
    const printings = await page.locator('#catalog article').allTextContents();
    expect(printings.some(t => t.includes('KTK') && t.includes('#161'))).toBe(true);
    expect(printings.some(t => t.includes('C20') && t.includes('#199'))).toBe(true);
    await Promise.all([page.waitForURL(/sort=price_desc/), page.getByRole('combobox', { name: 'Sort cards' }).selectOption('price_desc')]);
    const prices = await page.locator('#catalog article').allTextContents();
    const numbers = prices.map(s => Number(s.match(/\$([\d.]+)/)[1]));
    expect(numbers).toEqual([...numbers].sort((a,b) => b-a));
    await page.getByRole('link', { name: 'Clear all', exact: true }).click();
    await expect(page.getByRole('button', { name: /Remove Search/ })).toHaveCount(0);
    await page.goto(origin + '/shop?q=Sultai%20Charm');
    await expect(page.locator('#catalog article')).toContainText('$0.24');
    await page.getByRole('button', { name: 'View Sultai Charm details' }).click();
    await expect(page.getByRole('dialog')).toContainText('Magic: The Gathering');
    await expect(page.getByRole('dialog')).toContainText('$0.24');
    await noOverflow(page);
    await page.keyboard.press('Escape');
    await page.locator('#catalog article').getByRole('button', { name: 'Add to cart', exact: true }).click();
    await page.getByRole('button', { name: /Open cart/ }).click();
    await expect(page.getByRole('dialog').getByText('Current storefront price:', { exact: false })).toContainText('$0.24');
    await noOverflow(page);
    if (width === 390) await page.screenshot({ path: `${output}/${theme}-cart.png` });
    await page.keyboard.press('Escape'); await page.reload();
    await page.getByRole('button', { name: /Open cart/ }).click();
    await expect(page.getByRole('dialog').getByText('Current storefront price:', { exact: false })).toContainText('$0.24');
    await page.keyboard.press('Escape');
    await page.goto(origin + '/shop?q=NoSuchCardStorefrontPolish');
    await expect(page.getByRole('heading', { name: 'No matching cards' })).toBeVisible();
    // Theme switch remains in the header and does not overlap the cart.
    await page.getByRole('button', { name: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme` }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark');
    await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark');
    results.push({ width, theme, anonymous: true, status: 200, columns, contrast, filters: true, chips: true, search: true, sort: true, printings: true, detail: true, cart: true, refresh: true, keyboard: true, overflow: false });
    console.log(`PASS ${theme} ${width}px`);
    await context.close();
  }
  // Unmodified slug route remains public, including anonymous cart access.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const response = await page.goto(origin + '/s/trading-docks?q=Sultai%20Charm');
  expect(response.status()).toBe(200); expect(response.request().redirectedFrom()).toBeNull();
  await expect(page.locator('article')).toContainText('$0.24');
  await page.locator('article').getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: /^Cart/ }).click();
  await expect(page.getByText(/subtotal/i)).toBeVisible();
  results.push({ route: '/s/trading-docks', anonymous: true, status: 200, cart: true });
  await context.close();
  expect(errors).toEqual([]); expect(failures).toEqual([]);
  writeFileSync(`${output}/acceptance.json`, JSON.stringify({ results, errors, failures }, null, 2));
  console.log(JSON.stringify({ passed: results.length, errors, failures }));
} finally { await browser.close(); }
