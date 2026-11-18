import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useCompanyMembership } from './useCompanyMembership.js';
import { CompanyPicker } from './CompanyPicker.jsx';
import { CompanyDirectory } from '../jobs/pages/CompanyDirectory.jsx';
import { jobsApi } from '../jobs/services/api.js';
const identity = vi.hoisted(() => ({ user: { id: 'synthetic' } }));
vi.mock('../auth/useAuth.js', () => ({ useAuth: () => identity }));
vi.mock('../jobs/services/api.js', () => ({ jobsApi: { recruiterCompanies: vi.fn() }, apiMessage: () => 'Request failed' }));
afterEach(() => { cleanup(); vi.resetAllMocks(); identity.user = { id: 'synthetic' }; });
const company = (id, role = 'OWNER') => ({ id, name: `Company ${id}`, role });
const envelope = (results, next = null, previous = null, count = results.length) => ({ results, next, previous, count });

it('hides previous-user directory memberships immediately on a same-route identity change', async () => {
  jobsApi.recruiterCompanies.mockResolvedValueOnce(envelope([company('private-owner-company')]))
    .mockImplementation(() => new Promise(() => {}));
  const view = () => <MemoryRouter initialEntries={['/recruiter/companies']}><CompanyDirectory /></MemoryRouter>;
  const { rerender } = render(view());
  expect(await screen.findByText('Company private-owner-company')).toBeInTheDocument();
  expect(screen.getByText('Active membership · OWNER')).toBeInTheDocument();
  identity.user = { id: 'unaffiliated-user' };
  rerender(view());
  expect(screen.queryByText('Company private-owner-company')).not.toBeInTheDocument();
  expect(screen.queryByText('Active membership · OWNER')).not.toBeInTheDocument();
  await waitFor(() => expect(jobsApi.recruiterCompanies).toHaveBeenCalledTimes(2));
});

it('resolves exact membership, invalidates immediately, and rejects late responses', async () => {
  let first;
  jobsApi.recruiterCompanies.mockImplementation(({ companyId }) => companyId === 'a' ? new Promise((resolve) => { first = resolve; }) : Promise.resolve(envelope([company('b', 'MEMBER')])));
  const { result, rerender } = renderHook(({ id }) => useCompanyMembership(id), { initialProps: { id: 'a' } });
  expect(result.current.loading).toBe(true);
  expect(result.current.canManage).toBe(false);
  rerender({ id: 'b' });
  await waitFor(() => expect(result.current.membership?.id).toBe('b'));
  await act(async () => first(envelope([company('a')])));
  expect(result.current.membership.id).toBe('b');
  expect(result.current.canManage).toBe(false);
  expect(jobsApi.recruiterCompanies).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'b' }));
});
it.each(['OWNER', 'ADMIN', 'MEMBER'])('preserves %s permissions', async (role) => {
  jobsApi.recruiterCompanies.mockResolvedValue(envelope([company('a', role)]));
  const { result } = renderHook(() => useCompanyMembership('a'));
  await waitFor(() => expect(result.current.status).toBe('success'));
  expect(result.current.canManage).toBe(role !== 'MEMBER');
});
it('does not restore cached management permissions on an A to B to A switch', async () => {
  jobsApi.recruiterCompanies.mockResolvedValueOnce(envelope([company('a', 'OWNER')]))
    .mockImplementation(() => new Promise(() => {}));
  const { result, rerender } = renderHook(({ id }) => useCompanyMembership(id), { initialProps: { id: 'a' } });
  await waitFor(() => expect(result.current.canManage).toBe(true));
  rerender({ id: 'b' });
  expect(result.current.loading).toBe(true);
  expect(result.current.canManage).toBe(false);
  rerender({ id: 'a' });
  expect(result.current.canManage).toBe(false);
  expect(result.current.loading).toBe(true);
  expect(result.current.membership).toBeUndefined();
});
it('distinguishes network failure from missing membership and retries', async () => {
  jobsApi.recruiterCompanies.mockRejectedValueOnce(new Error()).mockResolvedValue(envelope([]));
  const { result } = renderHook(() => useCompanyMembership('a'));
  await waitFor(() => expect(result.current.status).toBe('error'));
  act(() => result.current.retry());
  expect(result.current.canManage).toBe(false);
  await waitFor(() => expect(result.current.status).toBe('empty'));
});
it('loads picker pages on demand, deduplicates and preserves an external selection', async () => {
  jobsApi.recruiterCompanies.mockResolvedValueOnce(envelope([company('a')], 'https://untrusted.invalid', null, 30)).mockResolvedValueOnce(envelope([company('a'), company('b')]));
  render(<CompanyPicker selected={company('z')} value="z" onChange={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Load more companies' }));
  await waitFor(() => expect(jobsApi.recruiterCompanies).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
  expect(screen.getByText('Company z · OWNER')).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Company' }));
  expect(await screen.findByText('Company b · OWNER')).toBeInTheDocument();
  expect(screen.getAllByText('Company a · OWNER', { selector: '.ant-select-item-option-content' })).toHaveLength(1);
});
it('searches picker on the server and rejects a late search response', async () => {
  let stale;
  jobsApi.recruiterCompanies.mockImplementation(({ search }) => search === 'old' ? new Promise((resolve) => { stale = resolve; }) : Promise.resolve(envelope(search ? [company(search)] : [])));
  render(<CompanyPicker onChange={vi.fn()} />);
  const input = screen.getByRole('combobox', { name: 'Company' });
  fireEvent.change(input, { target: { value: 'old' } });
  await waitFor(() => expect(stale).toBeTypeOf('function'));
  fireEvent.change(input, { target: { value: 'new' } });
  expect(await screen.findByText('Company new · OWNER')).toBeInTheDocument();
  await act(async () => stale(envelope([company('old')])));
  expect(screen.queryByText('Company old · OWNER')).not.toBeInTheDocument();
});
it('directory renders count, navigates pages, retries failures and resets search while preserving job context', async () => {
  jobsApi.recruiterCompanies.mockResolvedValueOnce(envelope([company('a')], 'next', null, 25)).mockRejectedValueOnce(new Error()).mockResolvedValueOnce(envelope([company('b')], null, 'prev', 25)).mockResolvedValue(envelope([]));
  render(<MemoryRouter initialEntries={['/recruiter/applicants?search=python']}><CompanyDirectory applicants /></MemoryRouter>);
  expect(await screen.findByText('25 companies')).toBeInTheDocument();
  expect(screen.getByText('Choose job to review applicants →')).toHaveAttribute('href', '/recruiter/jobs?search=python&company=a');
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Company b')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search companies' }), { target: { value: 'absent' } });
  fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Search companies' }), { key: 'Enter', code: 'Enter' });
  expect(await screen.findByText('No matching companies.')).toBeInTheDocument();
  expect(jobsApi.recruiterCompanies).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: 'absent' }));
});
it('picker displays retryable errors and then empty results', async () => {
  jobsApi.recruiterCompanies.mockRejectedValueOnce(new Error()).mockResolvedValue(envelope([]));
  render(<CompanyPicker onChange={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry companies' }));
  await waitFor(() => expect(jobsApi.recruiterCompanies).toHaveBeenCalledTimes(2));
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Company' }));
  expect(await screen.findByText('No matching companies')).toBeInTheDocument();
});

it('clears permissions immediately on logout and ignores a pending response', async () => {
  let resolve;
  jobsApi.recruiterCompanies.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { result, rerender } = renderHook(() => useCompanyMembership('a'));
  identity.user = null;
  rerender();
  expect(result.current.canManage).toBe(false);
  expect(result.current.membership).toBeUndefined();
  await act(async () => resolve(envelope([company('a')])));
  expect(result.current.membership).toBeUndefined();
});

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

it.each([['OWNER', 'MEMBER'], ['MEMBER', 'OWNER']])('gates every render and controls during %s to %s switching', async (from, to) => {
  const pending = deferred();
  const renders = [];
  jobsApi.recruiterCompanies.mockResolvedValueOnce(envelope([company('a', from)])).mockReturnValueOnce(pending.promise);
  function Controls({ id }) {
    const state = useCompanyMembership(id);
    renders.push({ id, ...state });
    return <button disabled={!state.canManage}>Manage company</button>;
  }
  const { rerender } = render(<Controls id="a" />);
  await waitFor(() => expect(renders.at(-1).status).toBe('success'));
  renders.length = 0;
  rerender(<Controls id="b" />);
  expect(renders.every((state) => state.loading && !state.canManage && !state.membership)).toBe(true);
  expect(screen.getByRole('button', { name: 'Manage company' })).toBeDisabled();
  await act(async () => pending.resolve(envelope([company('b', to)])));
  expect(screen.getByRole('button', { name: 'Manage company' })).toHaveProperty('disabled', to === 'MEMBER');
});

it.each(['error', 'empty'])('does not restore OWNER after a retry resolves as %s', async (status) => {
  const pending = deferred();
  jobsApi.recruiterCompanies.mockResolvedValueOnce(envelope([company('a')])).mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useCompanyMembership('a'));
  await waitFor(() => expect(result.current.canManage).toBe(true));
  act(() => result.current.retry());
  expect(result.current.loading).toBe(true);
  expect(result.current.membership).toBeUndefined();
  await act(async () => status === 'error' ? pending.reject(new Error()) : pending.resolve(envelope([])));
  expect(result.current.status).toBe(status);
  expect(result.current.canManage).toBe(false);
  expect(result.current.membership).toBeFalsy();
});

it('ignores older OWNER responses after returning to A and resolving its new MEMBER lookup', async () => {
  const requests = [deferred(), deferred(), deferred()];
  requests.forEach((request) => jobsApi.recruiterCompanies.mockReturnValueOnce(request.promise));
  const { result, rerender } = renderHook(({ id }) => useCompanyMembership(id), { initialProps: { id: 'a' } });
  rerender({ id: 'b' });
  rerender({ id: 'a' });
  await act(async () => requests[2].resolve(envelope([company('a', 'MEMBER')])));
  await act(async () => {
    requests[0].resolve(envelope([company('a')]));
    requests[1].resolve(envelope([company('b')]));
  });
  expect(result.current.membership).toEqual(company('a', 'MEMBER'));
  expect(result.current.canManage).toBe(false);
  expect(jobsApi.recruiterCompanies.mock.calls[0][0].signal.aborted).toBe(true);
  expect(jobsApi.recruiterCompanies.mock.calls[1][0].signal.aborted).toBe(true);
});

it('aborts on unmount and ignores completion even if the transport ignores abort', async () => {
  const pending = deferred();
  jobsApi.recruiterCompanies.mockReturnValueOnce(pending.promise);
  const observed = vi.fn();
  const { unmount } = renderHook(() => { const state = useCompanyMembership('a'); observed(state); return state; });
  const signal = jobsApi.recruiterCompanies.mock.calls[0][0].signal;
  unmount();
  observed.mockClear();
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve(envelope([company('a')])));
  expect(observed).not.toHaveBeenCalled();
});

it.each(['logout', 'user change'])('invalidates resolved authorization on %s and return to the original identity', async (change) => {
  const pending = deferred();
  jobsApi.recruiterCompanies.mockResolvedValueOnce(envelope([company('a')])).mockReturnValue(pending.promise);
  const renders = [];
  const { result, rerender } = renderHook(() => { const state = useCompanyMembership('a'); renders.push(state); return state; });
  await waitFor(() => expect(result.current.canManage).toBe(true));
  renders.length = 0;
  identity.user = change === 'logout' ? null : { id: 'other' };
  rerender();
  expect(renders.every((state) => !state.canManage && !state.membership)).toBe(true);
  identity.user = { id: 'synthetic' };
  renders.length = 0;
  rerender();
  expect(renders.every((state) => state.loading && !state.canManage && !state.membership)).toBe(true);
  await act(async () => pending.resolve(envelope([])));
  expect(result.current.status).toBe('empty');
  expect(result.current.canManage).toBe(false);
});


it.each(['MEMBER', 'ADMIN', 'empty', 'error'])('isolates directory OWNER from fresh %s results', async (role) => {
  const requests = [];
  jobsApi.recruiterCompanies.mockImplementation(() => { const request = deferred(); requests.push(request); return request.promise; });
  const view = () => <StrictMode><MemoryRouter><CompanyDirectory /></MemoryRouter></StrictMode>;
  const { rerender } = render(view());
  await act(async () => requests.at(-1).resolve(envelope([company('private')])));
  expect(await screen.findByText('Company private')).toBeInTheDocument();
  identity.user = { id: 'other' }; rerender(view());
  expect(screen.queryByText('Company private')).not.toBeInTheDocument();
  expect(screen.queryByText('Active membership · OWNER')).not.toBeInTheDocument();
  await act(async () => role === 'error' ? requests.at(-1).reject(new Error()) : requests.at(-1).resolve(envelope(role === 'empty' ? [] : [company('fresh', role)])));
  if (role === 'error') {
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await act(async () => requests.at(-1).resolve(envelope([company('fresh', 'MEMBER')])));
  } else if (role !== 'empty') expect(screen.getByText(`Active membership · ${role}`)).toBeInTheDocument();
  expect(screen.queryByText('Company private')).not.toBeInTheDocument();
  expect(screen.queryByText('Active membership · OWNER')).not.toBeInTheDocument();
});

it.each(['search', 'pagination'])('rejects old directory %s results through A to B to A and logout', async (operation) => {
  const requests = [];
  jobsApi.recruiterCompanies.mockImplementation((args) => { const request = deferred(); requests.push({ ...request, args }); return request.promise; });
  const view = () => <StrictMode><MemoryRouter><CompanyDirectory /></MemoryRouter></StrictMode>;
  const { rerender } = render(view());
  await act(async () => requests.at(-1).resolve(envelope([company('private')], 'next', null, 40)));
  if (operation === 'pagination') fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  else {
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search companies' }), { target: { value: 'query' } });
    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Search companies' }), { key: 'Enter', code: 'Enter' });
  }
  const old = requests.at(-1);
  identity.user = { id: 'other' }; rerender(view());
  expect(screen.queryByText('Company private')).not.toBeInTheDocument();
  const other = requests.at(-1);
  expect(other.args).toEqual(expect.objectContaining(operation === 'search' ? { search: 'query', page: 1 } : { page: 2 }));
  identity.user = { id: 'synthetic' }; rerender(view());
  expect(screen.queryByText('Active membership · OWNER')).not.toBeInTheDocument();
  await act(async () => requests.at(-1).resolve(envelope([company('fresh', 'MEMBER')])));
  await act(async () => { old.resolve(envelope([company('obsolete')])); other.resolve(envelope([company('other')])); });
  expect(screen.getByText('Company fresh')).toBeInTheDocument();
  expect(screen.queryByText('Company obsolete')).not.toBeInTheDocument();
  expect(screen.queryByText('Company other')).not.toBeInTheDocument();
  expect(old.args.signal.aborted).toBe(true);
  expect(other.args.signal.aborted).toBe(true);
  identity.user = null; rerender(view());
  expect(screen.queryByText('Company fresh')).not.toBeInTheDocument();
  const count = requests.length;
  identity.user = { id: 'synthetic' }; rerender(view());
  expect(requests.length).toBeGreaterThan(count);
  const pending = requests.at(-1);
  identity.user = null; rerender(view());
  await act(async () => pending.resolve(envelope([company('late-owner')])));
  expect(screen.queryByText('Active membership · OWNER')).not.toBeInTheDocument();
});
