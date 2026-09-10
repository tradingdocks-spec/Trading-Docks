import { expect, test } from '@playwright/test';
import { MEMBERSHIP_PLANS } from '../../src/lib/membership-catalog';
import { expectNoDocumentOverflow } from './helpers';

test('homepage sample is useful without a market provider and controls work', async ({ page }) => {
  let marketRequests = 0;
  await page.route('**/api/multi-game-market*', async route => {
    marketRequests += 1;
    await route.abort();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const market = page.locator('#market');
  await expect(market).toContainText('sample market snapshot');
  await expect(market.locator('tbody tr')).toHaveCount(3);
  await expect(market.getByRole('link', { name: 'Open Market Center' })).toHaveCSS('color', await page.locator('html').getAttribute('data-theme') === 'dark' ? 'rgb(6, 21, 38)' : 'rgb(255, 255, 255)');
  for (const game of ['Pokemon', 'Pokemon JP', 'Lorcana', 'One Piece', 'Magic']) {
    const button = market.getByRole('button', { name: game, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(market.locator('tbody tr')).toHaveCount(3);
  }
  await market.getByRole('button', { name: 'Spread', exact: true }).click();
  await expect(market.locator('tbody tr').first()).toContainText('Sample rare');
  await market.getByRole('button', { name: 'Demand', exact: true }).click();
  await expect(market.locator('tbody tr').first()).toContainText('Sample uncommon');
  await expect(market).not.toContainText(/Connecting|Pending|Loading market/);
  expect(marketRequests).toBe(0);
  await expectNoDocumentOverflow(page);
  await expect(page.locator('#pricing').getByRole('link', { name: 'Choose Seller', exact: true }))
    .toHaveAttribute('href', '/sign-up?plan=seller&billing=monthly');
});

test('pricing cycles display canonical totals and preserve selection into signup', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.getByRole('combobox', {name:'Color theme'})).toBeEnabled();
  await expect(page.getByRole('main')).toBeVisible();
  // Wait for the page entrance to finish before clicking a moving control.
  await expect(page.locator('.td-route-enter')).toHaveCSS('transform', 'none');
  for (const cycle of ['annual', 'monthly'] as const) {
    const button = page.getByRole('group', { name: 'Billing cycle' }).getByRole('button', { name: cycle, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    for (const tier of ['collector', 'seller', 'store'] as const) {
      const plan = MEMBERSHIP_PLANS[tier];
      const article = page.getByRole('article').filter({ has: page.getByRole('heading', { name: plan.name, exact: true }) });
      if (cycle === 'annual') await expect(article).toContainText(`$${plan.annualPrice.toFixed(2)} billed annually`);
      else await expect(article).toContainText(`$${plan.monthlyPrice.toFixed(2)}`);
      await expect(article.getByRole('link', { name: `Choose ${plan.name}` }))
        .toHaveAttribute('href', `/sign-up?plan=${tier}&billing=${cycle}`);
    }
  }
  await expect(page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Store', exact: true }) }))
    .toContainText('Employee accounts not yet available');
  await expectNoDocumentOverflow(page);
  await page.getByRole('button', { name: 'annual', exact: true }).click();
  await page.getByRole('link', { name: 'Choose Seller', exact: true }).click();
  await expect(page).toHaveURL(/\/sign-up\?plan=seller&billing=annual$/);
  await expect(page.locator('input[name="plan"]')).toHaveValue('seller');
  await expect(page.locator('input[name="billing"]')).toHaveValue('annual');
});
