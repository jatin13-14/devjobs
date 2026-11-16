import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { http, writeAuth } from '../auth/api.js';
import { useCompanyMembership } from './useCompanyMembership.js';

let current;
const original = http.defaults.adapter;
function Harness() { current = useCompanyMembership('company-A'); return <p>{current.status} {current.canManage ? 'manage' : 'denied'}</p>; }
afterEach(() => { cleanup(); http.defaults.adapter = original; localStorage.clear(); vi.restoreAllMocks(); });
async function setup() {
  await writeAuth({ access: 'A-access', refresh: 'A-refresh', user: { id: 'A', role: 'recruiter' } });
  const requests = [];
  let membership = { id: 'company-A', role: 'OWNER' };
  http.defaults.adapter = async (config) => {
    requests.push(config);
    return { config, status: 200, headers: {}, data: { count: membership ? 1 : 0, results: membership ? [membership] : [] } };
  };
  const view = render(<AuthProvider><Harness /></AuthProvider>);
  await waitFor(() => expect(current.canManage).toBe(true));
  return { view, requests, change: (value) => { membership = value; } };
}
for (const role of ['ADMIN', 'MEMBER', null]) {
  it(`revokes known denial before revalidation and rejects retained callbacks after ${role || 'removal or suspension'}`, async () => {
    const { requests, change } = await setup();
    const old = current;
    let release;
    const denied = { response: { status: 403, data: { detail: 'Forbidden' } } };
    let outcome;
    await act(async () => { outcome = old.execute(() => new Promise((resolve, reject) => { release = () => reject(denied); })).catch((error) => error); });
    change(role ? { id: 'company-A', role } : null);
    await act(async () => { release(); await outcome; });
    await waitFor(() => expect(current.status).toBe(role ? 'success' : 'empty'));
    expect(current.canManage).toBe(role === 'ADMIN');
    expect(requests).toHaveLength(2);
    const operation = vi.fn();
    await expect(old.execute(operation)).rejects.toThrow('Company permissions changed');
    expect(operation).not.toHaveBeenCalled();
  });
}
it('rechecks external permission changes within the visible one-minute policy', async () => {
  let tick;
  const interval = globalThis.setInterval;
  vi.spyOn(globalThis, 'setInterval').mockImplementation((callback, delay, ...args) => { if (delay === 60_000) { tick = callback; return 123; } return interval(callback, delay, ...args); });
  const { change, requests } = await setup();
  const old = current;
  change({ id: 'company-A', role: 'MEMBER' });
  const clock = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(clock + 60_000);
  await act(async () => { tick(); });
  await waitFor(() => expect(current.canManage).toBe(false));
  expect(requests).toHaveLength(2);
  await expect(old.execute(vi.fn())).rejects.toThrow();
});
it('does not loop when a management endpoint denies despite an active membership', async () => {
  const { requests } = await setup();
  const reject = () => Promise.reject({ response: { status: 403 } });
  await act(async () => { await current.execute(reject).catch(() => {}); });
  await waitFor(() => expect(current.canManage).toBe(true));
  await act(async () => { await current.execute(reject).catch(() => {}); });
  expect(current.status).toBe('error');
  expect(current.canManage).toBe(false);
  expect(requests).toHaveLength(2);
});

it('rejects a queued real Axios mutation after membership refresh invalidates its permit', async () => {
  const { requests } = await setup();
  let release, queued;
  const interceptor = http.interceptors.request.use(async (config) => {
    if (config.method === 'patch') { queued = config; await new Promise((resolve) => { release = resolve; }); }
    return config;
  });
  try {
    let outcome;
    await act(async () => { outcome = current.execute((config) => http.patch('/management/', {}, config)).catch((error) => error); });
    await waitFor(() => expect(queued).toBeDefined());
    await act(async () => { current.retry(); });
    await act(async () => { release(); await outcome; });
    expect(requests.filter((config) => config.method === 'patch')).toHaveLength(0);
  } finally { release?.(); http.interceptors.request.eject(interceptor); }
});
