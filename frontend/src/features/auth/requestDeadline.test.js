import axios from 'axios';
import { afterEach, expect, it, vi } from 'vitest';
import { REFRESH_TIMEOUT, REQUEST_TIMEOUT, withRequestDeadline } from './requestDeadline.js';
import { http, plainHttp, readAuth, writeAuth } from './api.js';

const original = http.defaults.adapter;
const originalRefresh = plainHttp.defaults.adapter;
const auth = { access: 'A-access', refresh: 'A-refresh', user: { id: 'A', role: 'candidate' } };
afterEach(() => { http.defaults.adapter = original; plainHttp.defaults.adapter = originalRefresh; vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); });

it('bounds a noncooperating operation and aborts its signal without replay', async () => {
  vi.useFakeTimers();
  let config;
  const operation = vi.fn((value) => { config = value; return new Promise(() => {}); });
  const outcome = withRequestDeadline({}, operation).catch((error) => error);
  await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT);
  expect(await outcome).toMatchObject({ code: 'ECONNABORTED' });
  expect(config.signal.aborted).toBe(true);
  expect(operation).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
it('keeps the original deadline across retries and disposes completed timers', async () => {
  vi.useFakeTimers();
  const first = await withRequestDeadline({}, (config) => config);
  await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT - 100);
  const outcome = withRequestDeadline(first, () => new Promise(() => {})).catch((error) => error);
  await vi.advanceTimersByTimeAsync(100);
  expect(await outcome).toMatchObject({ code: 'ECONNABORTED' });
  expect(vi.getTimerCount()).toBe(0);
});
it('cancels without invoking an already retired operation', async () => {
  const controller = new AbortController(); controller.abort();
  const operation = vi.fn();
  await expect(withRequestDeadline({ signal: controller.signal }, operation)).rejects.toBeDefined();
  expect(operation).not.toHaveBeenCalled();
});
it('times out a real Axios mutation without replay or expiring the current account', async () => {
  await writeAuth(auth);
  vi.useFakeTimers();
  let release;
  const requests = [];
  http.defaults.adapter = (config) => { requests.push(config); return new Promise((resolve) => { release = () => resolve({ config, status: 200, headers: {}, data: {} }); }); };
  const outcome = http.patch('/jobs/owned/', { title: 'pending' }).catch((error) => error);
  await vi.advanceTimersByTimeAsync(0);
  expect(requests).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT);
  expect(await outcome).toMatchObject({ code: 'ECONNABORTED' });
  expect(readAuth()).toEqual(auth);
  release(); await vi.advanceTimersByTimeAsync(0);
  expect(requests).toHaveLength(1);
});
it('bounds shared refresh and permits a later account to start a fresh flight', async () => {
  await writeAuth(auth);
  vi.useFakeTimers();
  const requests = [];
  http.defaults.adapter = async (config) => { throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, config }); };
  plainHttp.defaults.adapter = (config) => { requests.push(config); return new Promise(() => {}); };
  const first = http.get('/private/').catch((error) => error);
  const second = http.get('/private/').catch((error) => error);
  await vi.advanceTimersByTimeAsync(0);
  expect(requests).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(REFRESH_TIMEOUT);
  await Promise.all([first, second]);
  expect(readAuth()).toBeNull();
  await writeAuth(auth);
  plainHttp.defaults.adapter = async (config) => ({ config, status: 200, headers: {}, data: { access: 'new-access' } });
  http.defaults.adapter = async (config) => {
    if (config.headers.Authorization === 'Bearer new-access') return { config, status: 200, headers: {}, data: {} };
    throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, config });
  };
  await http.get('/private/');
  expect(readAuth().access).toBe('new-access');
});
it('retires a request held in an interceptor before it can dispatch', async () => {
  await writeAuth(auth);
  vi.useFakeTimers();
  let release;
  const adapter = vi.fn(); http.defaults.adapter = adapter;
  const interceptor = http.interceptors.request.use(async (config) => { await new Promise((resolve) => { release = resolve; }); return config; });
  try {
    const outcome = http.patch('/jobs/owned/', {}).catch((error) => error);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT);
    expect(await outcome).toMatchObject({ code: 'ECONNABORTED' });
    release(); await vi.advanceTimersByTimeAsync(0);
    expect(adapter).not.toHaveBeenCalled();
    expect(readAuth()).toEqual(auth);
  } finally { release?.(); http.interceptors.request.eject(interceptor); }
});
it('aborts queued refresh commits and expiry without allowing a late credential write', async () => {
  await writeAuth(auth);
  vi.useFakeTimers();
  const native = navigator.locks.request;
  const callbacks = [];
  vi.spyOn(navigator.locks, 'request').mockImplementation((name, options, work) => {
    if (options.mode !== 'exclusive') return native(name, options, work);
    return new Promise((resolve, reject) => {
      callbacks.push(work);
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    });
  });
  http.defaults.adapter = async (config) => { throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, config }); };
  plainHttp.defaults.adapter = async (config) => ({ config, status: 200, headers: {}, data: { access: 'late-access' } });
  const outcome = http.get('/private/').catch((error) => error);
  await vi.advanceTimersByTimeAsync(REFRESH_TIMEOUT + 5_000);
  expect(await outcome).toMatchObject({ code: 'ECONNABORTED' });
  expect(callbacks).toHaveLength(2);
  for (const callback of callbacks) expect(callback).toThrow();
  expect(readAuth()).toEqual(auth);
});

it('configures bounded Axios transport defaults', () => { expect(http.defaults.timeout).toBe(REQUEST_TIMEOUT); expect(plainHttp.defaults.timeout).toBe(REFRESH_TIMEOUT); });

it('rejects an exhausted retry deadline before invoking transport', async () => {
  vi.useFakeTimers();
  const operation = vi.fn();
  const outcome = withRequestDeadline({ _deadlineAt: Date.now() - 1 }, operation).catch((error) => error);
  expect(await outcome).toMatchObject({ code: 'ECONNABORTED' });
  expect(operation).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it.each([0, Infinity, NaN, -1])('uses a finite deadline for invalid timeout %s', async (timeout) => {
  vi.useFakeTimers();
  const outcome = withRequestDeadline({ timeout }, () => new Promise(() => {})).catch((error) => error);
  await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT);
  expect(await outcome).toMatchObject({ code: 'ECONNABORTED' });
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps replacement credentials when a timed-out refresh returns late', async () => {
  await writeAuth(auth);
  vi.useFakeTimers();
  let release;
  http.defaults.adapter = async (config) => { throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, config }); };
  plainHttp.defaults.adapter = (config) => new Promise((resolve) => { release = () => resolve({ config, status: 200, headers: {}, data: { access: 'late-access' } }); });
  const outcome = http.get('/private/').catch((error) => error);
  await vi.advanceTimersByTimeAsync(0);
  const replacement = { access: 'B-access', refresh: 'B-refresh', user: { id: 'B', role: 'candidate' } };
  await writeAuth(replacement);
  await vi.advanceTimersByTimeAsync(REFRESH_TIMEOUT);
  expect(await outcome).toMatchObject({ code: 'ERR_CANCELED' });
  release(); await vi.advanceTimersByTimeAsync(0);
  expect(readAuth()).toEqual(replacement);
});

it('recovers after a stalled mutation times out without replaying it', async () => {
  await writeAuth(auth);
  vi.useFakeTimers();
  const adapter = vi.fn(() => new Promise(() => {}));
  http.defaults.adapter = adapter;
  const outcome = http.post('/applications/', {}, { timeout: 25 }).catch((error) => error);
  await vi.advanceTimersByTimeAsync(25);
  expect(await outcome).toMatchObject({ code: 'ECONNABORTED' });
  http.defaults.adapter = async (config) => ({ config, status: 200, headers: {}, data: { recovered: true } });
  expect((await http.get('/private/')).data).toEqual({ recovered: true });
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(readAuth()).toEqual(auth);
  expect(vi.getTimerCount()).toBe(0);
});

it('retains the original deadline through a real Axios refresh and mutation retry', async () => {
  await writeAuth(auth);
  vi.useFakeTimers();
  const sends = [];
  let refresh;
  http.defaults.adapter = async (config) => {
    sends.push(config);
    if (sends.length > 1) return new Promise(() => {});
    throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, config });
  };
  plainHttp.defaults.adapter = (config) => new Promise((resolve) => { refresh = () => resolve({ config, status: 200, headers: {}, data: { access: 'new-access' } }); });
  const outcome = http.patch('/jobs/owned/', {}, { timeout: 100 }).catch((error) => error);
  await vi.advanceTimersByTimeAsync(90);
  refresh(); await vi.advanceTimersByTimeAsync(0);
  expect(sends).toHaveLength(2);
  expect(sends[1]._deadlineAt).toBe(sends[0]._deadlineAt);
  expect(sends[1].timeout).toBe(10);
  await vi.advanceTimersByTimeAsync(10);
  expect(await outcome).toMatchObject({ code: 'ECONNABORTED' });
  expect(sends).toHaveLength(2);
  expect(vi.getTimerCount()).toBe(0);
});

it('lets another consumer finish a shared refresh after one consumer cancels', async () => {
  await writeAuth(auth);
  vi.useFakeTimers();
  let release;
  const refreshes = vi.fn((config) => new Promise((resolve) => { release = () => resolve({ config, status: 200, headers: {}, data: { access: 'new-access' } }); }));
  plainHttp.defaults.adapter = refreshes;
  http.defaults.adapter = async (config) => {
    if (config.headers.Authorization === 'Bearer new-access') return { config, status: 200, headers: {}, data: { value: 'current' } };
    throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, config });
  };
  const controller = new AbortController();
  const first = http.get('/private/', { signal: controller.signal }).catch((error) => error);
  const second = http.get('/private/');
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  expect(await first).toMatchObject({ code: 'ERR_CANCELED' });
  release(); await vi.advanceTimersByTimeAsync(0);
  expect((await second).data).toEqual({ value: 'current' });
  expect(refreshes).toHaveBeenCalledTimes(1);
  expect(readAuth().access).toBe('new-access');
  expect(vi.getTimerCount()).toBe(0);
});

it.each(['logout', 'provider unmount'])('rejects late refresh commits after %s', async (action) => {
  const { ownRequests, sessionStore } = await import('./api.js');
  await writeAuth(auth);
  const permit = sessionStore.permit(sessionStore.read());
  const relinquish = ownRequests(permit);
  vi.useFakeTimers();
  let release;
  plainHttp.defaults.adapter = (config) => new Promise((resolve) => { release = () => resolve({ config, status: 200, headers: {}, data: { access: 'late-access' } }); });
  http.defaults.adapter = async (config) => { throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, config }); };
  try {
    const outcome = http.get('/private/').catch((error) => error);
    await vi.advanceTimersByTimeAsync(0);
    if (action === 'logout') await sessionStore.logout();
    else sessionStore.revoke(permit);
    const before = localStorage.getItem('devjobs.auth.v2');
    release(); await vi.advanceTimersByTimeAsync(0);
    expect(await outcome).toMatchObject({ code: 'ERR_CANCELED' });
    expect(localStorage.getItem('devjobs.auth.v2')).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
  } finally { relinquish(); }
});

it('bounds a shared refresh held in an interceptor and prevents its late dispatch', async () => {
  await writeAuth(auth);
  vi.useFakeTimers();
  let release;
  const adapter = vi.fn(); plainHttp.defaults.adapter = adapter;
  http.defaults.adapter = async (config) => { throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, config }); };
  const interceptor = plainHttp.interceptors.request.use(async (config) => { await new Promise((resolve) => { release = resolve; }); return config; });
  try {
    const outcome = http.get('/private/').catch((error) => error);
    await vi.advanceTimersByTimeAsync(REFRESH_TIMEOUT);
    expect(await outcome).toMatchObject({ code: 'ECONNABORTED' });
    expect(readAuth()).toBeNull();
    release(); await vi.advanceTimersByTimeAsync(0);
    expect(adapter).not.toHaveBeenCalled();
    // JSDOM queues a storage event when failure expiry writes the anonymous record.
    await vi.advanceTimersToNextTimerAsync();
    expect(vi.getTimerCount()).toBe(0);
  } finally { release?.(); plainHttp.interceptors.request.eject(interceptor); }
});
