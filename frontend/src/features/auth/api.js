import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const storageKey = 'devjobs.auth';
export const http = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });
export const plainHttp = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });

export function readAuth() {
  try { return JSON.parse(window.localStorage.getItem(storageKey) || 'null'); } catch { return null; }
}
export function writeAuth(auth) {
  if (auth) window.localStorage.setItem(storageKey, JSON.stringify(auth));
  else window.localStorage.removeItem(storageKey);
}

let refreshPromise;
http.interceptors.request.use((config) => {
  const auth = readAuth();
  if (auth?.access) config.headers.Authorization = `Bearer ${auth.access}`;
  return config;
});
http.interceptors.response.use((response) => response, async (error) => {
  const request = error.config;
  if (error.response?.status !== 401 || !request || request._retried || request.url?.includes('/auth/')) throw error;
  let auth = readAuth();
  if (!auth?.refresh) { writeAuth(null); window.dispatchEvent(new Event('devjobs:logout')); throw error; }
  request._retried = true;
  // A concurrent request may have refreshed while this 401 was in flight.
  if (auth.access && request.headers?.Authorization !== `Bearer ${auth.access}`) {
    request.headers.Authorization = `Bearer ${auth.access}`;
    return http(request);
  }
  try {
    refreshPromise ||= plainHttp.post('/auth/token/refresh/', { refresh: auth.refresh }).finally(() => { refreshPromise = null; });
    const { data } = await refreshPromise;
    const latest = readAuth();
    // A logout or a different login can happen while the refresh is pending.
    if (!latest || latest.user?.id !== auth.user?.id) throw error;
    // Another waiter may have persisted a rotated pair after this refresh finished.
    if (latest.refresh !== auth.refresh && latest.access === auth.access) throw error;
    auth = latest.refresh !== auth.refresh
      ? latest
      : { ...latest, access: data.access, refresh: data.refresh || latest.refresh };
    writeAuth(auth);
    request.headers.Authorization = `Bearer ${data.access}`;
    return http(request);
  } catch (refreshError) {
    const latest = readAuth();
    if (latest?.refresh === auth.refresh) {
      writeAuth(null);
      window.dispatchEvent(new Event('devjobs:logout'));
    }
    throw refreshError;
  }
});

export const authApi = {
  login: (values) => http.post('/auth/login/', values).then(({ data }) => data),
  registerCandidate: (values) => http.post('/auth/candidate/register/', values).then(({ data }) => data),
  registerRecruiter: (values) => http.post('/auth/recruiter/register/', values).then(({ data }) => data),
};
