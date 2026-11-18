import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { StrictMode, useCallback } from 'react';
import { afterEach, expect, it } from 'vitest';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { http, writeAuth } from '../auth/api.js';
import { useApplicationResource } from './useApplicationResource.js';
import { jobsApi } from './services/api.js';

const original = http.defaults.adapter;
const credentials = (id) => ({ access: `${id}-access`, refresh: `${id}-refresh`, user: { id, role: 'candidate' } });
let retained;
function Harness({ identity = 1, detail = false }) {
  const load = useCallback((config) => detail ? jobsApi.application(identity, config) : jobsApi.applications({ page: identity }, config), [identity, detail]);
  const resource = useApplicationResource(identity, load);
  retained = resource;
  return <><p>{resource.loading ? 'pending' : resource.data?.label || resource.error}</p><button onClick={resource.refresh}>Retry</button></>;
}
const content = (identity, detail) => <AuthProvider><Harness identity={identity} detail={detail} /></AuthProvider>;
async function setup(detail = false) {
  await writeAuth(credentials('A'));
  const requests = [];
  http.defaults.adapter = (config) => new Promise((resolve, reject) => requests.push({ config, resolve: (label) => resolve({ config, status: 200, headers: {}, data: { label } }), reject }));
  const view = render(content(1, detail));
  await waitFor(() => expect(requests).toHaveLength(1));
  return { view, requests };
}
afterEach(() => { cleanup(); http.defaults.adapter = original; localStorage.clear(); });
for (const detail of [false, true]) {
  for (const lateError of [false, true]) {
    it(`ignores late ${lateError ? 'error' : 'success'} after ${detail ? 'route' : 'page'} replacement`, async () => {
      const { view, requests } = await setup(detail);
      view.rerender(content(2, detail));
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[0].config.signal.aborted).toBe(true);
      await act(async () => { requests[1].resolve('new'); });
      expect(view.getByText('new')).toBeTruthy();
      await act(async () => { if (lateError) requests[0].reject(new Error('late')); else requests[0].resolve('old'); });
      expect(view.getByText('new')).toBeTruthy();
    });
  }
}
for (const transition of ['B', 'B-A', 'same-account', 'logout']) {
  it(`isolates pending reads and retained actions after ${transition}`, async () => {
    const { view, requests } = await setup();
    const old = retained;
    await act(async () => {
      if (transition === 'B-A') { await writeAuth(credentials('B')); await writeAuth(credentials('A')); }
      else await writeAuth(transition === 'logout' ? null : credentials(transition === 'same-account' ? 'A' : 'B'));
    });
    const count = requests.length;
    await act(async () => { await old.withdraw('private'); await old.refresh(); requests[0].resolve('private'); });
    expect(requests).toHaveLength(count);
    expect(view.queryByText('private')).toBeNull();
    expect(requests[0].config.signal.aborted).toBe(true);
  });
}
it('supersedes concurrent retries and clears loading only for the newest request', async () => {
  const { view, requests } = await setup();
  fireEvent.click(view.getByText('Retry'));
  await waitFor(() => expect(requests).toHaveLength(2));
  await act(async () => { requests[0].resolve('old'); });
  expect(view.getByText('pending')).toBeTruthy();
  await act(async () => { requests[1].resolve('current'); });
  expect(view.getByText('current')).toBeTruthy();
});
it('aborts unmounted reads and rejects retained callbacks', async () => {
  const { view, requests } = await setup();
  const old = retained;
  view.unmount();
  await act(async () => { await old.refresh(); await old.withdraw('private'); requests[0].resolve('old'); });
  expect(requests).toHaveLength(1);
  expect(requests[0].config.signal.aborted).toBe(true);
});
it('refreshes after withdrawal and blocks callbacks belonging to the retired result', async () => {
  const { requests } = await setup();
  await act(async () => { requests[0].resolve('loaded'); });
  const old = retained;
  let completion;
  await act(async () => { completion = old.withdraw('application-A'); });
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[1].config.method).toBe('patch');
  expect(requests[1].config.headers.Authorization).toBe('Bearer A-access');
  await act(async () => { requests[1].resolve('withdrawn'); });
  await waitFor(() => expect(requests).toHaveLength(3));
  await act(async () => { requests[2].resolve('updated'); await completion; });
  await act(async () => { await old.withdraw('application-A'); });
  expect(requests).toHaveLength(3);
});

it('does not revive page A callbacks after A to B to A', async () => {
  const { view, requests } = await setup();
  await act(async () => { requests[0].resolve('initial'); });
  const old = retained;
  view.rerender(content(2));
  await waitFor(() => expect(requests).toHaveLength(2));
  view.rerender(content(1));
  await waitFor(() => expect(requests).toHaveLength(3));
  await act(async () => { requests[2].resolve('returned'); await old.withdraw('private'); await old.refresh(); requests[1].resolve('late B'); });
  expect(requests).toHaveLength(3);
  expect(view.getByText('returned')).toBeTruthy();
});
it('loads under Strict Mode effect replay', async () => {
  await writeAuth(credentials('A'));
  http.defaults.adapter = async (config) => ({ config, status: 200, headers: {}, data: { label: 'strict result' } });
  const view = render(<StrictMode>{content(1)}</StrictMode>);
  expect(await view.findByText('strict result')).toBeTruthy();
});
