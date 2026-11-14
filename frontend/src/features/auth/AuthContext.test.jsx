import axios from 'axios';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from './AuthPages.jsx';
import { createSessionStore, sessionStorageKey } from './sessionStore.js';
import { StrictMode, useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthContext.jsx';
import { useAuth } from './useAuth.js';
import { authApi, http, plainHttp, readAuth, writeAuth } from './api.js';

const adapter = http.defaults.adapter;
let context;
function SessionProbe() {
  context = useAuth();
  return <p>{context.user?.id || 'signed out'}</p>;
}
afterEach(() => {
  cleanup();
  http.defaults.adapter = adapter;
  plainHttp.defaults.adapter = adapter;
  vi.restoreAllMocks();
  window.localStorage.clear();
});

it('does not persist a completed login after logout at the provider continuation boundary', async () => {
  await writeAuth(null);
  const credentials = { access: 'synthetic-a-access', refresh: 'synthetic-a-refresh', user: { id: 'synthetic-a', role: 'recruiter' } };
  const attempts = [];
  http.defaults.adapter = async (config) => {
    attempts.push({ url: config.url, data: config.data });
    return { config, status: 200, statusText: 'OK', headers: {}, data: credentials };
  };
  const realLogin = authApi.login;
  vi.spyOn(authApi, 'login').mockImplementation((values) => {
    const completed = realLogin(values);
    // Runs after real Axios validation, before the provider's await continuation.
    completed.then(() => context.logout());
    return completed;
  });
  render(<AuthProvider><SessionProbe /></AuthProvider>);
  await act(async () => {
    await context.login({ email: 'synthetic-a@example.test', password: 'synthetic-password' }).catch(() => {});
  });
  expect(attempts).toEqual([{ url: '/auth/login/', data: JSON.stringify({ email: 'synthetic-a@example.test', password: 'synthetic-password' }) }]);
  expect(readAuth()).toBeNull();
  expect(screen.getByText('signed out')).toBeInTheDocument();
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const credentialsFor = (id) => ({ access: `${id}-access`, refresh: `${id}-refresh`, user: { id, role: 'recruiter' } });
async function controlledProvider() {
  await writeAuth(null);
  const requests = [];
  http.defaults.adapter = (config) => {
    const release = deferred();
    requests.push({ config, ...release });
    return release.promise.then((data) => ({ config, status: 200, statusText: 'OK', headers: {}, data }));
  };
  const view = render(<StrictMode><AuthProvider><SessionProbe /></AuthProvider></StrictMode>);
  return { requests, ...view };
}
function startLogin(id, navigate = () => {}) {
  let result;
  act(() => { result = context.login({ email: `${id}@example.test`, password: 'synthetic' }).then((user) => { navigate(user); return user; }, (error) => error); });
  return result;
}
function expectSession(id) {
  expect(readAuth()).toEqual(id ? credentialsFor(id) : null);
  expect(screen.getByText(id || 'signed out')).toBeInTheDocument();
}

it('rejects a pending login after logout without authenticated navigation', async () => {
  const { requests } = await controlledProvider();
  const navigate = vi.fn();
  const result = startLogin('a', navigate);
  await waitFor(() => expect(requests).toHaveLength(1));
  await act(async () => { await context.logout(); });
  await act(async () => { requests[0].resolve(credentialsFor('a')); await result; });
  expect(await result).toMatchObject({ code: 'ERR_CANCELED', sessionExpired: true });
  expectSession(null);
  expect(navigate).not.toHaveBeenCalled();
});

it.each(['success', 'failure'])('keeps newer login B when obsolete A finishes with %s', async (outcome) => {
  const { requests } = await controlledProvider();
  const navigate = vi.fn();
  const a = startLogin('a', navigate);
  await waitFor(() => expect(requests).toHaveLength(1));
  const b = startLogin('b');
  await waitFor(() => expect(requests).toHaveLength(2));
  await act(async () => { requests[1].resolve(credentialsFor('b')); await b; });
  expectSession('b');
  await act(async () => {
    if (outcome === 'success') requests[0].resolve(credentialsFor('a'));
    else requests[0].reject(new Error('obsolete failure'));
    await a;
  });
  expect(await a).toMatchObject({ code: 'ERR_CANCELED', sessionExpired: true });
  expectSession('b');
  expect(navigate).not.toHaveBeenCalled();
});

it('supersedes concurrent attempts before any session commits', async () => {
  const { requests } = await controlledProvider();
  const a = startLogin('a');
  await waitFor(() => expect(requests).toHaveLength(1));
  const b = startLogin('b');
  await waitFor(() => expect(requests).toHaveLength(2));
  const c = startLogin('c');
  await waitFor(() => expect(requests).toHaveLength(3));
  await act(async () => { requests[0].resolve(credentialsFor('a')); requests[1].reject(new Error('old')); await Promise.all([a, b]); });
  expectSession(null);
  expect(await a).toMatchObject({ code: 'ERR_CANCELED' });
  expect(await b).toMatchObject({ code: 'ERR_CANCELED' });
  await act(async () => { requests[2].resolve(credentialsFor('c')); await c; });
  expectSession('c');
});

it('distinguishes logout and re-login as the same user', async () => {
  const { requests } = await controlledProvider();
  const old = startLogin('a');
  await waitFor(() => expect(requests).toHaveLength(1));
  await act(async () => { await context.logout(); });
  const current = startLogin('a');
  await waitFor(() => expect(requests).toHaveLength(2));
  await act(async () => { requests[1].resolve(credentialsFor('a')); await current; });
  const marker = localStorage.getItem(sessionStorageKey);
  await act(async () => { requests[0].resolve(credentialsFor('a')); await old; });
  expect(await old).toMatchObject({ code: 'ERR_CANCELED' });
  expect(localStorage.getItem(sessionStorageKey)).toBe(marker);
  expectSession('a');
});

it('preserves an established session on current login failure', async () => {
  const { requests } = await controlledProvider();
  const a = startLogin('a');
  await waitFor(() => expect(requests).toHaveLength(1));
  await act(async () => { requests[0].resolve(credentialsFor('a')); await a; });
  const b = startLogin('b');
  await waitFor(() => expect(requests).toHaveLength(2));
  const failure = new Error('invalid credentials');
  await act(async () => { requests[1].reject(failure); await b; });
  expect(await b).toBe(failure);
  expectSession('a');
});

it('invalidates pending operations on provider unmount and remount', async () => {
  const { requests, unmount } = await controlledProvider();
  const navigate = vi.fn();
  const old = startLogin('a', navigate);
  await waitFor(() => expect(requests).toHaveLength(1));
  unmount();
  render(<StrictMode><AuthProvider><SessionProbe /></AuthProvider></StrictMode>);
  await act(async () => { requests[0].resolve(credentialsFor('a')); await old; });
  expect(await old).toMatchObject({ code: 'ERR_CANCELED' });
  expectSession(null);
  expect(navigate).not.toHaveBeenCalled();
});

it('rejects a retained login callback invoked after its provider remounts as another account', async () => {
  await writeAuth(credentialsFor('a'));
  const requests = [];
  http.defaults.adapter = async (config) => {
    requests.push({ url: config.url, data: JSON.parse(config.data), authorization: config.headers.Authorization });
    return { config, status: 200, headers: {}, data: credentialsFor('a') };
  };
  render(<AuthProvider><SessionProbe /></AuthProvider>);
  const obsoleteLogin = context.login;
  await act(async () => { await writeAuth(credentialsFor('b')); });
  expectSession('b');
  expect(context.login).not.toBe(obsoleteLogin);
  const canonicalB = localStorage.getItem(sessionStorageKey);
  let result;
  // Invoke only after B is committed and rendered. This is distinct from a
  // pending A login finishing after unmount: no A operation existed at cleanup.
  await act(async () => {
    result = await obsoleteLogin({ email: 'a@example.test', password: 'synthetic' }).catch((error) => error);
  });
  expect.soft(result).toMatchObject({ code: 'ERR_CANCELED', sessionExpired: true });
  expect.soft(requests).toEqual([]);
  expect.soft(localStorage.getItem(sessionStorageKey)).toBe(canonicalB);
  expect.soft(readAuth()).toEqual(credentialsFor('b'));
  expect.soft(screen.queryByText('b')).toBeInTheDocument();
});

it('rejects validated A at the commit boundary when B starts', async () => {
  const { requests } = await controlledProvider();
  const realLogin = authApi.login;
  let b;
  vi.spyOn(authApi, 'login').mockImplementation((values) => {
    const completed = realLogin(values);
    if (values.email.startsWith('a@')) completed.then(() => { b = startLogin('b'); });
    return completed;
  });
  const a = startLogin('a');
  await waitFor(() => expect(requests).toHaveLength(1));
  await act(async () => { requests[0].resolve(credentialsFor('a')); await a; });
  expect(await a).toMatchObject({ code: 'ERR_CANCELED' });
  expectSession(null);
  await waitFor(() => expect(requests).toHaveLength(2));
  await act(async () => { requests[1].resolve(credentialsFor('b')); await b; });
  expectSession('b');
});

it('allows same-session refresh and requests while a replacement login is pending', async () => {
  await writeAuth(credentialsFor('a'));
  render(<StrictMode><AuthProvider><SessionProbe /></AuthProvider></StrictMode>);
  const release = deferred();
  const started = deferred();
  http.defaults.adapter = async (config) => {
    if (config.url === '/auth/login/') { started.resolve(); return { config, status: 200, headers: {}, data: await release.promise }; }
    if (config.headers.Authorization === 'Bearer a-access') {
      throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401 });
    }
    expect(config.headers.Authorization).toBe('Bearer refreshed-access');
    return { config, status: 200, headers: {}, data: {} };
  };
  plainHttp.defaults.adapter = async (config) => ({ config, status: 200, headers: {}, data: { access: 'refreshed-access' } });
  const b = startLogin('b');
  await started.promise;
  await act(async () => { await http.get('/protected/'); });
  expect(readAuth()).toEqual({ ...credentialsFor('a'), access: 'refreshed-access' });
  expect(screen.getByText('a')).toBeInTheDocument();
  await act(async () => { release.resolve(credentialsFor('b')); await b; });
  expectSession('b');
});

it('keeps the real login page from navigating after logout at the continuation boundary', async () => {
  await writeAuth(null);
  http.defaults.adapter = async (config) => ({ config, status: 200, headers: {}, data: credentialsFor('a') });
  const realLogin = authApi.login;
  vi.spyOn(authApi, 'login').mockImplementation((values) => {
    const completed = realLogin(values);
    completed.then(() => context.logout());
    return completed;
  });
  render(<AuthProvider><SessionProbe /><MemoryRouter initialEntries={['/login']}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/recruiter" element={<p>Authenticated destination</p>} />
  </Routes></MemoryRouter></AuthProvider>);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email address'), 'a@example.test');
  await user.type(screen.getByLabelText('Password'), 'synthetic-password');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  await screen.findByRole('alert');
  expectSession(null);
  expect(screen.queryByText('Authenticated destination')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
});

it('does not submit the previous rendered identity payload with another tab\'s credentials', async () => {
  await writeAuth(credentialsFor('a'));
  const attempts = [];
  let submission;
  function IdentityOwnedEditor() {
    const { user } = useAuth();
    return <button onClick={() => {
      submission = http.patch('/jobs/synthetic-shared-job/', { title: `${user.id} private draft` }).catch((error) => error);
    }}>Save draft for {user.id}</button>;
  }
  http.defaults.adapter = async (config) => {
    attempts.push({ authorization: config.headers.Authorization, data: JSON.parse(config.data) });
    return { config, status: 200, headers: {}, data: {} };
  };
  render(<AuthProvider><SessionProbe /><IdentityOwnedEditor /></AuthProvider>);
  // Prove the real adapter captures this mounted editor's headers and payload.
  await userEvent.setup().click(screen.getByRole('button', { name: 'Save draft for a' }));
  await submission;
  expect(attempts).toEqual([{ authorization: 'Bearer a-access', data: { title: 'a private draft' } }]);
  // A second document has its own operation state, sharing only storage and
  // the browser's serialization primitive. Its event has not reached Tab 1 yet.
  const external = createSessionStore({ storage: localStorage, locks: navigator.locks,
    events: new EventTarget(), randomUUID: () => crypto.randomUUID() });
  const attempt = await external.beginLogin();
  await external.commitLogin(attempt, credentialsFor('b'));
  expect(screen.getByRole('button', { name: 'Save draft for a' })).toBeInTheDocument();
  expect(readAuth()).toEqual(credentialsFor('b'));
  // Click the currently rendered editor, rather than an artificially retained callback.
  await userEvent.setup().click(screen.getByRole('button', { name: /Save draft for/ }));
  // The stale mounted editor must be rejected before transport.
  expect(await submission).toMatchObject({ code: 'ERR_CANCELED', sessionExpired: true });
  expect(attempts).toHaveLength(1);
  expect(attempts).toEqual([{ authorization: 'Bearer a-access', data: { title: 'a private draft' } }]);
  expect(attempts).not.toContainEqual({
    authorization: 'Bearer b-access', data: { title: 'a private draft' },
  });
});

it('does not authenticate or replace canonical ownership through legacy split-storage writes', async () => {
  const attempts = [];
  http.defaults.adapter = async (config) => {
    attempts.push({ authorization: config.headers.Authorization, data: config.data });
    return { config, status: 200, headers: {}, data: {} };
  };
  localStorage.setItem('devjobs.auth.session', 'legacy-session');
  localStorage.setItem('devjobs.auth', JSON.stringify(credentialsFor('b')));
  expect(readAuth()).toBeNull();
  render(<AuthProvider><SessionProbe /></AuthProvider>);
  expectSession(null);
  await http.patch('/private/', { title: 'anonymous draft' });
  expect(attempts).toEqual([{ authorization: undefined, data: '{"title":"anonymous draft"}' }]);
  cleanup();
  await writeAuth(credentialsFor('a'));
  render(<AuthProvider><SessionProbe /></AuthProvider>);
  const canonical = localStorage.getItem(sessionStorageKey);
  act(() => {
    localStorage.setItem('devjobs.auth.session', 'legacy-replacement');
    localStorage.setItem('devjobs.auth', JSON.stringify(credentialsFor('b')));
    window.dispatchEvent(new StorageEvent('storage', { key: 'devjobs.auth', storageArea: localStorage }));
  });
  expectSession('a');
  expect(localStorage.getItem(sessionStorageKey)).toBe(canonical);
  await http.patch('/private/', { title: 'a private draft' });
  expect(attempts[1]).toEqual({ authorization: 'Bearer a-access', data: '{"title":"a private draft"}' });
});

it('keeps mounted identity and real request payloads through an external same-session refresh', async () => {
  await writeAuth(credentialsFor('a'));
  render(<AuthProvider><SessionProbe /></AuthProvider>);
  const attempts = [];
  http.defaults.adapter = async (config) => {
    attempts.push({ authorization: config.headers.Authorization, data: JSON.parse(config.data) });
    return { config, status: 200, headers: {}, data: {} };
  };
  const external = createSessionStore({ storage: localStorage, locks: navigator.locks,
    events: new EventTarget(), randomUUID: () => crypto.randomUUID() });
  const record = external.read();
  await external.refresh(external.permit(record), record.revision, { access: 'a-rotated-access', refresh: 'a-rotated-refresh' });
  await http.patch('/private/', { title: 'a existing draft' });
  expect(attempts).toEqual([{ authorization: 'Bearer a-rotated-access', data: { title: 'a existing draft' } }]);
  expect(screen.getByText('a')).toBeInTheDocument();
});

it.each(['a', 'b'])('adopts external replacement as %s and logout by remounting private state', async (id) => {
  await writeAuth(credentialsFor('a'));
  function PrivateDraft() {
    const [draft, setDraft] = useState('');
    return <input aria-label="Private draft" value={draft} onChange={(event) => setDraft(event.target.value)} />;
  }
  render(<AuthProvider><SessionProbe /><PrivateDraft /></AuthProvider>);
  await userEvent.setup().type(screen.getByLabelText('Private draft'), 'a secret');
  const external = createSessionStore({ storage: localStorage, locks: navigator.locks,
    events: new EventTarget(), randomUUID: () => crypto.randomUUID() });
  await external.commitLogin(await external.beginLogin(), credentialsFor(id));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: sessionStorageKey, newValue: 'ignored stale data' })));
  expectSession(id);
  expect(screen.getByLabelText('Private draft')).toHaveValue('');
  await userEvent.setup().type(screen.getByLabelText('Private draft'), 'b secret');
  await external.logout();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: sessionStorageKey })));
  expectSession(null);
  expect(screen.getByLabelText('Private draft')).toHaveValue('');
});


it('rejects retained logout after unmount without changing the current session', async () => {
  await writeAuth(credentialsFor('a'));
  const { unmount } = render(<AuthProvider><SessionProbe /></AuthProvider>);
  const logout = context.logout;
  unmount();
  const before = localStorage.getItem(sessionStorageKey);
  await expect(logout()).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  expect(localStorage.getItem(sessionStorageKey)).toBe(before);
});

it.each(['login', 'logout'])('invalidates queued %s inside its lock on unmount', async (method) => {
  await writeAuth(credentialsFor('a'));
  const { unmount } = render(<AuthProvider><SessionProbe /></AuthProvider>);
  const entered = deferred();
  const release = deferred();
  const held = navigator.locks.request('devjobs.auth.v2', { mode: 'exclusive' }, async () => { entered.resolve(); await release.promise; });
  await entered.promise;
  const before = localStorage.getItem(sessionStorageKey);
  const result = context[method]({ email: 'a@example.test', password: 'synthetic' }).catch((error) => error);
  unmount();
  release.resolve();
  await held;
  expect(await result).toMatchObject({ code: 'ERR_CANCELED' });
  expect(localStorage.getItem(sessionStorageKey)).toBe(before);
});

it('supersedes login before lock acquisition and sends only the newest attempt', async () => {
  const { requests } = await controlledProvider();
  const a = startLogin('a');
  const b = startLogin('b');
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(await a).toMatchObject({ code: 'ERR_CANCELED' });
  expect(JSON.parse(requests[0].config.data).email).toBe('b@example.test');
  await act(async () => { requests[0].resolve(credentialsFor('b')); await b; });
  expectSession('b');
});


it('revalidates login lifetime after an asynchronous request interceptor', async () => {
  await writeAuth(null);
  const entered = deferred();
  const release = deferred();
  const transport = vi.fn();
  http.defaults.adapter = transport;
  const interceptor = http.interceptors.request.use(async (config) => {
    entered.resolve();
    await release.promise;
    return config;
  });
  try {
    const { unmount } = render(<AuthProvider><SessionProbe /></AuthProvider>);
    const result = startLogin('a');
    await entered.promise;
    unmount();
    release.resolve();
    expect(await result).toMatchObject({ code: 'ERR_CANCELED' });
    expect(transport).not.toHaveBeenCalled();
    expect(readAuth()).toBeNull();
  } finally { release.resolve(); http.interceptors.request.eject(interceptor); }
});
