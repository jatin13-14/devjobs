import { expect, test } from '@playwright/test';

const fixtures = JSON.parse(process.env.E2E_ROUTE_FIXTURES || '{}');
const existingCandidates = JSON.parse(process.env.E2E_SKILLS_ACCOUNTS || '{}');

async function identity(page, role) {
  await page.goto('/');
  await page.evaluate((credentials) => {
    localStorage.setItem('devjobs.auth.v2', JSON.stringify({
      schema: 1, epoch: crypto.randomUUID(), revision: 1, pendingLogin: null, credentials,
    }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'devjobs.auth.v2' }));
  }, role === 'candidate_other' ? existingCandidates['tab-a'] : fixtures.accounts[role]);
}

test('candidate saves, reloads, unsaves and remains isolated from another candidate', async ({ page }) => {
  test.setTimeout(120000);
  const job = fixtures.job;
  expect(job, 'Run the owned backend/run_browser.py harness').toBeTruthy();
  expect(existingCandidates['tab-a']).toBeTruthy();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await identity(page, 'candidate');
  await page.goto(`/jobs/${job}`);
  await expect(page.getByRole('heading', { name: 'Route audit engineer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save job', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save job', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove saved job', exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove saved job', exact: true })).toBeVisible();
  await page.goto('/candidate/saved-jobs');
  await expect(page.getByRole('heading', { name: 'Saved jobs', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Route audit engineer' })).toBeVisible();

  // Re-seeding auth simulates an account switch without copying bookmarks.
  await identity(page, 'candidate_other');
  await page.goto('/candidate/saved-jobs');
  await expect(page.getByText('No saved jobs yet')).toBeVisible();
  await page.goto(`/jobs/${job}`);
  await expect(page.getByRole('button', { name: 'Save job', exact: true })).toBeVisible();

  const owner = fixtures.accounts.owner;
  const forbidden = await page.request.get(
    `${process.env.E2E_BACKEND_URL}/api/v1/candidates/me/saved-jobs/`,
    { headers: { Authorization: `Bearer ${owner.access}` } },
  );
  expect(forbidden.status()).toBe(403);

  await identity(page, 'candidate');
  await page.goto('/candidate/saved-jobs');
  await expect(page.getByRole('link', { name: 'Route audit engineer' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove saved job', exact: true }).click();
  await expect(page.getByText('No saved jobs yet')).toBeVisible();
  await page.reload();
  await expect(page.getByText('No saved jobs yet')).toBeVisible();
  expect(errors).toEqual([]);
});
