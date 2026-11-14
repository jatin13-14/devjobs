import axios from 'axios';
import { createSessionStore, SessionExpiredError } from './sessionStore.js';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const client = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });
export const plainHttp = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });
export const sessionStore = createSessionStore({
  storage: window.localStorage, events: window,
  locks: { request: (...args) => window.navigator.locks?.request(...args) ?? Promise.reject(new SessionExpiredError('Browser session locking unavailable')) },
  randomUUID: () => window.crypto.randomUUID(),
});
export function readAuth() {
  try { return sessionStore.read()?.credentials ?? null; } catch { return null; }
}
export async function writeAuth(auth) {
  if (!auth) return sessionStore.logout();
  const attempt = await sessionStore.beginLogin();
  return sessionStore.commitLogin(attempt, auth);
}
export const beginLogin = (validate) => sessionStore.beginLogin(validate);
export const cancelLogin = (operation) => sessionStore.cancelLogin(operation);
export const assertLogin = (operation) => sessionStore.assertAttempt(operation);
export const commitLogin = (operation, credentials) => sessionStore.commitLogin(operation, credentials);

// The rendered provider owns this capability. Reading shared storage here would
// bind stale UI actions to a replacement account before its storage event arrives.
let mountedOwner;
export function ownRequests(permit) {
  const owner = { permit };
  mountedOwner = owner;
  return () => { if (mountedOwner === owner) mountedOwner = undefined; };
}
// Axios preserves class instances while cloning plain config objects. Keep the
// opaque store permit intact through interceptors and callable retries.
class RequestOwnership {
  constructor(permit) { this.permit = permit; }
}
function bind(config = {}) {
  if (config._publicAuth || config._authPermit) return config;
  const record = sessionStore.read();
  const permit = mountedOwner ? mountedOwner.permit : record?.credentials ? sessionStore.permit(record) : null;
  if (permit) sessionStore.assertPermit(permit);
  else if (record?.credentials) throw new SessionExpiredError();
  return { ...config, _authPermit: permit ? new RequestOwnership(permit) : null, _authEpoch: record?.epoch ?? null };
}
// Compound services capture once and reuse this opaque ownership on every step.
export const captureRequestOwnership = () => bind();
function assertSession(config, cause) {
  try {
    config._assertAuthority?.();
    if (config._publicAuth) return;
    if (config._authPermit) sessionStore.assertPermit(config._authPermit.permit);
    else if (sessionStore.epoch() !== config._authEpoch) throw new SessionExpiredError();
  } catch (error) { error.response = cause?.response; throw error; }
}
const bodyMethods = new Set(['post', 'put', 'patch', 'postForm', 'putForm', 'patchForm']);
const methods = new Set(['get', 'delete', 'head', 'options', ...bodyMethods]);
// Return rejected promises even when ownership fails at synchronous initiation.
function initiate(work) { try { return work(); } catch (error) { return Promise.reject(error); } }
export const http = new Proxy(client, {
  apply(target, thisArg, args) {
    return initiate(() => { const [url, config] = args; return target(typeof url === 'string' ? { ...bind(config), url } : bind(url)); });
  },
  get(target, property) {
    if (property === 'request') return (config) => http(config);
    if (methods.has(property)) return (url, dataOrConfig, config) => initiate(() => bodyMethods.has(property)
      ? target[property](url, dataOrConfig, bind(config)) : target[property](url, bind(dataOrConfig)));
    return Reflect.get(target, property);
  },
});

let refreshFlight;
client.interceptors.request.use((config) => {
  assertSession(config);
  const transport = axios.getAdapter(config._transport ?? config.adapter);
  config._transport = transport;
  // Axios transforms the payload before this adapter. Validate and attach the
  // current token at actual dispatch while excluding every credential writer.
  config.adapter = (request) => {
    const send = (credentials) => {
      request._assertAuthority?.();
      if (credentials?.access) request.headers.Authorization = `Bearer ${credentials.access}`;
      else delete request.headers.Authorization;
      return transport(request);
    };
    if (request._authPermit) return sessionStore.dispatch(request._authPermit.permit, send);
    assertSession(request);
    return send(null);
  };
  return config;
});
client.interceptors.response.use((response) => {
  assertSession(response.config);
  return response;
}, async (error) => {
  const request = error.config;
  if (!request) throw error;
  assertSession(request, error);
  if (error.response?.status !== 401 || request._retried || request._publicAuth || request.url?.includes('/auth/') || !request._authPermit) throw error;
  const record = sessionStore.assertPermit(request._authPermit.permit);
  const auth = record.credentials;
  if (!auth.refresh) {
    await sessionStore.expire(request._authPermit.permit, record.revision);
    window.dispatchEvent(new Event('devjobs:logout'));
    throw error;
  }
  request._retried = true;
  if (request.headers?.Authorization !== `Bearer ${auth.access}`) return http(request);
  try {
    if (!refreshFlight || refreshFlight.epoch !== record.epoch || refreshFlight.refresh !== auth.refresh) {
      const flight = { epoch: record.epoch, refresh: auth.refresh };
      // Refresh has its own asynchronous interceptor queue. Revalidate the
      // originating permit and token revision at its actual transport boundary.
      const refreshTransport = axios.getAdapter(plainHttp.defaults.adapter);
      flight.promise = plainHttp.post('/auth/token/refresh/', { refresh: auth.refresh }, {
        adapter: (config) => sessionStore.dispatch(request._authPermit.permit, () => {
          if (sessionStore.assertPermit(request._authPermit.permit).revision !== record.revision) {
            throw new SessionExpiredError('Refresh result superseded');
          }
          return refreshTransport(config);
        }),
      }).then(({ data }) =>
        sessionStore.refresh(request._authPermit.permit, record.revision, { access: data.access, refresh: data.refresh || auth.refresh })
      ).finally(() => { if (refreshFlight === flight) refreshFlight = null; });
      refreshFlight = flight;
    }
    await refreshFlight.promise;
    assertSession(request, error);
    return http(request);
  } catch (refreshError) {
    assertSession(request, error);
    // A late refresh failure must not expire a newer same-session token pair.
    if (sessionStore.assertPermit(request._authPermit.permit).credentials.refresh === auth.refresh) {
      await sessionStore.expire(request._authPermit.permit, record.revision);
      window.dispatchEvent(new Event('devjobs:logout'));
    }
    throw refreshError;
  }
});
export const authApi = {
  login: (values, validate) => http.post('/auth/login/', values, { _publicAuth: true, _assertAuthority: validate }).then(({ data }) => data),
  registerCandidate: (values) => http.post('/auth/candidate/register/', values, { _publicAuth: true }).then(({ data }) => data),
  registerRecruiter: (values) => http.post('/auth/recruiter/register/', values, { _publicAuth: true }).then(({ data }) => data),
};
