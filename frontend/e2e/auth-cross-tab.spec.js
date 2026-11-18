import { test, expect } from '@playwright/test';

const api = `${process.env.E2E_BACKEND_URL}/api/v1`;
const password = process.env.E2E_FIXTURE_PASSWORD;
const run = process.env.E2E_RUN_ID;
const record = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('devjobs.auth.v2')));
async function install(page, credentials) {
  await page.evaluate(async (credentials) => {
    const { writeAuth } = await import('/src/features/auth/api.js');
    await writeAuth(credentials);
  }, credentials);
}
async function privateRequest(page) {
  return page.evaluate(async () => {
    const { http } = await import('/src/features/auth/api.js');
    try { await http.get('/recruiters/me/profile/'); return { ok: true }; }
    catch (error) { return { ok: false, code: error.code, expired: error.sessionExpired }; }
  });
}

test('native shared-storage tabs reject a mounted stale editor before its storage notification', async ({ browser }) => {
  test.setTimeout(120000);
  expect(run).toBeTruthy();
  const context = await browser.newContext();
  try {
    const a = await context.newPage();
    // Capture native events before the application's listener. No fake lock or
    // fake storage is used. Release re-delivers notifications to the real store.
    await a.addInitScript(() => {
      window.auditHold = false;
      window.auditEvents = [];
      window.addEventListener('storage', (event) => {
        if (window.auditHold && event.key === 'devjobs.auth.v2') {
          window.auditEvents.push(event);
          event.stopImmediatePropagation();
        }
      }, true);
      window.auditRelease = () => {
        window.auditHold = false;
        for (const event of window.auditEvents.splice(0)) window.dispatchEvent(new StorageEvent('storage', {
          key: event.key, oldValue: event.oldValue, newValue: event.newValue, storageArea: localStorage,
        }));
      };
    });
    await a.goto('/login');
    const accounts = [];
    for (const suffix of ['a', 'b']) {
      const email = `gate1-${suffix}-${run}@example.test`;
      const registration = await context.request.post(`${api}/auth/recruiter/register/`, { data: { email, password, name: `Gate one ${suffix}` } });
      expect(registration.ok()).toBeTruthy();
      const login = await context.request.post(`${api}/auth/login/`, { data: { email, password } });
      expect(login.ok()).toBeTruthy();
      accounts.push(await login.json());
    }
    const [authA, authB] = accounts;
    async function post(path, data) {
      const response = await context.request.post(`${api}${path}`, { data, headers: { Authorization: `Bearer ${authA.access}` } });
      expect(response.ok()).toBeTruthy();
      return response.json();
    }
    const { company } = await post('/companies/', { name: `Gate one ${run}` });
    // Both accounts can edit the same object: server permission denial must not
    // conceal a browser credential/payload mismatch.
    await post(`/companies/${company.id}/members/`, { recruiter_id: authB.user.id, role: 'ADMIN', status: 'ACTIVE' });
    const job = await post('/jobs/', { company_id: company.id, title: 'Gate one original', description: 'Synthetic audit role', employment_type: 'FULL_TIME', workplace_type: 'REMOTE', experience_level: 'MID' });
    await install(a, authA);
    const editor = `/recruiter/jobs/${job.id}/edit?company=${company.id}`;
    await a.goto(editor);
    await expect(a.getByLabel('Job title')).toHaveValue(job.title);
    const mutations = [];
    a.on('request', (request) => {
      if (request.method() === 'PATCH' && request.url() === `${api}/jobs/${job.id}/`) mutations.push({ token: request.headers().authorization, payload: request.postDataJSON() });
    });
    // Positive control captures the real browser transport, including JSON.
    await a.getByLabel('Job title').fill('A positive control');
    await a.getByRole('button', { name: 'Save changes' }).click();
    await expect(a).toHaveURL(new RegExp(`/recruiter/jobs/${job.id}\\?`));
    expect(mutations).toHaveLength(1);
    expect(mutations[0].token === `Bearer ${authA.access}`).toBe(true);
    expect(mutations[0].payload.title).toBe('A positive control');
    await a.goto(editor);
    await a.getByLabel('Job title').fill('A private unsaved draft');
    const b = await context.newPage();
    await b.goto('/recruiter');
    await expect(b.getByRole('button', { name: 'Open user menu' })).toBeVisible();
    await a.evaluate(() => { window.auditHold = true; });
    await install(b, authB);
    await expect.poll(() => a.evaluate(() => window.auditEvents.length)).toBeGreaterThan(0);
    expect((await record(a)).credentials.user.id === authB.user.id).toBe(true);
    await expect(a.getByLabel('Job title')).toHaveValue('A private unsaved draft');
    await a.getByRole('button', { name: 'Save changes' }).click();
    await expect(a.getByRole('alert')).toBeVisible();
    expect(mutations).toHaveLength(1);
    expect(mutations.some((item) => item.token === `Bearer ${authB.access}` && item.payload.title === 'A private unsaved draft')).toBe(false);
    await a.evaluate(() => window.auditRelease());
    await expect(a.getByLabel('Job title')).toHaveValue('A positive control');
    // B remains usable and may save its own draft.
    await b.goto(editor);
    await b.getByLabel('Job title').fill('B own draft');
    const saved = b.waitForResponse((response) => response.url() === `${api}/jobs/${job.id}/` && response.request().method() === 'PATCH');
    await b.getByRole('button', { name: 'Save changes' }).click();
    const response = await saved;
    expect(response.ok()).toBeTruthy();
    expect(response.request().headers().authorization === `Bearer ${authB.access}`).toBe(true);
    expect(response.request().postDataJSON().title).toBe('B own draft');
    await a.goto(editor);
    await a.getByLabel('Job title').fill('same session draft');
    const epoch = (await record(a)).epoch;
    // Force a real refresh through an invalid access token, retaining ownership.
    await b.evaluate(async () => {
      const { sessionStore } = await import('/src/features/auth/api.js');
      const current = sessionStore.read();
      await sessionStore.refresh(sessionStore.permit(current), current.revision, { access: 'synthetic-expired' });
    });
    expect(await privateRequest(b)).toEqual({ ok: true });
    expect((await record(a)).epoch).toBe(epoch);
    await expect(a.getByLabel('Job title')).toHaveValue('same session draft');
    // Force each document to win, with both late-success and late-failure
    // continuations. Both HTTP requests must arrive before either is released.
    for (const winner of [a, b]) {
      for (const lateFailure of [false, true]) {
        await b.evaluate(async () => {
          const { sessionStore } = await import('/src/features/auth/api.js');
          const current = sessionStore.read();
          await sessionStore.refresh(sessionStore.permit(current), current.revision, { access: 'synthetic-expired-concurrent' });
        });
        const beforeConcurrent = await record(a);
        let arrivals = 0;
        let releaseRefreshes;
        const bothDispatched = new Promise((resolve) => { releaseRefreshes = resolve; });
        const refreshRoute = async (route) => {
          expect(route.request().postDataJSON().refresh === beforeConcurrent.credentials.refresh).toBe(true);
          arrivals += 1;
          if (arrivals === 2) releaseRefreshes();
          await bothDispatched;
          if (route.request().frame().page() === winner) {
            const response = await route.fetch();
            expect(response.ok()).toBe(true);
            await route.fulfill({ response });
          } else {
            await expect.poll(async () => (await record(a)).revision).toBe(beforeConcurrent.revision + 1);
            if (lateFailure) await route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Synthetic late refresh failure"}' });
            else { const response = await route.fetch(); await route.fulfill({ response }); }
          }
        };
        await context.route(`${api}/auth/token/refresh/`, refreshRoute);
        const concurrent = await Promise.all([privateRequest(a), privateRequest(b)]);
        await context.unroute(`${api}/auth/token/refresh/`, refreshRoute);
        expect(arrivals).toBe(2);
        expect(concurrent[winner === a ? 0 : 1]).toEqual({ ok: true });
        expect(concurrent[winner === a ? 1 : 0]).toEqual({ ok: false, code: 'ERR_CANCELED', expired: true });
        const afterConcurrent = await record(a);
        expect(afterConcurrent.epoch).toBe(beforeConcurrent.epoch);
        expect(afterConcurrent.revision).toBe(beforeConcurrent.revision + 1);
        expect(afterConcurrent.credentials.user.id === authB.user.id).toBe(true);
        expect(await privateRequest(a)).toEqual({ ok: true });
        expect(await privateRequest(b)).toEqual({ ok: true });
        await expect(a.getByLabel('Job title')).toHaveValue('same session draft');
      }
    }
    // Same-user replacement creates a new epoch and discards private state.
    await install(b, authB);
    await expect(a.getByLabel('Job title')).toHaveValue('B own draft');
    expect((await record(a)).epoch === epoch).toBe(false);
    await b.evaluate(async () => { const { writeAuth } = await import('/src/features/auth/api.js'); await writeAuth(null); });
    await expect(a.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
    await expect(b.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
    const loggedOutEpoch = (await record(a)).epoch;
    await install(b, authB);
    await a.goto(editor);
    await expect(a.getByLabel('Job title')).toHaveValue('B own draft');
    expect((await record(a)).epoch === loggedOutEpoch).toBe(false);
    // Runtime unsupported-lock check with a real persisted canonical session.
    await b.evaluate(() => Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }));
    const unsupported = await privateRequest(b);
    expect(unsupported).toEqual({ ok: false, code: 'ERR_CANCELED', expired: true });
    console.log('Gate 1: native event-held stale editor, actual header/payload controls, replacement/remount, B mutation, refresh continuity, concurrent refresh winner/loser recovery, identical-user replacement, logout/re-login and unavailable locks PASS');
  } finally { await context.close(); }
});
