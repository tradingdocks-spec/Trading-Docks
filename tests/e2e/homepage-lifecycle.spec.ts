import { expect, test } from '@playwright/test';
import { expectNoDocumentOverflow } from './helpers';

test('card journey preserves identity and explains every demo stage without provider requests', async ({ page }) => {
  let writes = 0;
  page.on('request', request => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) && request.url().includes('/api/')) writes++;
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const demo = page.locator('#card-demo');
  const controls = page.getByRole('group', { name: 'Explore the card lifecycle' });
  const steps = [
    ['Scan', 'Identity confirmed'], ['Value', '$28.00'], ['Store', 'Box 04 / B / 018'],
    ['List', 'CSV export'], ['Sell', 'TD-1042'], ['Analyze', '$5.50'],
  ];
  for (const [name, result] of steps) {
    const button = controls.getByRole('button', { name: new RegExp(name) });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#journey-detail')).toContainText(result);
    await expect(demo.getByRole('heading', { name: 'Lightning Greaves' })).toBeVisible();
    await expect(demo).toContainText('Example data');
    await expectNoDocumentOverflow(page);
  }
  await demo.getByRole('button', { name: 'Back to scan' }).click();
  await expect(page.locator('#journey-detail')).toContainText('Identity confirmed');
  await controls.getByRole('button', { name: /Value/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#journey-detail')).toContainText('$28.00');
  expect(writes).toBe(0);
  await page.locator('#pricing summary').click();
  await expect(page.getByRole('region', { name: 'Homepage plan comparison' })).toBeVisible();
  await expectNoDocumentOverflow(page);
  const cta = page.getByRole('link', { name: 'Create your free account', exact: true }).first();
  await cta.click();
  await expect(page).toHaveURL(/\/sign-up\?plan=free$/);
  await expect(page.locator('input[name="plan"]')).toHaveValue('');
});

test('mobile menu supports escape and restores keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await trigger.click();
  await expect(page.getByRole('navigation', { name: 'Mobile site navigation' }).getByRole('link', { name: 'Lifecycle' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('navigation', { name: 'Primary site navigation' })).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});
