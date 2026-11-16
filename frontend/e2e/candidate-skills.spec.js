import { test, expect } from '@playwright/test';
const api = `${process.env.E2E_BACKEND_URL}/api/v1`;
const run = process.env.E2E_RUN_ID;
async function install(page, auth) {
  await page.evaluate(async (auth) => { const { writeAuth } = await import('/src/features/auth/api.js'); await writeAuth(auth); }, auth);
}
function account(suffix) {
  expect(run).toBeTruthy();
  const fixtures = JSON.parse(process.env.E2E_SKILLS_ACCOUNTS);
  return fixtures[suffix];
}
test('candidate skills real API validation, pagination, removal and mobile keyboard controls', async ({ page, request }) => {
  const auth = account('workflow');
  const headers = { Authorization: `Bearer ${auth.access}` };
  for (let index = 0; index < 21; index += 1) {
    const result = await request.post(`${api}/candidates/me/skills/`, { headers, data: { name: `skill-${String(index).padStart(2, '0')}` } });
    expect(result.status()).toBe(201);
  }
  await page.goto('/login'); await install(page, auth); await page.goto('/candidate/skills');
  await expect(page.getByText('21 skills · Page 1')).toBeVisible();
  await page.getByRole('button', { name: 'Next skills page' }).click();
  await expect(page.getByText('21 skills · Page 2')).toBeVisible();
  const remove = page.getByRole('button', { name: 'Remove skill-20', exact: true });
  await remove.focus(); await expect(remove).toBeFocused(); await remove.press('Enter');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByText('20 skills · Page 1')).toBeVisible();
  await page.getByLabel('Skill', { exact: true }).fill('İ'.repeat(80));
  await page.getByRole('button', { name: 'Add skill', exact: true }).click();
  await expect(page.getByText('Ensure this value has at most 80 characters after normalization.')).toBeVisible();
  await page.getByLabel('Skill', { exact: true }).fill('  CAFÉ  ');
  await page.getByRole('button', { name: 'Add skill', exact: true }).click();
  await expect(page.getByText('21 skills · Page 1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove café', exact: true })).toBeVisible();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel('Skill', { exact: true }).focus();
    await expect(page.getByLabel('Skill', { exact: true })).toBeFocused();
  }
  await page.goto('/candidate/profile');
  await expect(page.getByRole('button', { name: 'Remove café', exact: true })).toBeVisible();
  const preview = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/candidates/me/skills/') && url.searchParams.get('pagination') === 'page' && url.searchParams.get('page_size') === '1';
  });
  await page.goto('/candidate');
  const response = await preview;
  expect(response.status()).toBe(200);
  const skills = await response.json();
  expect(skills.count).toBe(21);
  expect(skills.results).toHaveLength(1);
  await expect(page.getByRole('heading', { name: 'Find Your Next Opportunity' })).toBeVisible();

});
test('native cross-tab replacement rejects stale candidate skill submission before storage delivery', async ({ browser, request }) => {
  const authA = account('tab-a');
  const authB = account('tab-b');
  const context = await browser.newContext();
  try {
    const a = await context.newPage();
    await a.addInitScript(() => {
      window.holdSkillsStorage = false;
      window.addEventListener('storage', (event) => { if (window.holdSkillsStorage && event.key === 'devjobs.auth.v2') event.stopImmediatePropagation(); }, true);
    });
    await a.goto('/login'); await install(a, authA); await a.goto('/candidate/skills');
    await expect(a.getByText('No skills added.')).toBeVisible();
    await a.getByLabel('Skill', { exact: true }).fill('stale private payload');
    await a.evaluate(() => { window.holdSkillsStorage = true; });
    const b = await context.newPage(); await b.goto('/candidate/skills'); await install(b, authB);
    await expect(b.getByText('No skills added.')).toBeVisible();
    const writes = [];
    a.on('request', (req) => { if (req.method() === 'POST' && req.url().includes('/candidates/me/skills/')) writes.push(req); });
    await a.getByRole('button', { name: 'Add skill', exact: true }).click();
    await expect(a.getByRole('alert')).toBeVisible();
    expect(writes).toHaveLength(0);
    for (const auth of [authA, authB]) {
      const result = await request.get(`${api}/candidates/me/skills/`, { headers: { Authorization: `Bearer ${auth.access}` } });
      expect(await result.json()).toEqual([]);
    }
  } finally { await context.close(); }
});
