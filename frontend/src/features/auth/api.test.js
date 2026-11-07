import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, plainHttp, writeAuth } from './api.js';

const identity = { id: 'synthetic-user', email: 'person@example.test', role: 'candidate' };
const initialAuth = { access: 'expired-access', refresh: 'valid-refresh', user: identity };
function response(config, status, data = {}) {
  const result = { config, status, data, headers: {}, statusText: String(status) };
  if (status >= 400) throw new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, result);
  return result;
}

beforeEach(() => {
  window.localStorage.clear();
  writeAuth(initialAuth);
});
afterEach(() => {
  http.defaults.adapter = axios.defaults.adapter;
  plainHttp.defaults.adapter = axios.defaults.adapter;
  vi.restoreAllMocks();
});

describe('JWT request integration', () => {
  it('shares one refresh across concurrent requests and retries each once', async () => {
    let refreshCount = 0;
    let resourceCount = 0;
    http.defaults.adapter = async (config) => {
      if (config.url.includes('/auth/')) return response(config, 401);
      resourceCount += 1;
      return config.headers.Authorization === 'Bearer fresh-access'
        ? response(config, 200, { ok: true })
        : response(config, 401);
    };
    plainHttp.defaults.adapter = async (config) => {
      refreshCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return response(config, 200, { access: 'fresh-access' });
    };

    const results = await Promise.all([http.get('/candidate/private/'), http.get('/candidate/private/')]);

    expect(results).toHaveLength(2);
    expect(refreshCount).toBe(1);
    expect(resourceCount).toBe(4);
    expect(JSON.parse(window.localStorage.getItem('devjobs.auth')).access).toBe('fresh-access');
  });

  it('clears auth and signals logout when refresh fails', async () => {
    const logout = vi.fn();
    window.addEventListener('devjobs:logout', logout);
    http.defaults.adapter = async (config) => response(config, 401);
    plainHttp.defaults.adapter = async (config) => response(config, 401, { detail: 'Invalid token.' });

    await expect(http.get('/candidate/private/')).rejects.toMatchObject({ response: { status: 401 } });

    expect(window.localStorage.getItem('devjobs.auth')).toBeNull();
    expect(logout).toHaveBeenCalledTimes(1);
    window.removeEventListener('devjobs:logout', logout);
  });

  it('does not retry authentication endpoints or loop when a retried request is unauthorized', async () => {
    let resourceCount = 0;
    let refreshCount = 0;
    http.defaults.adapter = async (config) => {
      if (config.url.includes('/auth/')) return response(config, 401);
      resourceCount += 1;
      return response(config, 401);
    };
    plainHttp.defaults.adapter = async (config) => { refreshCount += 1; return response(config, 200, { access: 'fresh-access' }); };

    await expect(http.post('/auth/login/', { email: 'person@example.test', password: 'wrong' })).rejects.toMatchObject({ response: { status: 401 } });
    await expect(http.get('/candidate/private/')).rejects.toMatchObject({ response: { status: 401 } });

    expect(resourceCount).toBe(2);
    expect(refreshCount).toBe(1);
  });

  it('uses a newer access token instead of issuing a second refresh for a late 401', async () => {
    let refreshCount = 0;
    let expiredResourceCount = 0;
    let firstResourceResolve;
    http.defaults.adapter = async (config) => {
      if (config.url.includes('/auth/')) return response(config, 401);
      if (config.headers.Authorization === 'Bearer expired-access') {
        expiredResourceCount += 1;
        if (expiredResourceCount === 2) await new Promise((resolve) => { firstResourceResolve = resolve; });
        return response(config, 401);
      }
      return response(config, 200, { ok: true });
    };
    plainHttp.defaults.adapter = async (config) => {
      refreshCount += 1;
      writeAuth({ ...initialAuth, access: 'fresh-access' });
      firstResourceResolve?.();
      return response(config, 200, { access: 'fresh-access' });
    };

    const results = await Promise.all([http.get('/candidate/private/'), http.get('/candidate/private/')]);
    expect(results).toHaveLength(2);
    expect(refreshCount).toBe(1);
  });

  it('does not restore a session after logout while refresh is pending', async () => {
    let startRefresh;
    let finishRefresh;
    const refreshStarted = new Promise((resolve) => { startRefresh = resolve; });
    http.defaults.adapter = async (config) => response(config, 401);
    plainHttp.defaults.adapter = async (config) => {
      startRefresh();
      return new Promise((resolve) => { finishRefresh = () => resolve(response(config, 200, { access: 'late-access' })); });
    };

    const pendingRequest = http.get('/candidate/private/');
    await refreshStarted;
    writeAuth(null);
    finishRefresh();

    await expect(pendingRequest).rejects.toMatchObject({ response: { status: 401 } });
    expect(window.localStorage.getItem('devjobs.auth')).toBeNull();
  });

  it('preserves a different login that replaces the session during refresh', async () => {
    let startRefresh;
    let finishRefresh;
    const refreshStarted = new Promise((resolve) => { startRefresh = resolve; });
    const nextAuth = { access: 'new-access', refresh: 'new-refresh', user: { ...identity, id: 'other-user' } };
    http.defaults.adapter = async (config) => response(config, 401);
    plainHttp.defaults.adapter = async (config) => {
      startRefresh();
      return new Promise((resolve) => { finishRefresh = () => resolve(response(config, 200, { access: 'late-access' })); });
    };

    const pendingRequest = http.get('/candidate/private/');
    await refreshStarted;
    writeAuth(nextAuth);
    finishRefresh();

    await expect(pendingRequest).rejects.toMatchObject({ response: { status: 401 } });
    expect(JSON.parse(window.localStorage.getItem('devjobs.auth'))).toEqual(nextAuth);
  });
});
