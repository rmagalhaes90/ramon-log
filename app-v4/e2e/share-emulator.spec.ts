import { expect, test } from '@playwright/test';

test.skip(!process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Requires the local Firebase Auth Emulator');

interface OobCode {
  email: string;
  oobCode: string;
}

test('verifies an account and shares the weekly report via the clipboard fallback', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'share', { value: undefined, configurable: true });
    // Capturing the write directly avoids depending on OS clipboard
    // permissions, which WebKit does not let a test grant explicitly.
    (window as unknown as { __clipboardText?: string }).__clipboardText = undefined;
    navigator.clipboard.writeText = async (text: string) => {
      (window as unknown as { __clipboardText?: string }).__clipboardText = text;
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: /criar conta|create account/i }).click();
  const email = `share-${Date.now()}-${test.info().project.name}@example.test`;
  const password = 'LocalOnlyPassword1';
  await page.getByRole('textbox', { name: /e-?mail/i }).fill(email);
  await page.getByLabel(/senha|password/i).fill(password);
  await page
    .getByRole('button', { name: /criar conta|create account/i })
    .last()
    .click();
  await expect(
    page.getByRole('heading', { name: /verifique seu email|verify your email/i }),
  ).toBeVisible();

  const oobResponse = await fetch(
    'http://127.0.0.1:9099/emulator/v1/projects/demo-kyro-v4/oobCodes',
  );
  const { oobCodes } = (await oobResponse.json()) as { oobCodes: OobCode[] };
  const match = [...oobCodes].reverse().find((code) => code.email === email);
  if (!match) throw new Error(`no pending verification code for ${email}`);

  await page.goto(`/?mode=verifyEmail&oobCode=${match.oobCode}&apiKey=fake-api-key`);
  await expect(
    page.getByRole('heading', { name: /email verificado|email verified/i }),
  ).toBeVisible();
  await page.getByRole('link', { name: /voltar ao kyro|back to kyro/i }).click();

  // Onboarding may take a moment: Firestore's first read right after a
  // fresh sign-in can transiently report itself offline before the app's
  // retries (up to ~15s of backoff) recover, plus extra slack for slower
  // CI runners, so give this a much more generous timeout than default.
  await expect(page.locator('#onboarding-form')).toBeVisible({ timeout: 40000 });
  await page.locator('#onboarding-form button[type="submit"]').click();

  await expect(page.locator('#tour-title')).toBeVisible({ timeout: 20000 });
  await page.locator('#tour-skip').click();

  await page.locator('#open-progress').click();
  await page.locator('#share-report').click();

  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __clipboardText?: string }).__clipboardText),
    )
    .toMatch(/relatório semanal|weekly report/i);
});
