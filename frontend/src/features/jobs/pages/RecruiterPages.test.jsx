import { writeAuth } from '../../auth/api.js';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext.jsx';
import { AuthContext } from '../../auth/authContext.js';
import { CompanyJobsPage, JobEditorPage, RecruiterJobDetailPage, RecruiterApplicantDetailPage, RecruiterApplicantsPage, RecruiterDashboardPage } from './RecruiterPages.jsx';
import { jobsApi } from '../services/api.js';

vi.mock('../services/api.js', () => ({ jobsApi: { recruiterProfile: vi.fn(), recruiterCompanies: vi.fn(), company: vi.fn(), companyJobs: vi.fn(), companyJob: vi.fn(), updateJob: vi.fn(), publishJob: vi.fn(), closeJob: vi.fn(), recruiterApplications: vi.fn(), recruiterApplication: vi.fn(), updateApplicationStatus: vi.fn() }, apiMessage: (error) => error.response?.data?.detail || 'Something went wrong. Please try again.' }));

it('does not reveal the previous user’s company jobs after an unaffiliated identity resolves', async () => {
  vi.resetAllMocks();
  let resolveMembership;
  jobsApi.recruiterCompanies.mockResolvedValueOnce({ count: 1, results: [{ id: 'company-1', role: 'OWNER' }] })
    .mockImplementation(() => new Promise((resolve) => { resolveMembership = resolve; }));
  jobsApi.companyJobs.mockResolvedValueOnce({ results: [{ id: 'private-job', title: 'Previous user private draft', status: 'DRAFT' }] })
    .mockRejectedValue({ response: { data: { detail: 'Forbidden' } } });
  const view = (id) => <ConfigProvider><AuthContext.Provider value={{ user: { id } }}><MemoryRouter initialEntries={['/recruiter/jobs?company=company-1']}><CompanyJobsPage /></MemoryRouter></AuthContext.Provider></ConfigProvider>;
  const { rerender } = render(view('owner'));
  expect(await screen.findByText('Previous user private draft')).toBeInTheDocument();
  rerender(view('unaffiliated'));
  expect(screen.queryByText('Previous user private draft')).not.toBeInTheDocument();
  await waitFor(() => expect(resolveMembership).toBeTypeOf('function'));
  await act(async () => resolveMembership({ count: 0, results: [] }));
  expect(screen.queryByText('Previous user private draft')).not.toBeInTheDocument();
});

afterEach(() => cleanup());

async function mount(path, element) {
  await writeAuth({ access: 'token', refresh: 'refresh', user: { id: 'r1', email: 'recruiter@example.test', role: 'recruiter' } });
  return render(<ConfigProvider><AuthProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/recruiter" element={element} /><Route path="/recruiter/jobs" element={element} /><Route path="/recruiter/jobs/:id/applicants" element={element} /></Routes></MemoryRouter></AuthProvider></ConfigProvider>);
}

function CompanyNavigation() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/recruiter/jobs?company=company-2')}>Switch company</button>;
}

describe('recruiter workspace', () => {
  beforeEach(async () => { vi.clearAllMocks(); window.localStorage.clear(); });
  afterEach(() => cleanup());

  it('automatically selects a single company and shows its active role', async () => {
    jobsApi.recruiterProfile.mockResolvedValue({ name: 'Riley Recruiter' });
    jobsApi.recruiterCompanies.mockResolvedValue({ count: 1, results: [{ id: 'company-1', name: 'Synthetic Labs', role: 'OWNER' }] });
    jobsApi.companyJobs.mockResolvedValue({ results: [] });
    jobsApi.company.mockResolvedValue({});
    await mount('/recruiter', <RecruiterDashboardPage />);
    await waitFor(() => expect(jobsApi.companyJobs).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('heading', { name: 'Recruiter Workspace' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Synthetic Labs')).toBeInTheDocument());
    expect(screen.getByText('Active membership · OWNER')).toBeInTheDocument();
    expect(screen.getByText('Post a Job')).toBeInTheDocument();
  });

  it('lets a recruiter choose among multiple companies and hides controls for MEMBER', async () => {
    jobsApi.recruiterProfile.mockResolvedValue({ name: 'Riley Recruiter' });
    jobsApi.recruiterCompanies.mockResolvedValue({ count: 2, results: [{ id: 'company-1', name: 'Synthetic Labs', role: 'MEMBER' }, { id: 'company-2', name: 'Other Labs', role: 'ADMIN' }] });
    jobsApi.companyJobs.mockResolvedValue({ results: [] });
    jobsApi.company.mockResolvedValue({});
    await mount('/recruiter?company=company-1', <RecruiterDashboardPage />);
    expect(await screen.findByText('Active membership · MEMBER')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Company' })).toBeInTheDocument();
    expect(screen.queryByText('Post a Job')).not.toBeInTheDocument();
    expect(jobsApi.recruiterApplications).not.toHaveBeenCalled();
  });

  it('shows an empty membership state', async () => {
    jobsApi.recruiterProfile.mockResolvedValue({ name: 'Riley Recruiter' });
    jobsApi.recruiterCompanies.mockResolvedValue({ count: 0, results: [] });
    await mount('/recruiter', <RecruiterDashboardPage />);
    expect(await screen.findByText(/no active company memberships/i)).toBeInTheDocument();
  });

  it('shows API errors for company job loading', async () => {
    jobsApi.companyJobs.mockRejectedValue({ response: { data: { detail: 'Forbidden' } } });
    await mount('/recruiter/jobs?company=company-1', <CompanyJobsPage />);
    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
  });

  it('does not show stale jobs or membership controls after switching companies', async () => {
    let resolveFirst;
    let resolveSecond;
    jobsApi.companyJobs.mockImplementation((id) => new Promise((resolve) => {
      if (id === 'company-1') resolveFirst = resolve;
      else resolveSecond = resolve;
    }));
    await writeAuth({ access: 'token', refresh: 'refresh', user: { id: 'r1', email: 'recruiter@example.test', role: 'recruiter' } });
    render(<ConfigProvider><AuthProvider><MemoryRouter initialEntries={['/recruiter/jobs?company=company-1']}><CompanyNavigation /><Routes><Route path="/recruiter/jobs" element={<CompanyJobsPage />} /></Routes></MemoryRouter></AuthProvider></ConfigProvider>);
    await waitFor(() => expect(jobsApi.companyJobs).toHaveBeenCalledWith('company-1', { page: 1, status: undefined }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch company' }));
    await waitFor(() => expect(jobsApi.companyJobs).toHaveBeenCalledWith('company-2', { page: 1, status: undefined }));
    resolveSecond({ results: [{ id: 'job-2', title: 'Company Two Role', status: 'DRAFT' }] });
    expect(await screen.findByText('Company Two Role')).toBeInTheDocument();
    resolveFirst({ results: [{ id: 'job-1', title: 'Stale Company One Role', status: 'DRAFT' }] });
    await waitFor(() => expect(screen.queryByText('Stale Company One Role')).not.toBeInTheDocument());
  });

  it('renders privacy-safe candidate fields and available status choices', async () => {
    jobsApi.recruiterCompanies.mockResolvedValue({ results: [{ id: 'company-1', role: 'OWNER' }] });
    jobsApi.recruiterApplications.mockResolvedValue({ results: [{ id: 'app-1', status: 'SUBMITTED', candidate: { full_name: 'Taylor Candidate', professional_headline: 'Backend developer', skills: ['python'] } }], next: null });
    await mount('/recruiter/jobs/job-1/applicants?company=company-1', <RecruiterApplicantsPage />);
    expect(await screen.findByText('Taylor Candidate')).toBeInTheDocument();
    expect(screen.getByText('Backend developer')).toBeInTheDocument();
    expect(screen.queryByText('taylor.private@example.test')).not.toBeInTheDocument();
  });
});

it('loads subsequent company job pages and returns to the first page', async () => {
  jobsApi.recruiterCompanies.mockResolvedValue({ count: 0, results: [] });
  jobsApi.companyJobs.mockImplementation((_id, { page }) => Promise.resolve({ results: [{ id: `j${page}`, title: `Page ${page} job`, status: 'PUBLISHED' }], next: page === 1 ? 'next' : null, previous: page === 2 ? 'previous' : null }));
  await mount('/recruiter/jobs?company=company-1', <CompanyJobsPage />);
  expect(await screen.findByText('Page 1 job')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(await screen.findByText('Page 2 job')).toBeInTheDocument();
  expect(screen.queryByText('Page 1 job')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
  expect(await screen.findByText('Page 1 job')).toBeInTheDocument();
});

it('resets company job pagination when a status filter changes', async () => {
  jobsApi.recruiterCompanies.mockResolvedValue({ count: 0, results: [] });
  jobsApi.companyJobs.mockImplementation((_id, { page }) => Promise.resolve({ results: [], next: page === 1 ? 'next' : null, previous: page === 2 ? 'previous' : null }));
  await mount('/recruiter/jobs?company=company-1', <CompanyJobsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Next page' }));
  await waitFor(() => expect(jobsApi.companyJobs).toHaveBeenCalledWith('company-1', { page: 2, status: undefined }));
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Job status' }));
  fireEvent.click(await screen.findByText('DRAFT', { selector: '.ant-select-item-option-content' }));
  await waitFor(() => expect(jobsApi.companyJobs).toHaveBeenCalledWith('company-1', { page: 1, status: 'DRAFT' }));
});

it('uses total count rather than loaded page length and preserves an explicit company beyond page one', async () => {
  vi.clearAllMocks();
  jobsApi.recruiterProfile.mockResolvedValue({ name: 'Synthetic recruiter' });
  jobsApi.recruiterCompanies.mockImplementation((params) => Promise.resolve(params?.companyId ? { count: 1, results: [{ id: params.companyId, name: 'Beyond first page', role: 'ADMIN' }] } : { count: 30, results: [{ id: 'first', name: 'First page', role: 'OWNER' }] }));
  jobsApi.companyJobs.mockResolvedValue({ results: [] });
  await mount('/recruiter?company=last', <RecruiterDashboardPage />);
  expect(await screen.findByText('Active membership · ADMIN')).toBeInTheDocument();
  expect(jobsApi.companyJobs).toHaveBeenCalledWith('last');
  expect(jobsApi.companyJobs).not.toHaveBeenCalledWith('first');
  expect(screen.getByRole('combobox', { name: 'Company' })).toBeInTheDocument();
});

it('does not auto-select a one-item page when total count is greater than one', async () => {
  vi.clearAllMocks();
  jobsApi.recruiterProfile.mockResolvedValue({ name: 'Synthetic recruiter' });
  jobsApi.recruiterCompanies.mockResolvedValue({ count: 30, results: [{ id: 'first', name: 'First page', role: 'OWNER' }] });
  await mount('/recruiter', <RecruiterDashboardPage />);
  expect(await screen.findByRole('combobox', { name: 'Company' })).toBeInTheDocument();
  expect(jobsApi.companyJobs).not.toHaveBeenCalled();
});


it('keeps actual job management controls hidden until current membership resolves', async () => {
  vi.clearAllMocks();
  let resolveMembership;
  jobsApi.recruiterCompanies.mockImplementation(() => new Promise((resolve) => { resolveMembership = resolve; }));
  jobsApi.companyJobs.mockResolvedValue({ results: [{ id: 'j1', title: 'Current job', status: 'DRAFT' }] });
  await mount('/recruiter/jobs?company=company-1', <CompanyJobsPage />);
  await waitFor(() => expect(resolveMembership).toBeTypeOf('function'));
  expect(jobsApi.companyJobs).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Create job' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Applicants' })).not.toBeInTheDocument();
  await act(async () => resolveMembership({ count: 1, results: [{ id: 'company-1', role: 'OWNER' }] }));
  expect(await screen.findByRole('button', { name: 'Create job' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Applicants' })).toBeInTheDocument();
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const membership = (role) => ({ results: role ? [{ id: 'company-1', role }] : [] });
const draft = (title = 'Private draft') => ({ id: 'job-1', title, status: 'DRAFT', description: 'Private description' });
function identityView(userId, element = <CompanyJobsPage />) {
  return <StrictMode><ConfigProvider><AuthContext.Provider value={{ user: userId ? { id: userId } : null }}><MemoryRouter initialEntries={['/recruiter/jobs/job-1?company=company-1']}>{element}</MemoryRouter></AuthContext.Provider></ConfigProvider></StrictMode>;
}

describe('identity-owned recruiter job data', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(['MEMBER', 'ADMIN', null])('refetches after OWNER changes to %s with no private render while pending', async (role) => {
    jobsApi.recruiterCompanies.mockResolvedValue(membership('OWNER'));
    jobsApi.companyJobs.mockResolvedValue({ results: [draft()] });
    const { rerender } = render(identityView('owner'));
    await screen.findByText('Private draft');
    const lookup = deferred(); const jobs = deferred();
    jobsApi.recruiterCompanies.mockReturnValue(lookup.promise); jobsApi.companyJobs.mockReturnValue(jobs.promise);
    const before = jobsApi.companyJobs.mock.calls.length;
    rerender(identityView('next-user'));
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    expect(jobsApi.companyJobs).toHaveBeenCalledTimes(before);
    await act(async () => lookup.resolve(membership(role)));
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    await waitFor(() => expect(jobsApi.companyJobs.mock.calls.length).toBeGreaterThan(before));
    await act(async () => jobs.resolve({ results: [role === 'ADMIN' ? draft('Fresh admin draft') : { id: 'public', title: 'Fresh public role', status: 'PUBLISHED' }] }));
    expect(await screen.findByText(role === 'ADMIN' ? 'Fresh admin draft' : 'Fresh public role')).toBeInTheDocument();
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    expect(Boolean(screen.queryByRole('button', { name: 'Create job' }))).toBe(role === 'ADMIN');
  });

  it('keeps jobs absent on membership failure, retry and job-fetch failure', async () => {
    jobsApi.recruiterCompanies.mockResolvedValue(membership('OWNER')); jobsApi.companyJobs.mockResolvedValue({ results: [draft()] });
    const { rerender } = render(identityView('owner')); await screen.findByText('Private draft');
    const lookup = deferred(); jobsApi.recruiterCompanies.mockReturnValue(lookup.promise);
    rerender(identityView('other'));
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    await act(async () => lookup.reject(new Error('Offline')));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    const jobs = deferred(); jobsApi.recruiterCompanies.mockResolvedValue(membership('OWNER')); jobsApi.companyJobs.mockReturnValue(jobs.promise);
    const before = jobsApi.companyJobs.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(jobsApi.companyJobs.mock.calls.length).toBeGreaterThan(before));
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    await act(async () => jobs.reject({ response: { data: { detail: 'Jobs unavailable' } } }));
    expect(await screen.findByText('Jobs unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
  });

  it('requires fresh jobs on OWNER → MEMBER → OWNER and ignores old-user responses', async () => {
    jobsApi.recruiterCompanies.mockResolvedValue(membership('OWNER')); jobsApi.companyJobs.mockResolvedValue({ results: [draft()] });
    const { rerender } = render(identityView('A')); await screen.findByText('Private draft');
    const old = deferred(); jobsApi.recruiterCompanies.mockResolvedValue(membership('MEMBER')); jobsApi.companyJobs.mockReturnValue(old.promise);
    const before = jobsApi.companyJobs.mock.calls.length;
    rerender(identityView('B'));
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    await waitFor(() => expect(jobsApi.companyJobs.mock.calls.length).toBeGreaterThan(before));
    const lookup = deferred(), fresh = deferred(); jobsApi.recruiterCompanies.mockReturnValue(lookup.promise); jobsApi.companyJobs.mockReturnValue(fresh.promise);
    rerender(identityView('A'));
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    await act(async () => old.resolve({ results: [draft('Obsolete B draft')] }));
    expect(screen.queryByText('Obsolete B draft')).not.toBeInTheDocument();
    await act(async () => lookup.resolve(membership('OWNER')));
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    await act(async () => fresh.resolve({ results: [draft('Reauthorized A draft')] }));
    expect(await screen.findByText('Reauthorized A draft')).toBeInTheDocument();
  });

  it.each([false, true])('invalidates logout with pending jobs=%s and ignores late completion', async (pending) => {
    jobsApi.recruiterCompanies.mockResolvedValue(membership('OWNER')); const old = deferred();
    jobsApi.companyJobs.mockReturnValue(pending ? old.promise : Promise.resolve({ results: [draft()] }));
    const { rerender } = render(identityView('owner'));
    if (pending) await waitFor(() => expect(jobsApi.companyJobs).toHaveBeenCalled()); else await screen.findByText('Private draft');
    rerender(identityView(null));
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    await act(async () => old.resolve({ results: [draft('Late logout draft')] }));
    expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    expect(screen.queryByText('Late logout draft')).not.toBeInTheDocument();
    expect(screen.getByText('Sign in to view this workspace.')).toBeInTheDocument();
  });

  it('requires fresh data on company A → B → A and rejects late company responses', async () => {
    jobsApi.recruiterCompanies.mockImplementation(({ companyId }) => Promise.resolve({ results: [{ id: companyId, role: 'OWNER' }] }));
    jobsApi.companyJobs.mockResolvedValue({ results: [draft()] });
    function Navigation() { const navigate = useNavigate(); return <><button onClick={() => navigate('/recruiter/jobs?company=company-2')}>Company B</button><button onClick={() => navigate('/recruiter/jobs?company=company-1')}>Company A</button><CompanyJobsPage /></>; }
    render(identityView('owner', <Navigation />)); await screen.findByText('Private draft');
    const old = deferred(); jobsApi.companyJobs.mockReturnValue(old.promise);
    fireEvent.click(screen.getByText('Company B')); expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    await waitFor(() => expect(jobsApi.companyJobs).toHaveBeenLastCalledWith('company-2', { page: 1, status: undefined }));
    const fresh = deferred(); jobsApi.companyJobs.mockReturnValue(fresh.promise);
    fireEvent.click(screen.getByText('Company A')); expect(screen.queryByText('Private draft')).not.toBeInTheDocument();
    await waitFor(() => expect(jobsApi.companyJobs).toHaveBeenLastCalledWith('company-1', { page: 1, status: undefined }));
    await act(async () => fresh.resolve({ results: [draft('Fresh company A')] })); await screen.findByText('Fresh company A');
    await act(async () => old.resolve({ results: [draft('Late company B')] }));
    expect(screen.queryByText('Late company B')).not.toBeInTheDocument(); expect(screen.getByText('Fresh company A')).toBeInTheDocument();
  });

  it.each(['detail', 'editor', 'applicants', 'applicant'])('discards %s private data on an unchanged route after identity changes', async (type) => {
    jobsApi.recruiterCompanies.mockResolvedValue(membership('OWNER')); jobsApi.companyJob.mockResolvedValue(draft());
    jobsApi.recruiterApplications.mockResolvedValue({ results: [{ id: 'app', status: 'SUBMITTED', candidate: { full_name: 'Private candidate' } }] });
    jobsApi.recruiterApplication.mockResolvedValue({ status: 'SUBMITTED', candidate: { full_name: 'Private candidate' } });
    const element = { detail: <RecruiterJobDetailPage />, editor: <JobEditorPage />, applicants: <RecruiterApplicantsPage />, applicant: <RecruiterApplicantDetailPage /> }[type];
    const route = <Routes><Route path="/recruiter/jobs/:id" element={element} /></Routes>;
    const { rerender } = render(identityView('owner', route));
    if (type === 'editor') await screen.findByDisplayValue('Private draft'); else await screen.findByText(type === 'detail' ? 'Private draft' : 'Private candidate');
    const lookup = deferred(); jobsApi.recruiterCompanies.mockReturnValue(lookup.promise); jobsApi.companyJob.mockRejectedValue(new Error('No current public job'));
    rerender(identityView('other', route));
    const absent = () => { expect(screen.queryByText('Private draft')).not.toBeInTheDocument(); expect(screen.queryByDisplayValue('Private draft')).not.toBeInTheDocument(); expect(screen.queryByText('Private candidate')).not.toBeInTheDocument(); };
    absent(); await act(async () => lookup.resolve(membership(null))); absent();
  });
});
