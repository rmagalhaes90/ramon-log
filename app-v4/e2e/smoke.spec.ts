import { expect, test } from '@playwright/test';

test('renders the v4 shell and baseline link', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'KYRO' })).toBeVisible();
  await expect(page.locator('.feature-grid article')).toHaveCount(4);
  await expect(page.getByRole('link', { name: /versão estável|stable version/i })).toHaveAttribute('href', '../index.html');
});
