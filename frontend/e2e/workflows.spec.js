import { test, expect } from '@playwright/test';

const api = 'http://127.0.0.1:8011/api/v1';
const password = 'Synthetic-browser-pass-781!';
const run = process.env.E2E_RUN_ID;
async function login(page, email, pass = password) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(pass);
  await page.locator('form').getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
}
async function register(page, role) {
  const email = `e2e-${role}-${run}@example.test`;
  await page.goto(`/register/${role}`);
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
  expect(run, 'Use backend/run_browser.py to enforce the dedicated database').toBeTruthy();
  const candidateContext = await browser.newContext(); const candidate = await candidateContext.newPage();
  await register(candidate, 'candidate');
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
  await register(recruiter, 'recruiter');
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
  const memberAuth = await auth(memberPage);
  const memberDenied = await memberPage.request.get(`${api}/jobs/${job.id}/applications/${application.id}/resume/`, { headers: { Authorization: `Bearer ${memberAuth.access}` } });
  expect(memberDenied.status()).toBe(403);
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

  const adminContext = await browser.newContext(); const admin = await adminContext.newPage();
  await login(admin, process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD);
  await expect(admin.getByRole('heading', { name: 'Platform administration' })).toBeVisible();
  await admin.getByLabel('Search moderation records').fill(`Synthetic Company ${run}`);
  await admin.getByLabel('Search moderation records').press('Enter');
  await admin.getByRole('row').filter({ hasText: `Synthetic Company ${run}` }).getByRole('button', { name: 'Moderate', exact: true }).click();
  await admin.getByRole('textbox', { name: 'Moderation reason' }).fill('Synthetic browser suspension');
  await admin.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(admin.getByRole('row').filter({ hasText: `Synthetic Company ${run}` }).getByText('Restricted', { exact: true })).toBeVisible();
  const blocked = await recruiter.request.post(`${api}/jobs/${job.id}/publish/`, { headers: { Authorization: `Bearer ${access}` } });
  expect(blocked.status()).toBe(403);
  await candidate.getByRole('button', { name: 'Log out' }).click();
  await candidate.reload();
  await expect(candidate).toHaveURL(/login/);
  expect(await candidate.evaluate(() => localStorage.getItem('devjobs.auth'))).toBeNull();
  await candidateContext.close(); await recruiterContext.close(); await adminContext.close();
});
