import { test, expect } from '@playwright/test';

const api = `${process.env.E2E_BACKEND_URL}/api/v1`;
const password = process.env.E2E_FIXTURE_PASSWORD;
const run = process.env.E2E_RUN_ID;
async function inspectWorkspace(page, role) {
  await expect(page.getByRole('navigation', { name: `${role} workspace` })).toBeVisible();
  const backgrounds = {
    candidate: { light: 'rgb(249, 250, 255)', dark: 'rgb(11, 17, 32)' },
    recruiter: { light: 'rgb(251, 252, 255)', dark: 'rgb(7, 27, 30)' },
    admin: { light: 'rgb(248, 250, 252)', dark: 'rgb(11, 18, 32)' },
  };
  const shell = page.locator(`.${role}-shell`);
  for (const mode of ['light', 'dark']) {
    if (await shell.evaluate((element, selected) => element.classList.contains(selected), `${role}-${mode}`)) {
      await page.getByRole('button', { name: `Switch to ${mode === 'light' ? 'dark' : 'light'} mode` }).click();
    }
    await page.getByRole('button', { name: `Switch to ${mode} mode` }).click();
    await expect(shell).toHaveClass(new RegExp(`${role}-${mode}`));
    await expect(shell).toHaveCSS('background-color', backgrounds[role][mode]);
    expect(await page.evaluate((key) => localStorage.getItem(key), `devjobs.${role}.theme`)).toBe(mode);
    // Reload checks stored preference and actual rendered styles, not button text.
    await page.reload();
    await expect(shell).toHaveClass(new RegExp(`${role}-${mode}`));
    await expect(shell).toHaveCSS('background-color', backgrounds[role][mode]);
    for (const other of ['candidate', 'recruiter', 'admin'].filter((value) => value !== role)) {
      await expect(page.locator(`.${other}-shell`)).toHaveCount(0);
    }
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 960 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `/tmp/devjobs-redesign-screenshots/${run}/${role}-${mode}-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 960 });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
}

async function login(page, email, pass = password) {
  await page.goto(email === process.env.E2E_ADMIN_EMAIL ? '/admin/login' : '/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(pass);
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open user menu' })).toBeVisible();
}
async function register(page, role) {
  const email = `e2e-${role}-${run}@example.test`;
  await page.goto(`/register/${role}`);
  await expect(page.getByLabel('Full name')).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/devjobs-redesign-screenshots/${run}/register-${role}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByLabel('Full name').fill(`Synthetic ${role} ${run}`);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.locator('form').getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Registration complete. Log in to continue.')).toBeVisible();
  await login(page, email);
  return email;
}
async function auth(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('devjobs.auth'))); }
async function call(page, method, path, data) {
  const { access } = await auth(page);
  const response = await page.request[method](`${api}${path}`, { data, headers: { Authorization: `Bearer ${access}` } });
  expect(response.ok(), `${method} ${path}: ${response.status()}`).toBeTruthy();
  return response.status() === 204 ? null : response.json();
}

test('candidate, recruiter and administrator workflow with private access enforcement', async ({ browser }) => {
  test.setTimeout(120000);
  expect(run, 'Use backend/run_browser.py to enforce the dedicated database').toBeTruthy();
  const browserErrors = [];
  const developmentWarnings = [];
  const knownWarnings = new Set([
    'Warning: Instance created by `useForm` is not connected to any Form element. Forget to pass `form` prop?',
    "Warning: [antd: message] Static function can not consume context like dynamic theme. Please use 'App' component instead.",
  ]);
  function captureConsole(message) {
    if (message.type() !== 'error') return;
    if (knownWarnings.has(message.text())) developmentWarnings.push(message.text());
    else browserErrors.push(message.text().replace(/([?&]token=)[^&\s'"<>]+/g, '$1[redacted]'));
  }
  const candidateContext = await browser.newContext(); const candidate = await candidateContext.newPage();
  candidate.on('pageerror', (error) => browserErrors.push(error.message));
  candidate.on('console', captureConsole);
  await register(candidate, 'candidate');
  await expect(candidate.getByRole('heading', { name: 'Find Your Next Opportunity' })).toBeVisible();
  await inspectWorkspace(candidate, 'candidate');
  await candidate.goto('/candidate/profile');
  await candidate.getByLabel('professional headline').fill('Synthetic browser engineer');
  await candidate.getByRole('button', { name: 'Save profile' }).click();
  await expect(candidate.getByText('Changes saved')).toBeVisible();
  await candidate.getByLabel('Skill', { exact: true }).fill('Python');
  await candidate.getByRole('button', { name: 'Add skill' }).click();
  await expect(candidate.getByRole('button', { name: 'Remove python' })).toBeVisible();
  await candidate.reload();
  await expect(candidate.getByLabel('professional headline')).toHaveValue('Synthetic browser engineer');
  await candidate.goto('/recruiter');
  await expect(candidate).toHaveURL(/candidate/);
  await candidate.goto('/admin');
  await expect(candidate).toHaveURL('/');
  await candidate.goto('/candidate/resume');
  // A minimal valid single-page PDF, generated in memory without personal data.
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>'];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf); pdf += 'xref\n0 4\n0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Root 1 0 R /Size 4 >>\nstartxref\n${xref}\n%%EOF\n`;
  await candidate.locator('input[type=file]').setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) });
  await expect(candidate.getByRole('button', { name: 'Download resume' })).toBeVisible();

  const recruiterContext = await browser.newContext(); const recruiter = await recruiterContext.newPage();
  recruiter.on('pageerror', (error) => browserErrors.push(error.message));
  recruiter.on('console', captureConsole);
  await register(recruiter, 'recruiter');
  await inspectWorkspace(recruiter, 'recruiter');
  await recruiter.goto('/recruiter/profile');
  await recruiter.getByLabel('designation').fill('Synthetic hiring lead');
  await recruiter.getByRole('button', { name: 'Save profile' }).click();
  await expect(recruiter.getByText('Changes saved')).toBeVisible();
  await recruiter.goto('/candidate/profile');
  await expect(recruiter).toHaveURL(/recruiter/);
  await recruiter.goto('/recruiter/companies/new');
  await recruiter.getByLabel('name', { exact: true }).fill(`Synthetic Company ${run}`);
  await recruiter.getByRole('button', { name: 'Save company' }).click();
  await expect(recruiter.getByText('Active membership · OWNER')).toBeVisible();
  const companyId = recruiter.url().split('/').pop();
  const memberResponse = await recruiter.request.post(`${api}/auth/recruiter/register/`, { data: { name: 'Synthetic member', email: `e2e-member-${run}@example.test`, password } });
  expect(memberResponse.ok()).toBeTruthy(); const member = await memberResponse.json();
  await recruiter.getByLabel('Recruiter account ID').fill(member.id);
  await recruiter.getByRole('button', { name: 'Add membership' }).click();
  await expect(recruiter.getByText('Synthetic member · MEMBER · INVITED')).toBeVisible();
  await recruiter.getByRole('combobox', { name: 'Status for Synthetic member' }).click();
  await recruiter.getByText('ACTIVE', { exact: true }).last().click();
  await expect(recruiter.getByText('Synthetic member · MEMBER · ACTIVE')).toBeVisible();
  const memberContext = await browser.newContext(); const memberPage = await memberContext.newPage();
  memberPage.on('pageerror', (error) => browserErrors.push(error.message));
  memberPage.on('console', captureConsole);
  await login(memberPage, `e2e-member-${run}@example.test`);
  await memberPage.goto(`/recruiter/companies/${companyId}`);
  await expect(memberPage.getByLabel('name', { exact: true })).toBeDisabled();
  await expect(memberPage.getByRole('button', { name: 'Add membership' })).toHaveCount(0);
  await recruiter.goto(`/recruiter/jobs/new?company=${companyId}`);
  await recruiter.getByLabel('Job title').fill(`Synthetic Engineer ${run}`);
  await recruiter.getByLabel('Description', { exact: true }).fill('Synthetic browser test role');
  for (const [label, option] of [['employment type', 'FULL TIME'], ['workplace type', 'REMOTE'], ['experience level', 'MID']]) {
    await recruiter.getByLabel(label, { exact: true }).click();
    await recruiter.getByText(option, { exact: true }).last().click();
  }
  await recruiter.getByRole('button', { name: 'Create draft' }).click();
  await expect(recruiter).toHaveURL(/recruiter\/jobs\/[0-9a-f-]+\?/);
  const job = { id: new URL(recruiter.url()).pathname.split('/').pop(), title: `Synthetic Engineer ${run}` };
  await recruiter.goto(`/recruiter/jobs/${job.id}?company=${companyId}`);
  await call(recruiter, 'patch', `/jobs/${job.id}/`, { description: 'Synthetic edited browser test role' });
  await recruiter.getByRole('button', { name: 'Publish', exact: true }).click();
  await recruiter.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(recruiter.getByText('JOB PREVIEW · Published')).toBeVisible();
  await candidate.goto('/');
  await candidate.getByRole('textbox', { name: 'Search jobs' }).fill(run);
  await candidate.locator(`a[href="/jobs/${job.id}"]`).click();
  await candidate.getByRole('button', { name: 'Apply for this job' }).click();
  await candidate.getByLabel('Cover letter').fill('Synthetic application');
  await candidate.getByRole('button', { name: 'Submit application' }).click();
  await expect(candidate).toHaveURL(/candidate\/applications\/[0-9a-f-]+/);
  await candidate.goto('/candidate/applications');
  await expect(candidate.getByRole('heading', { name: 'My applications' })).toBeVisible();
  const applications = await call(recruiter, 'get', `/jobs/${job.id}/applications/`);
  const application = applications.results[0];
  const candidateAuth = await auth(candidate);
  const duplicate = await candidate.request.post(`${api}/jobs/${job.id}/applications/`, {
    data: { cover_letter: 'Synthetic duplicate' }, headers: { Authorization: `Bearer ${candidateAuth.access}` },
  });
  expect(duplicate.status()).toBe(400);
  const forbiddenAdmin = await candidate.request.get(`${api}/admin/overview/`, {
    headers: { Authorization: `Bearer ${candidateAuth.access}` },
  });
  expect(forbiddenAdmin.status()).toBe(403);
  const anonymousDenied = await candidate.request.get(`${api}/candidates/me/applications/`);
  expect(anonymousDenied.status()).toBe(401);
  const memberAuth = await auth(memberPage);
  const memberDenied = await memberPage.request.get(`${api}/jobs/${job.id}/applications/${application.id}/resume/`, { headers: { Authorization: `Bearer ${memberAuth.access}` } });
  expect(memberDenied.status()).toBe(403);
  const statusDenied = await memberPage.request.patch(`${api}/jobs/${job.id}/applications/${application.id}/status/`, {
    data: { status: 'REVIEWING' }, headers: { Authorization: `Bearer ${memberAuth.access}` },
  });
  expect(statusDenied.status()).toBe(403);
  await memberContext.close();
  await recruiter.goto(`/recruiter/jobs/${job.id}/applicants/${application.id}?company=${companyId}`);
  const download = recruiter.waitForEvent('download');
  await recruiter.getByRole('button', { name: 'Download resume' }).click();
  expect((await download).suggestedFilename()).toContain('.pdf');
  await recruiter.goto(`/recruiter/jobs/${job.id}/applicants?company=${companyId}`);
  await recruiter.getByRole('combobox', { name: /Update status for/ }).click();
  await recruiter.getByText('REVIEWING', { exact: true }).last().click();
  await expect(recruiter.locator('.ant-tag').filter({ hasText: /^REVIEWING$/ })).toBeVisible();
  await candidate.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await candidate.getByRole('button', { name: 'Withdraw', exact: true }).last().click();
  await expect(candidate.getByText('Withdrawn', { exact: true })).toBeVisible();
  const { access } = await auth(recruiter);
  const denied = await recruiter.request.get(`${api}/jobs/${job.id}/applications/${application.id}/resume/`, { headers: { Authorization: `Bearer ${access}` } });
  expect([403, 404]).toContain(denied.status());

  await call(recruiter, 'post', `/jobs/${job.id}/close/`);

  const adminContext = await browser.newContext(); const admin = await adminContext.newPage();
  admin.on('pageerror', (error) => browserErrors.push(error.message));
  admin.on('console', captureConsole);
  await login(admin, process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
  await expect(admin.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await inspectWorkspace(admin, 'admin');
  // Exercise every supported mutable moderation resource, including reversal.
  for (const [resource, search] of [
    ['candidates', `e2e-candidate-${run}@example.test`],
    ['recruiters', `e2e-member-${run}@example.test`],
    ['jobs', job.title],
  ]) {
    await admin.goto(`/admin?section=${resource}`);
    await admin.getByLabel('Search moderation records').fill(search);
    await admin.getByLabel('Search moderation records').press('Enter');
    const row = admin.getByRole('row').filter({ hasText: resource === 'jobs' ? job.title : resource === 'candidates' ? `Synthetic candidate ${run}` : 'Synthetic member' });
    await row.getByRole('button', { name: 'Inspect', exact: true }).click();
    await expect(admin.getByRole('dialog', { name: 'Record details' })).toBeVisible();
    await admin.getByRole('dialog', { name: 'Record details' }).locator('.ant-modal-footer').getByRole('button', { name: 'Close', exact: true }).click();
    for (const restricted of [true, false]) {
      await row.getByRole('button', { name: 'Moderate', exact: true }).click();
      await expect(admin.getByRole('button', { name: 'OK', exact: true })).toBeDisabled();
      await admin.getByRole('textbox', { name: 'Moderation reason' }).fill('Synthetic reversible moderation');
      await admin.getByRole('button', { name: 'OK', exact: true }).click();
      await expect(row.getByText(restricted ? 'Restricted' : resource === 'jobs' ? 'CLOSED' : 'Active', { exact: true })).toBeVisible();
    }
  }
  await admin.goto('/admin?section=companies');
  await admin.getByLabel('Search moderation records').fill(`Synthetic Company ${run}`);
  await admin.getByLabel('Search moderation records').press('Enter');
  await admin.getByRole('row').filter({ hasText: `Synthetic Company ${run}` }).getByRole('button', { name: 'Moderate', exact: true }).click();
  await admin.getByRole('textbox', { name: 'Moderation reason' }).fill('Synthetic browser suspension');
  await admin.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(admin.getByRole('row').filter({ hasText: `Synthetic Company ${run}` }).getByText('Restricted', { exact: true })).toBeVisible();
  for (const resource of ['companies', 'recruiters', 'candidates', 'jobs', 'history']) {
    const listing = await call(admin, 'get', `/admin/${resource}/`);
    expect(Array.isArray(listing.results)).toBe(true);
  }
  const blocked = await recruiter.request.post(`${api}/jobs/${job.id}/publish/`, { headers: { Authorization: `Bearer ${access}` } });
  expect(blocked.status()).toBe(403);
  await candidate.goto('/candidate/resume');
  const candidateDownload = candidate.waitForEvent('download');
  await candidate.getByRole('button', { name: 'Download resume' }).click();
  expect((await candidateDownload).suggestedFilename()).toContain('.pdf');
  await candidate.getByRole('button', { name: 'Remove resume', exact: true }).click();
  await candidate.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(candidate.getByRole('status')).toHaveText('No resume uploaded.');
  await candidate.getByRole('button', { name: 'Open user menu' }).click();
  await candidate.getByRole('menuitem', { name: /Log out/i }).click();
  await candidate.reload();
  await expect(candidate).toHaveURL(/login/);
  expect(await candidate.evaluate(() => localStorage.getItem('devjobs.auth'))).toBeNull();
  console.log(`Existing Ant Design development warnings: ${developmentWarnings.length}; browser errors: ${browserErrors.length}`);
  expect(browserErrors).toEqual([]);
  await candidateContext.close(); await recruiterContext.close(); await adminContext.close();
});
