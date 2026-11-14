import axios from 'axios';
import { jobsApi } from '../jobs/services/api.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, plainHttp, readAuth, writeAuth } from './api.js';

const identity = { id: 'synthetic-user', email: 'person@example.test', role: 'candidate' };
const initialAuth = { access: 'expired-access', refresh: 'valid-refresh', user: identity };
function response(config, status, data = {}) {
  const result = { config, status, data, headers: {}, statusText: String(status) };
  if (status >= 400) throw new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, result);
  return result;
}

beforeEach(async () => {
  window.localStorage.clear();
  await writeAuth(initialAuth);
});
afterEach(() => {
  http.defaults.adapter = axios.defaults.adapter;
  plainHttp.defaults.adapter = axios.defaults.adapter;
  vi.restoreAllMocks();
});

describe('JWT request integration', () => {
  it('does not replay a previous recruiter mutation under a different login after a late 401', async () => {
    const previous = { access: 'recruiter-a-access', refresh: 'recruiter-a-refresh', user: { id: 'recruiter-a', role: 'recruiter' } };
    const next = { access: 'recruiter-b-access', refresh: 'recruiter-b-refresh', user: { id: 'recruiter-b', role: 'recruiter' } };
    await writeAuth(previous);
    let started;
    let release;
    const dispatched = new Promise((resolve) => { started = resolve; });
    const attempts = [];
    http.defaults.adapter = async (config) => {
      attempts.push({ method: config.method, authorization: config.headers.Authorization, data: config.data });
      if (attempts.length === 1) {
        started();
        await new Promise((resolve) => { release = resolve; });
        return response(config, 401);
      }
      return response(config, 200, { title: 'A private draft' });
    };
    const outcome = http.patch('/jobs/synthetic-job/', { title: 'A private draft' }).then(() => 'resolved', () => 'rejected');
    await dispatched;
    await writeAuth(next);
    release();
    const result = await outcome;
    // A retry, if one occurs, must never carry the replacement account's token.
    expect(attempts.filter((attempt) => attempt.authorization === 'Bearer recruiter-b-access')).toEqual([]);
    expect(attempts).toHaveLength(1);
    expect(result).toBe('rejected');
    expect(readAuth()).toEqual(next);
  });

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
    expect(readAuth().access).toBe('fresh-access');
  });

  it('clears auth and signals logout when refresh fails', async () => {
    const logout = vi.fn();
    window.addEventListener('devjobs:logout', logout);
    http.defaults.adapter = async (config) => response(config, 401);
    plainHttp.defaults.adapter = async (config) => response(config, 401, { detail: 'Invalid token.' });

    await expect(http.get('/candidate/private/')).rejects.toMatchObject({ response: { status: 401 } });

    expect(readAuth()).toBeNull();
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
      // Release the late 401 after the real refresh has persisted its token.
      setTimeout(() => firstResourceResolve?.(), 0);
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
    await writeAuth(null);
    finishRefresh();

    await expect(pendingRequest).rejects.toMatchObject({ response: { status: 401 } });
    expect(readAuth()).toBeNull();
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
    await writeAuth(nextAuth);
    finishRefresh();

    await expect(pendingRequest).rejects.toMatchObject({ response: { status: 401 } });
    expect(readAuth()).toEqual(nextAuth);
  });
});


function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
const replacement = { ...initialAuth, access: 'b-access', refresh: 'b-refresh', user: { ...identity, id: 'b' } };

describe('session generation security boundary', () => {
  it.each(['patch', 'post', 'put', 'delete', 'get'])('rejects late %s across login and keeps B functional', async (method) => {
    const started = deferred(); const release = deferred(); const attempts = [];
    http.defaults.adapter = async (config) => {
      attempts.push({ method: config.method, token: config.headers.Authorization, data: config.data });
      if (attempts.length === 1) { started.resolve(); await release.promise; return response(config, 401); }
      return response(config, 200);
    };
    const config = { method, url: '/private/', data: { title: 'A payload' } };
    const pending = http(config).catch((error) => error);
    await started.promise; await writeAuth(replacement); release.resolve();
    expect(await pending).toMatchObject({ code: 'ERR_CANCELED', sessionExpired: true });
    expect(attempts).toEqual([{ method, token: 'Bearer expired-access', data: JSON.stringify(config.data) }]);
    await http.get('/private/');
    expect(attempts[1].token).toBe('Bearer b-access');
  });

  it.each([200, 401])('isolates pending refresh status %s from a new session and its refresh', async (status) => {
    const started = deferred(); const release = deferred(); const attempts = []; const refreshes = [];
    http.defaults.adapter = async (config) => {
      attempts.push({ token: config.headers.Authorization, data: config.data });
      return response(config, config.headers.Authorization === 'Bearer b-fresh' ? 200 : 401);
    };
    plainHttp.defaults.adapter = async (config) => {
      refreshes.push(JSON.parse(config.data).refresh);
      if (refreshes.length === 1) { started.resolve(); await release.promise; return response(config, status, { access: 'a-late', refresh: 'a-rotated' }); }
      return response(config, 200, { access: 'b-fresh', refresh: 'b-rotated' });
    };
    const logout = vi.fn(); window.addEventListener('devjobs:logout', logout);
    try {
      const old = http.patch('/private/', { title: 'A payload' }).catch((error) => error);
      await started.promise; await writeAuth(replacement);
      await http.post('/private/', { title: 'B payload' });
      release.resolve();
      expect(await old).toMatchObject({ sessionExpired: true });
      expect(refreshes).toEqual(['valid-refresh', 'b-refresh']);
      expect(attempts.filter((attempt) => attempt.data === '{"title":"A payload"}')).toEqual([{ token: 'Bearer expired-access', data: '{"title":"A payload"}' }]);
      expect(readAuth()).toEqual({ ...replacement, access: 'b-fresh', refresh: 'b-rotated' });
      expect(logout).not.toHaveBeenCalled();
    } finally { window.removeEventListener('devjobs:logout', logout); }
  });

  it.each(['logout-login', 'identical-login', 'storage-replacement'])('rejects old concurrent requests across %s', async (transition) => {
    const started = deferred(); const release = deferred(); let count = 0;
    http.defaults.adapter = async (config) => {
      count += 1; if (count === 2) started.resolve();
      await release.promise; return response(config, 401);
    };
    const outcomes = [http.get('/private/'), http.delete('/private/')].map((p) => p.catch((error) => error));
    await started.promise;
    if (transition === 'logout-login') { await writeAuth(null); await writeAuth(initialAuth); }
    else if (transition === 'identical-login') await writeAuth(initialAuth);
    else await writeAuth(replacement);
    release.resolve();
    for (const error of await Promise.all(outcomes)) expect(error).toMatchObject({ sessionExpired: true });
    expect(count).toBe(2);
  });

  it('captures ownership before delayed request interceptors and rejects before adapter dispatch', async () => {
    const started = deferred(); const release = deferred(); const adapter = vi.fn();
    http.defaults.adapter = adapter;
    const interceptor = http.interceptors.request.use(async (config) => { started.resolve(); await release.promise; return config; });
    try {
      const old = http.put('/private/', { title: 'A payload' }).catch((error) => error);
      await started.promise; await writeAuth(replacement); release.resolve();
      expect(await old).toMatchObject({ sessionExpired: true });
      expect(adapter).not.toHaveBeenCalled();
    } finally { http.interceptors.request.eject(interceptor); }
  });

  it('does not reactivate a same-user login when its previous refresh completes', async () => {
    const started = deferred(); const release = deferred();
    http.defaults.adapter = async (config) => response(config, 401);
    plainHttp.defaults.adapter = async (config) => { started.resolve(); await release.promise; return response(config, 200, { access: 'stale' }); };
    const old = http.get('/private/').catch((error) => error);
    await started.promise; await writeAuth(null); await writeAuth(initialAuth); release.resolve();
    expect(await old).toMatchObject({ sessionExpired: true });
    expect(readAuth()).toEqual(initialAuth);
  });

  it('rejects successful obsolete responses as well as obsolete failures', async () => {
    const started = deferred(); const release = deferred();
    http.defaults.adapter = async (config) => { started.resolve(); await release.promise; return response(config, 200, { private: 'A' }); };
    const old = http.get('/private/').catch((error) => error);
    await started.promise; await writeAuth(replacement); release.resolve();
    expect(await old).toMatchObject({ sessionExpired: true });
  });
});


describe('same-session mutation refresh', () => {
  it.each(['patch', 'post', 'put', 'delete', 'get'])('preserves %s headers and payload with a rotated token pair', async (method) => {
    const attempts = []; let refreshes = 0;
    http.defaults.adapter = async (config) => {
      attempts.push({ token: config.headers.Authorization, data: config.data });
      return response(config, attempts.length === 1 ? 401 : 200);
    };
    plainHttp.defaults.adapter = async (config) => { refreshes += 1; return response(config, 200, { access: 'fresh', refresh: 'rotated' }); };
    await http.request({ method, url: '/private/', data: { value: 'same-session' } });
    expect(attempts).toEqual([
      { token: 'Bearer expired-access', data: '{"value":"same-session"}' },
      { token: 'Bearer fresh', data: '{"value":"same-session"}' },
    ]);
    expect(refreshes).toBe(1);
    expect(readAuth().refresh).toBe('rotated');
  });

  it('rechecks a queued retry after refresh and before attaching credentials', async () => {
    const retryStarted = deferred(); const release = deferred(); let dispatches = 0;
    http.defaults.adapter = async (config) => { dispatches += 1; return response(config, 401); };
    plainHttp.defaults.adapter = async (config) => response(config, 200, { access: 'fresh' });
    const interceptor = http.interceptors.request.use(async (config) => {
      if (config._retried) { retryStarted.resolve(); await release.promise; }
      return config;
    });
    try {
      const old = http.patch('/private/', { title: 'A' }).catch((error) => error);
      await retryStarted.promise; await writeAuth(replacement); release.resolve();
      expect(await old).toMatchObject({ sessionExpired: true });
      expect(dispatches).toBe(1);
      expect(readAuth()).toEqual(replacement);
    } finally { http.interceptors.request.eject(interceptor); }
  });
});


describe('refresh transport ownership', () => {
  it('rejects a refresh queued behind account replacement before sending its credentials', async () => {
    const queued = deferred(); const release = deferred();
    const refreshAdapter = vi.fn();
    http.defaults.adapter = async (config) => response(config, 401);
    plainHttp.defaults.adapter = refreshAdapter;
    const interceptor = plainHttp.interceptors.request.use(async (config) => {
      queued.resolve(); await release.promise; return config;
    });
    try {
      const old = http.patch('/private/', { title: 'A payload' }).catch((error) => error);
      await queued.promise;
      await writeAuth(replacement);
      release.resolve();
      expect(await old).toMatchObject({ code: 'ERR_CANCELED', sessionExpired: true });
      expect(refreshAdapter).not.toHaveBeenCalled();
      expect(readAuth()).toEqual(replacement);
    } finally { plainHttp.interceptors.request.eject(interceptor); }
  });
});


it('keeps a multi-page company lookup bound to its initiating session', async () => {
  const dispatches = [];
  http.defaults.adapter = async (config) => {
    dispatches.push(config.headers.Authorization);
    return response(config, 200, { results: [], next: 'next' });
  };
  const original = jobsApi.companyJobs;
  vi.spyOn(jobsApi, 'companyJobs').mockImplementation(async (...args) => {
    const data = await original(...args);
    if (dispatches.length === 1) await writeAuth({ access: 'replacement', refresh: 'replacement-refresh', user: { id: 'replacement', role: 'recruiter' } });
    else return { results: [{ id: 'target' }], next: null };
    return data;
  });
  await expect(jobsApi.companyJob('company', 'target')).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  expect(dispatches).toEqual(['Bearer expired-access']);
});
