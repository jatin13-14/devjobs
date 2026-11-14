import { test, expect } from '@playwright/test';
import { login } from './helpers/login.js';

const api = `${process.env.E2E_BACKEND_URL}/api/v1`;

test('admin login retries after 429 while the loading icon is still leaving', async ({ page }) => {
  let attempts = 0;
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      // Hold the actual Ant Design leave transition, as a suspended/background
      // renderer can. The request itself and React busy state still complete.
      style.textContent = '.ant-btn-loading-icon-motion-leave-active { transition-duration: 120s !important; }';
      document.head.append(style);
    });
  });
  await page.route(`${api}/auth/login/`, async (route) => {
    attempts += 1;
    await expect(page.locator('form button[type=submit]')).toHaveClass(/ant-btn-loading/);
    if (attempts === 1) {
      await route.fulfill({ status: 429, headers: { 'Retry-After': '1' }, json: { detail: 'Synthetic login quota response' } });
      await expect(page.getByRole('alert')).toBeVisible();
      console.log('429 button accessibility:', await page.locator('form button[type=submit]').ariaSnapshot());
    } else {
      await route.continue();
    }
  });
  await login(page, process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
  expect(attempts).toBe(2);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
});

for (const change of ['navigation', 'session replacement', 'context closure']) {
  test(`quota retry stops after ${change}`, async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      let attempts = 0;
      await page.route(`${api}/auth/login/`, async (route) => {
        attempts += 1;
        await route.fulfill({ status: 429, headers: { 'Retry-After': '1' }, json: { detail: 'Synthetic login quota response' } });
      });
      // Attach the rejection handler immediately, including when context closure
      // interrupts an in-flight Playwright operation.
      const result = login(page, process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD).then(() => null, (error) => error);
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.locator('form button[type=submit]')).not.toHaveClass(/ant-btn-loading/);
      if (change === 'navigation') await page.goto('/login');
      else if (change === 'session replacement') {
        await page.evaluate(async () => {
          const { writeAuth } = await import('/src/features/auth/api.js');
          await writeAuth(null);
        });
      } else await context.close();
      const error = await result;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(change === 'context closure' ? /closed/ : /Login retry abandoned/);
      expect(attempts).toBe(1);
    } finally { await context.close(); }
  });
}
