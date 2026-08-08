import { expect, test } from '@playwright/test';

test('renders the v4 shell and baseline link', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'KYRO' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /entrar|sign in/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /e-?mail/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /versão estável|stable version/i })).toHaveAttribute(
    'href',
    '../index.html',
  );
});
