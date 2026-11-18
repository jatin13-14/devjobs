import { expect } from '@playwright/test';

const api = `${process.env.E2E_BACKEND_URL}/api/v1`;

export async function login(page, email, password = process.env.E2E_FIXTURE_PASSWORD) {
  await page.goto(email === process.env.E2E_ADMIN_EMAIL ? '/admin/login' : '/login');
  const loginUrl = page.url();
  const documentStart = await page.evaluate(() => performance.timeOrigin);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  // The loading icon contributes "loading" to the accessible name, including
  // during its leave transition. Select the form's semantic submit action and
  // synchronize with React's busy state rather than the decorative animation.
  const submit = page.locator('form button[type="submit"]');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect(submit).not.toHaveClass(/ant-btn-loading/);
    const [response] = await Promise.all([
      page.waitForResponse((response) => response.url() === `${api}/auth/login/`
        && response.request().method() === 'POST' && response.request().postDataJSON()?.email === email),
      submit.click(),
    ]);
    if (response.status() !== 429) {
      expect(response.ok()).toBe(true);
      await expect(page.getByRole('button', { name: 'Open user menu' })).toBeVisible();
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('devjobs.auth.v2'))?.credentials?.user?.email)).toBe(email);
      return;
    }
    expect(attempt, 'Only one server-directed quota retry is allowed').toBe(0);
    const seconds = Number(response.headers()['retry-after']);
    expect(Number.isFinite(seconds) && seconds > 0 && seconds <= 60).toBe(true);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(submit).not.toHaveClass(/ant-btn-loading/);
    const record = await page.evaluate(() => localStorage.getItem('devjobs.auth.v2'));
    expect(Boolean(JSON.parse(record)?.credentials)).toBe(false);
    // This is the server's quota deadline, not a sleep to conceal a UI race.
    await page.waitForTimeout(seconds * 1000);
    const current = await page.evaluate(() => ({ start: performance.timeOrigin, record: localStorage.getItem('devjobs.auth.v2') }));
    if (page.url() !== loginUrl || current.start !== documentStart || current.record !== record) {
      throw new Error('Login retry abandoned: document or authentication state changed');
    }
  }
}
