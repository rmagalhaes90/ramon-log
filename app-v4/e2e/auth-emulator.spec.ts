import { expect, test } from '@playwright/test';

test.skip(!process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Requires the local Firebase Auth Emulator');

test('creates an isolated account and requires email verification', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /criar conta|create account/i }).click();
  const email = `browser-${Date.now()}-${test.info().project.name}@example.test`;
  await page.getByRole('textbox', { name: /e-?mail/i }).fill(email);
  await page.getByLabel(/senha|password/i).fill('LocalOnlyPassword1');
  await page
    .getByRole('button', { name: /criar conta|create account/i })
    .last()
    .click();

  await expect(
    page.getByRole('heading', { name: /verifique seu email|verify your email/i }),
  ).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /já verifiquei|i have verified/i }).click();
  await expect(page.getByRole('status')).toContainText(/ainda não|has not been confirmed/i);
});
