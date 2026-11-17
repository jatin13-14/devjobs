import { test, expect } from '@playwright/test';
import { routeMatrix } from './route-matrix.js';

// Traces remain disabled because fixtures contain ephemeral credentials.

const fixtures = JSON.parse(process.env.E2E_ROUTE_FIXTURES || '{}');
const rows = routeMatrix(fixtures);
const knownWarnings = ['Instance created by `useForm`', '[antd: message] Static function'];

async function install(page, role) {
  await page.goto('/login');
  await setCredentials(page, fixtures.accounts[role] || null);

}
async function setCredentials(page, credentials) {
  // Seed the persisted protocol, so the same tests execute the shipped bundle.
  await page.evaluate((credentials) => {
    localStorage.setItem('devjobs.auth.v2', JSON.stringify({ schema: 1, epoch: crypto.randomUUID(), revision: 1, pendingLogin: null, credentials }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'devjobs.auth.v2' }));
  }, credentials);
}
function watch(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (entry) => {
    if (entry.type() === 'error' && !knownWarnings.some((warning) => entry.text().includes(warning))
      && !entry.text().startsWith('Failed to load resource:')) errors.push(entry.text());
  });
  return errors;
}
async function rendered(page, row) {
  await expect(page.getByRole('heading', { name: row.heading, exact: true })).toBeVisible();
  await expect(page.getByText('Loading page…', { exact: true })).toHaveCount(0);
  await expect(page.locator('main')).not.toBeEmpty();
}
for (const url of ['/candidate', '/candidate/profile']) {
  test(`legacy skills server response is recoverable: ${url}`, async ({ page }) => {
    const errors = watch(page);
    await install(page, 'candidate');
    // Exact response observed from the long-running local backend: it ignored
    // opt-in pagination and returned the still-supported legacy array contract.
    await page.route('**/api/v1/candidates/me/skills/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(url);
    await expect(page.getByRole('alert').filter({ hasText: 'Something went wrong. Please try again.' })).toBeVisible();
    await expect(page.getByText('This page could not be displayed', { exact: true })).toHaveCount(0);
    await page.unroute('**/api/v1/candidates/me/skills/**');
    await page.getByRole('button', { name: url === '/candidate' ? 'Retry' : 'Retry skills', exact: true }).click();
    await rendered(page, rows.find((row) => row.url === url));
    if (url.endsWith('/profile')) await expect(page.getByRole('button', { name: 'Add skill', exact: true })).toBeEnabled();
    else await expect(page.getByRole('heading', { name: /Profile Completion/ })).toBeVisible();
    await page.reload();
    await rendered(page, rows.find((row) => row.url === url));
    await expect(page.getByText('This page could not be displayed', { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
for (const role of ['anonymous', 'candidate', 'owner', 'admin', 'member', 'outsider', 'platform']) {
  test(`route matrix: ${role} direct loads, reloads and history`, async ({ page }) => {
    test.setTimeout(180000);
    const errors = watch(page);
    await install(page, role);
    for (const row of rows) {
      const allowed = row.policy === 'public' || row.policy === role
        || row.policy === 'recruiter' && ['owner', 'admin', 'member', 'outsider'].includes(role)
        || row.policy === 'management' && ['owner', 'admin'].includes(role);
      const authRedirect = role !== 'anonymous' && ['/login', '/admin/login'].includes(row.url);
      await test.step(row.url, async () => {
        await page.goto(row.url);
        if (role === 'outsider' && row.policy === 'management') {
          await expect(page.getByRole('alert')).toBeVisible();
          await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toHaveCount(0);
          await page.reload();
          await expect(page.getByRole('alert')).toBeVisible();
        } else if (allowed && !authRedirect) {
          await rendered(page, row);
          if (role === 'outsider' && row.pattern === '/recruiter/jobs/:id') {
            await expect(page.getByRole('link', { name: 'Edit job', exact: true })).toHaveCount(0);
            await expect(page.getByRole('link', { name: 'View applicants', exact: true })).toHaveCount(0);
          }
          await page.reload();
          await rendered(page, row);
          // Use an application link, then native back/forward through that entry.
          const link = page.locator('main a[href="/"]').first();
          if (await link.isVisible()) {
            await link.click();
            await expect(page.getByRole('heading', { name: 'Find your next role', exact: true })).toBeVisible();
            await page.goBack(); await rendered(page, row);
            await page.goForward();
            await expect(page.getByRole('heading', { name: 'Find your next role', exact: true })).toBeVisible();
          }
        } else if (['member', 'outsider'].includes(role) && row.policy === 'management') {
          await expect(page.getByText('Job management requires an active OWNER or ADMIN membership.')).toBeVisible();
        } else {
          const destination = role === 'anonymous' ? '/login' : row.policy === 'platform' && role !== 'platform' ? '/' : role === 'candidate' ? '/candidate' : role === 'platform' ? '/admin' : '/recruiter';
          await expect(page).toHaveURL(new RegExp(`${destination === '/' ? '/$' : destination + '(?:\\?.*)?$'}`));
          await expect(page.locator('main')).not.toBeEmpty();
        }
      });
    }
    expect(errors).toEqual([]);
  });
}

test('unknown URL has an intentional 404 and recovery link', async ({ page }) => {
  await page.goto('/route-audit-does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Browse jobs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find your next role', exact: true })).toBeVisible();
});

for (const [role, url, endpoint] of [
  ['anonymous', `/jobs/${fixtures.job}`, `/jobs/${fixtures.job}/`],
  ['owner', '/recruiter/companies', '/recruiters/me/companies/'],
  ['candidate', '/candidate', '/candidates/me/profile/'],
]) {
  test(`malformed successful response is recoverable: ${role} ${url}`, async ({ page }) => {
    const errors = watch(page);
    await install(page, role);
    await page.route(`**/api/v1${endpoint}*`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
    await page.goto(url);
    await expect(page.getByRole('alert').first()).toBeVisible();
    await page.unroute(`**/api/v1${endpoint}*`);
    await page.getByRole('button', { name: 'Retry', exact: true }).first().click();
    const row = rows.find((row) => row.url === url);
    await rendered(page, row);
    expect(errors).toEqual([]);
  });
}

for (const failure of ['unavailable', 'malformed']) {
for (const row of rows.filter((row) => !['/login', '/admin/login', '/register/candidate', '/register/recruiter'].includes(row.url))) {
  const role = row.policy === 'public' ? 'anonymous' : row.policy === 'candidate' ? 'candidate' : row.policy === 'platform' ? 'platform' : 'owner';
  test(`${failure} API and mobile recovery: ${row.url}`, async ({ page }) => {
    const errors = watch(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await install(page, role);
    await page.route('**/api/v1/**', (route) => route.request().method() === 'GET'
      ? route.fulfill({ status: failure === 'unavailable' ? 503 : 200, contentType: 'application/json', body: failure === 'unavailable' ? JSON.stringify({ detail: 'Route audit service unavailable.' }) : 'null' }) : route.continue());
    await page.goto(row.url);
    // Company creation has no required read; its form remains actionable.
    if (row.pattern === '/recruiter/companies/new') await rendered(page, row);
    else await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page.locator('main')).not.toBeEmpty();
    await page.unroute('**/api/v1/**');
    await page.reload();
    await rendered(page, row);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

}

test('empty collections and slow detail response retain usable page states', async ({ page }) => {
  const errors = watch(page);
  await install(page, 'candidate');
  await page.route('**/api/v1/candidates/me/applications/*', (route) => route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } }));
  await page.goto('/candidate/applications');
  await expect(page.getByText('You haven’t applied to any jobs yet.')).toBeVisible();
  await page.unroute('**/api/v1/candidates/me/applications/*');
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route(`**/api/v1/jobs/${fixtures.job}/`, async (route) => { await pending; await route.continue(); });
  await page.goto(`/jobs/${fixtures.job}`);
  await expect(page.locator('.page-state .ant-spin')).toBeVisible();
  release();
  await expect(page.getByRole('heading', { name: 'Route audit engineer' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('invalid tokens expire to login and account switching drops private candidate content', async ({ page }) => {
  const errors = watch(page);
  await install(page, 'candidate');
  await page.goto('/candidate/applications');
  await expect(page.getByRole('heading', { name: 'Route audit engineer' })).toBeVisible();
  await setCredentials(page, fixtures.accounts.owner);
  await page.goto(`/recruiter?company=${fixtures.company}`);
  await expect(page.getByRole('heading', { name: 'Recruiter Workspace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'My applications' })).toHaveCount(0);
  await setCredentials(page, { ...fixtures.accounts.candidate, access: 'invalid', refresh: 'invalid' });
  await page.goto('/candidate');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Email address')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Email address')).toBeVisible();
  expect(errors).toEqual([]);
});

test('outsider cannot load company management or another candidate application', async ({ page }) => {
  const errors = watch(page);
  await install(page, 'outsider');
  await page.goto(`/recruiter/jobs/${fixtures.job}/edit?company=${fixtures.company}`);
  await expect(page.getByText('Job management requires an active OWNER or ADMIN membership.')).toBeVisible();
  await page.goto(`/candidate/applications/${fixtures.application}`);
  await expect(page).toHaveURL(/\/recruiter$/);
  await expect(page.getByRole('heading', { name: 'Recruiter Workspace' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('login retains the protected company query and hash across session initialization', async ({ page }) => {
  const errors = watch(page);
  await page.route('**/api/v1/auth/login/', (route) => route.fulfill({ json: fixtures.accounts.owner }));
  await page.goto(`/recruiter/jobs?company=${fixtures.company}#job-list`);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email address').fill('route-login@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-browser-only');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/recruiter/jobs\\?company=${fixtures.company}#job-list$`));
  await rendered(page, rows.find((row) => row.pattern === '/recruiter/jobs'));
  expect(errors).toEqual([]);
});

for (const [role, url] of [
  ['anonymous', '/jobs/00000000-0000-0000-0000-000000000000'],
  ['candidate', '/candidate/applications/00000000-0000-0000-0000-000000000000'],
  ['owner', `/recruiter/jobs/00000000-0000-0000-0000-000000000000?company=${fixtures.company}`],
]) {
  test(`missing object renders an error with recovery: ${url}`, async ({ page }) => {
    const errors = watch(page);
    await install(page, role);
    await page.goto(url);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    await expect(page.getByText('Loading page…', { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('malformed persisted session recovers to usable sign in', async ({ page }) => {
  const errors = watch(page);
  await page.route('**/api/v1/auth/login/', (route) => route.fulfill({ json: fixtures.accounts.candidate }));
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('devjobs.auth.v2', '{broken'));
  await page.goto('/candidate/profile');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Email address')).toBeVisible();
  await page.getByLabel('Email address').fill('route-login@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-browser-only');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page).toHaveURL(/\/candidate\/profile$/);
  await rendered(page, rows.find((row) => row.pattern === '/candidate/profile'));
  expect(errors).toEqual([]);
});
