import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { CompanyPage } from './CompanyPage.jsx';
import { jobsApi } from '../jobs/services/api.js';
import { http } from '../auth/api.js';
const retained = vi.hoisted(() => ({ forms: [], memberActions: [] }));
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal();
  function ObservedForm(props) { retained.forms.push(props.onFinish); return <actual.Form {...props} />; }
  Object.assign(ObservedForm, actual.Form);
  function ObservedSelect(props) { if (props['aria-label']) retained.memberActions.push(props.onChange); return <actual.Select {...props} />; }
  function ObservedPopconfirm(props) { retained.memberActions.push(props.onConfirm); return <actual.Popconfirm {...props} />; }
  return { ...actual, Form: ObservedForm, Select: ObservedSelect, Popconfirm: ObservedPopconfirm };
});
const identity = vi.hoisted(() => ({ user: { id: 'self' } }));
vi.mock('../auth/useAuth.js', () => ({ useAuth: () => identity }));
vi.mock('../auth/api.js', () => ({ captureRequestOwnership: () => ({}), assertRequestOwnership: () => {}, http: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../jobs/services/api.js', () => ({ jobsApi: { company: vi.fn(), recruiterCompanies: vi.fn() }, apiMessage: () => 'Request failed' }));
afterEach(() => { cleanup(); vi.resetAllMocks(); identity.user = { id: 'self' }; retained.forms = []; retained.memberActions = []; });
function mount() { render(<MemoryRouter initialEntries={['/recruiter/companies/company']}><Routes><Route path="/recruiter/companies/:id" element={<CompanyPage />} /></Routes></MemoryRouter>); }
it('shows member details without edit or membership controls', async () => {
  jobsApi.company.mockResolvedValue({ name: 'Synthetic Company' });
  jobsApi.recruiterCompanies.mockResolvedValue({ count: 1, results: [{ id: 'company', role: 'MEMBER' }] });
  mount();
  expect(await screen.findByText('Active membership · MEMBER')).toBeInTheDocument();
  expect(screen.getByLabelText('name')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save company' })).not.toBeInTheDocument();
  expect(http.get).not.toHaveBeenCalled();
});
it('protects owner and own membership from unsafe operations', async () => {
  jobsApi.company.mockResolvedValue({ name: 'Synthetic Company' });
  jobsApi.recruiterCompanies.mockResolvedValue({ count: 1, results: [{ id: 'company', role: 'OWNER' }] });
  http.get.mockResolvedValue({ data: [{ id: 'owner', recruiter_id: 'self', recruiter_name: 'Synthetic Owner', role: 'OWNER', status: 'ACTIVE' }] });
  mount();
  expect(await screen.findByText('Synthetic Owner · OWNER · ACTIVE')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Remove membership' })).not.toBeInTheDocument();
});

it('invalidates company management permissions when the authenticated user changes', async () => {
  jobsApi.company.mockResolvedValue({ name: 'Synthetic Company' });
  jobsApi.recruiterCompanies.mockResolvedValueOnce({ count: 1, results: [{ id: 'company', role: 'OWNER' }] })
    .mockImplementation(() => new Promise(() => {}));
  http.get.mockResolvedValue({ data: [] });
  const page = <MemoryRouter initialEntries={['/recruiter/companies/company']}><Routes><Route path="/recruiter/companies/:id" element={<CompanyPage />} /></Routes></MemoryRouter>;
  const { rerender } = render(page);
  expect(await screen.findByRole('button', { name: 'Save company' })).toBeEnabled();
  identity.user = { id: 'other-recruiter' };
  rerender(<MemoryRouter initialEntries={['/recruiter/companies/company']}><Routes><Route path="/recruiter/companies/:id" element={<CompanyPage />} /></Routes></MemoryRouter>);
  expect(screen.queryByRole('button', { name: 'Save company' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add membership' })).not.toBeInTheDocument();
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function identityPage() {
  return <MemoryRouter initialEntries={['/recruiter/companies/company']}><Routes><Route path="/recruiter/companies/:id" element={<CompanyPage />} /></Routes></MemoryRouter>;
}
function controlsAbsent() {
  expect(screen.queryByRole('button', { name: 'Save company' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add membership' })).not.toBeInTheDocument();
  expect(screen.queryByText('Active membership · OWNER')).not.toBeInTheDocument();
}
async function ownerPage() {
  jobsApi.company.mockResolvedValue({ name: 'Private old company' });
  jobsApi.recruiterCompanies.mockResolvedValueOnce({ results: [{ id: 'company', role: 'OWNER' }] });
  http.get.mockResolvedValue({ data: [] });
  const view = render(identityPage());
  await screen.findByRole('button', { name: 'Save company' });
  return view;
}
it.each(['MEMBER', 'ADMIN', 'empty', 'error', 'logout'])('clears OWNER controls immediately for a new identity: %s', async (result) => {
  const view = await ownerPage();
  const pending = deferred();
  jobsApi.recruiterCompanies.mockReturnValueOnce(pending.promise);
  identity.user = result === 'logout' ? null : { id: 'next' };
  view.rerender(identityPage());
  controlsAbsent();
  expect(screen.queryByDisplayValue('Private old company')).not.toBeInTheDocument();
  if (result === 'logout') return;
  await act(async () => {
    if (result === 'error') pending.reject(new Error('offline'));
    else pending.resolve({ results: result === 'empty' ? [] : [{ id: 'company', role: result }] });
  });
  if (result === 'ADMIN') expect(await screen.findByRole('button', { name: 'Save company' })).toBeEnabled();
  else { await waitFor(() => expect(screen.getByLabelText('name')).toBeDisabled()); controlsAbsent(); }
});
it('requires fresh authorization on A -> B -> A and ignores late B OWNER results', async () => {
  const view = await ownerPage();
  const b = deferred(); const a = deferred();
  jobsApi.recruiterCompanies.mockReturnValueOnce(b.promise).mockReturnValueOnce(a.promise);
  identity.user = { id: 'b' }; view.rerender(identityPage()); controlsAbsent();
  identity.user = { id: 'self' }; view.rerender(identityPage()); controlsAbsent();
  await act(async () => a.resolve({ results: [{ id: 'company', role: 'MEMBER' }] }));
  await screen.findByText('Active membership · MEMBER');
  await act(async () => b.resolve({ results: [{ id: 'company', role: 'OWNER' }] }));
  controlsAbsent();
});
it('ignores obsolete company/member data after switching users and unmounting', async () => {
  const oldMembers = deferred();
  jobsApi.company.mockResolvedValue({ name: 'Old name' });
  jobsApi.recruiterCompanies.mockResolvedValue({ results: [{ id: 'company', role: 'OWNER' }] });
  http.get.mockReturnValueOnce(oldMembers.promise);
  const view = render(identityPage());
  await waitFor(() => expect(http.get).toHaveBeenCalled());
  jobsApi.recruiterCompanies.mockResolvedValue({ results: [{ id: 'company', role: 'MEMBER' }] });
  jobsApi.company.mockResolvedValue({ name: 'New name' });
  identity.user = { id: 'next' }; view.rerender(identityPage()); controlsAbsent();
  await screen.findByDisplayValue('New name');
  await act(async () => oldMembers.resolve({ data: [{ id: 'old', recruiter_name: 'Old private member' }] }));
  expect(screen.queryByText(/Old private member/)).not.toBeInTheDocument();
  view.unmount();
});
it('revalidates after membership mutation and fails closed on lookup failure with usable retry', async () => {
  await ownerPage();
  http.post.mockResolvedValue({ data: {} });
  const pending = deferred();
  jobsApi.recruiterCompanies.mockReturnValueOnce(pending.promise);
  fireEvent.change(screen.getByLabelText('Recruiter account ID'), { target: { value: 'new-member' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add membership' }));
  await waitFor(() => expect(http.post).toHaveBeenCalled());
  await waitFor(controlsAbsent);
  await act(async () => pending.reject(new Error('offline')));
  expect(await screen.findByText('Request failed')).toBeInTheDocument(); controlsAbsent();
  jobsApi.recruiterCompanies.mockResolvedValue({ results: [{ id: 'company', role: 'ADMIN' }] });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' })); controlsAbsent();
  expect(await screen.findByRole('button', { name: 'Save company' })).toBeEnabled();
});
it('blocks form callbacks retained across identity changes', async () => {
  const view = await ownerPage();
  const oldCallbacks = retained.forms.filter(Boolean);
  jobsApi.recruiterCompanies.mockImplementation(() => new Promise(() => {}));
  identity.user = { id: 'next' }; view.rerender(identityPage());
  await act(async () => { for (const callback of oldCallbacks) await callback({ name: 'Obsolete', recruiter_id: 'obsolete' }); });
  expect(http.patch).not.toHaveBeenCalled();
  expect(http.post).not.toHaveBeenCalled();
});

function CompanyNavigation() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate('/recruiter/companies/second')}>Switch company</button><CompanyPage /></>;
}
it('clears permissions and form data immediately when the same user switches companies', async () => {
  jobsApi.company.mockResolvedValue({ name: 'First company' });
  jobsApi.recruiterCompanies.mockResolvedValueOnce({ results: [{ id: 'company', role: 'OWNER' }] });
  http.get.mockResolvedValue({ data: [] });
  render(<MemoryRouter initialEntries={['/recruiter/companies/company']}><Routes><Route path="/recruiter/companies/:id" element={<CompanyNavigation />} /></Routes></MemoryRouter>);
  await screen.findByRole('button', { name: 'Save company' });
  const pending = deferred(); jobsApi.recruiterCompanies.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole('button', { name: 'Switch company' })); controlsAbsent();
  expect(screen.queryByDisplayValue('First company')).not.toBeInTheDocument();
  jobsApi.company.mockResolvedValue({ name: 'Second company' });
  await act(async () => pending.resolve({ results: [] }));
  expect(await screen.findByDisplayValue('Second company')).toBeDisabled(); controlsAbsent();
});
it('ignores a pending membership mutation completion after logout', async () => {
  const view = await ownerPage(); const pending = deferred(); http.post.mockReturnValueOnce(pending.promise);
  fireEvent.change(screen.getByLabelText('Recruiter account ID'), { target: { value: 'new-member' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add membership' }));
  await waitFor(() => expect(http.post).toHaveBeenCalled());
  identity.user = null; view.rerender(identityPage()); controlsAbsent();
  await act(async () => pending.resolve({ data: {} }));
  expect(jobsApi.recruiterCompanies).toHaveBeenCalledTimes(1); controlsAbsent();
});

it('blocks retained role, status and removal callbacks after an authenticated identity change', async () => {
  jobsApi.company.mockResolvedValue({ name: 'Synthetic Company' });
  jobsApi.recruiterCompanies.mockResolvedValueOnce({ results: [{ id: 'company', role: 'OWNER' }] });
  http.get.mockResolvedValue({ data: [{ id: 'other-member', recruiter_id: 'other', recruiter_name: 'Other member', role: 'MEMBER', status: 'ACTIVE' }] });
  const view = render(identityPage());
  await screen.findByRole('button', { name: 'Remove membership' });
  const oldActions = retained.memberActions.filter(Boolean);
  expect(oldActions.length).toBeGreaterThanOrEqual(3);
  jobsApi.recruiterCompanies.mockImplementation(() => new Promise(() => {}));
  identity.user = { id: 'next' }; view.rerender(identityPage()); controlsAbsent();
  await act(async () => { for (const callback of oldActions) await callback('ADMIN'); });
  expect(http.patch).not.toHaveBeenCalled(); expect(http.delete).not.toHaveBeenCalled();
});

it('requests bounded member pages and never follows server navigation URLs', async () => {
  jobsApi.company.mockResolvedValue({ name: 'Paged Company' });
  jobsApi.recruiterCompanies.mockResolvedValue({ results: [{ id: 'company', role: 'OWNER' }] });
  http.get.mockResolvedValueOnce({ data: { count: 21, results: [], next: 'https://untrusted.example/' } })
    .mockResolvedValueOnce({ data: { count: 21, results: [{ id: 'last', recruiter_name: 'Last member', role: 'MEMBER', status: 'INVITED' }], next: null } });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Next page' }));
  expect(await screen.findByText('Last member · MEMBER · INVITED')).toBeInTheDocument();
  expect(http.get).toHaveBeenLastCalledWith('/companies/company/members/', expect.objectContaining({ params: { pagination: 'page', page: 2, page_size: 20 }, _assertAuthority: expect.any(Function) }));
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
});
it.each(['OWNER', 'ADMIN'])('only OWNER sees the dedicated eligible transfer action: %s', async (role) => {
  jobsApi.company.mockResolvedValue({ name: 'Company' });
  jobsApi.recruiterCompanies.mockResolvedValue({ results: [{ id: 'company', role }] });
  http.get.mockResolvedValue({ data: { count: 2, results: [
    { id: 'target', recruiter_name: 'Eligible member', role: 'MEMBER', status: 'ACTIVE' },
    { id: 'invited', recruiter_name: 'Invited member', role: 'MEMBER', status: 'INVITED' },
  ] } });
  mount();
  await screen.findByText('Eligible member · MEMBER · ACTIVE');
  expect(screen.queryByRole('button', { name: 'Transfer ownership to Invited member' })).not.toBeInTheDocument();
  if (role === 'ADMIN') {
    expect(screen.queryByRole('button', { name: 'Transfer ownership to Eligible member' })).not.toBeInTheDocument();
    return;
  }
  fireEvent.click(screen.getByRole('button', { name: 'Transfer ownership to Eligible member' }));
  expect(await screen.findByText(/You will become an ADMIN/)).toBeInTheDocument();
  http.patch.mockResolvedValue({ data: {} });
  jobsApi.recruiterCompanies.mockResolvedValue({ results: [{ id: 'company', role: 'ADMIN' }] });
  fireEvent.click(screen.getByRole('button', { name: 'Transfer ownership', exact: true }));
  await waitFor(() => expect(http.patch).toHaveBeenCalledWith('/companies/company/members/target/', { role: 'OWNER' }, expect.objectContaining({ _assertAuthority: expect.any(Function) })));
  await screen.findByText('Active membership · ADMIN');
  expect(screen.queryByRole('button', { name: 'Transfer ownership to Eligible member' })).not.toBeInTheDocument();
});
it('rejects a retained transfer confirmation after OWNER becomes ADMIN', async () => {
  jobsApi.company.mockResolvedValue({ name: 'Company' });
  jobsApi.recruiterCompanies.mockResolvedValue({ results: [{ id: 'company', role: 'OWNER' }] });
  http.get.mockResolvedValue({ data: [{ id: 'target', recruiter_name: 'Target', role: 'MEMBER', status: 'ACTIVE' }] });
  mount();
  await screen.findByRole('button', { name: 'Transfer ownership to Target' });
  const transfer = retained.memberActions.at(-1);
  // A failed mutation exposes retry; retry resolves a fresh, reduced membership.
  http.patch.mockRejectedValue(new Error('revoked'));
  const change = retained.memberActions.find((callback) => callback);
  await act(async () => change('ADMIN'));
  await screen.findByText('Request failed');
  jobsApi.recruiterCompanies.mockResolvedValue({ results: [{ id: 'company', role: 'ADMIN' }] });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Active membership · ADMIN');
  http.patch.mockClear();
  await act(async () => transfer());
  expect(http.patch).not.toHaveBeenCalled();
});
it('revalidates and hides management after a server permission revocation', async () => {
  await ownerPage();
  http.post.mockRejectedValue({ response: { status: 403 } });
  jobsApi.recruiterCompanies.mockResolvedValue({ results: [] });
  fireEvent.change(screen.getByLabelText('Recruiter account ID'), { target: { value: 'target' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add membership' }));
  await waitFor(() => expect(http.post).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByLabelText('name')).toBeDisabled());
  expect(screen.getByText('Request failed')).toBeInTheDocument();
  controlsAbsent();
});

it('does not revive retained membership actions after page 1 -> 2 -> 1', async () => {
  jobsApi.company.mockResolvedValue({ name: 'Company' });
  jobsApi.recruiterCompanies.mockResolvedValue({ results: [{ id: 'company', role: 'OWNER' }] });
  http.get.mockResolvedValue({ data: { count: 21, next: '/ignored', results: [
    { id: 'target', recruiter_name: 'Target', role: 'MEMBER', status: 'ACTIVE' },
  ] } });
  mount();
  await screen.findByRole('button', { name: 'Transfer ownership to Target' });
  const transfer = retained.memberActions.at(-1);
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByText('21 memberships · Page 2');
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
  await screen.findByText('21 memberships · Page 1');
  await act(async () => transfer());
  expect(http.patch).not.toHaveBeenCalled();
});
it('revokes queued membership transport authority when the editor unmounts', async () => {
  const view = await ownerPage();
  http.post.mockReturnValue(new Promise(() => {}));
  fireEvent.change(screen.getByLabelText('Recruiter account ID'), { target: { value: 'target' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add membership' }));
  await waitFor(() => expect(http.post).toHaveBeenCalled());
  const config = http.post.mock.calls[0][2];
  expect(config?._assertAuthority).toBeTypeOf('function');
  expect(() => config._assertAuthority()).not.toThrow();
  view.unmount();
  expect(() => config._assertAuthority()).toThrow();
});
