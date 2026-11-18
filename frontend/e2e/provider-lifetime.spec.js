import { test, expect } from '@playwright/test';

test('Strict Mode provider callbacks and queued protected transport lose authority on unmount', async ({ page }) => {
  const forbidden = [];
  page.on('request', (request) => {
    if (request.url().includes('/lifetime-forbidden/') || request.url().includes('/auth/login/')) forbidden.push(request.method());
  });
  await page.route('**/provider-lifetime-harness', (route) => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true; const { mount } = await import("/e2e/fixtures/provider-lifetime.jsx"); mount();</script>' }));
  await page.goto('/provider-lifetime-harness');
  await expect(page.getByText('anonymous')).toBeVisible();
  const result = await page.evaluate(async () => {
    const { writeAuth, sessionStore, http } = await import('/src/features/auth/api.js');
    const credentials = (id) => ({ access: `${id}-synthetic`, refresh: `${id}-synthetic-refresh`, user: { id, role: 'recruiter' } });
    await writeAuth(credentials('a'));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const obsolete = window.lifetimeContext;
    const epoch = sessionStore.read().epoch;
    // Queue a real Axios request behind a native exclusive lock.
    let release;
    let entered;
    const ready = new Promise((resolve) => { entered = resolve; });
    const held = navigator.locks.request('devjobs.auth.v2', async () => { entered(); await new Promise((resolve) => { release = resolve; }); });
    await ready;
    const pending = http.patch('/lifetime-forbidden/', { title: 'a draft' }).catch((error) => ({ code: error.code }));
    window.unmountLifetime();
    release();
    await held;
    const request = await pending;
    const canceled = async (work) => { try { await work(); return false; } catch (error) { return error.code === 'ERR_CANCELED' && error.sessionExpired; } };
    const login = await canceled(() => obsolete.login({ email: 'synthetic@example.test', password: 'synthetic' }));
    const logout = await canceled(() => obsolete.logout());
    const unchanged = sessionStore.read().epoch === epoch;
    await writeAuth(credentials('b'));
    const { mount } = await import('/e2e/fixtures/provider-lifetime.jsx');
    mount();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const afterRemount = await canceled(() => obsolete.login({ email: 'synthetic@example.test', password: 'synthetic' }));
    return { request, login, logout, unchanged, afterRemount, current: sessionStore.read().credentials.user.id };
  });
  expect(result).toEqual({ request: { code: 'ERR_CANCELED' }, login: true, logout: true, unchanged: true, afterRemount: true, current: 'b' });
  await expect(page.getByText('b', { exact: true })).toBeVisible();
  expect(forbidden).toEqual([]);
});
