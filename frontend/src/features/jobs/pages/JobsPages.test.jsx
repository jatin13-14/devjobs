import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext.jsx';
import { JobSearchPage } from './JobSearchPage.jsx';
import { JobApplicationPage, JobDetailPage } from './JobDetailPage.jsx';
import { ApplicationDetailPage, ApplicationsPage } from './ApplicationsPage.jsx';
import { jobsApi } from '../services/api.js';

vi.mock('../services/api.js', () => ({ jobsApi: { list: vi.fn(), detail: vi.fn(), apply: vi.fn(), applications: vi.fn(), application: vi.fn(), withdraw: vi.fn() }, apiMessage: (error) => error.response?.data?.detail || error.response?.data?.job?.[0] || 'Something went wrong. Please try again.' }));
const job = { id: 'job-1', title: 'Senior React Engineer', company: { name: 'Acme' }, location: 'Remote', country: 'US', workplace_type: 'REMOTE', employment_type: 'FULL_TIME', experience_level: 'SENIOR', skills: ['react'], salary_min: '120000', salary_max: '150000', salary_currency: 'USD', description: 'Build useful tools.', published_at: '2026-10-01T00:00:00Z' };
const application = { id: 'app-1', job: { id: 'job-1', title: job.title, company: 'Acme' }, status: 'SUBMITTED', applied_at: '2026-10-03T00:00:00Z', cover_letter: 'I build React apps.' };
function renderRoute(path, element, initial = path) {
  return render(<ConfigProvider><AuthProvider><MemoryRouter initialEntries={[initial]}><Routes><Route path={path} element={element} /><Route path="/login" element={<p>Login destination</p>} /><Route path="/jobs/:id" element={<JobDetailPage />} /><Route path="/jobs/:id/apply" element={<JobApplicationPage />} /><Route path="/candidate/applications" element={<ApplicationsPage />} /><Route path="/candidate/applications/:applicationId" element={<ApplicationDetailPage />} /><Route path="/candidate" element={<p>Candidate destination</p>} /><Route path="/recruiter" element={<p>Recruiter destination</p>} /><Route path="*" element={<p>Not found</p>} /></Routes></MemoryRouter></AuthProvider></ConfigProvider>);
}
function setUser(role = 'candidate') { window.localStorage.setItem('devjobs.auth', JSON.stringify({ access: 'access', refresh: 'refresh', user: { id: 'u1', role } })); }
beforeEach(() => { vi.clearAllMocks(); window.localStorage.clear(); }); afterEach(cleanup);

describe('candidate job discovery and applications', () => {
  it('renders public jobs, searches title and description, filters and paginates', async () => {
    const user = userEvent.setup(); jobsApi.list.mockResolvedValue({ count: 21, results: [job] });
    renderRoute('/', <JobSearchPage />);
    expect(await screen.findByRole('heading', { name: job.title })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search jobs'), 'react');
    await waitFor(() => expect(jobsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'react' })), { timeout: 1500 });
    await user.type(screen.getByLabelText('Location'), 'Remote');
    await waitFor(() => expect(jobsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ location: 'Remote' })), { timeout: 1500 });
    const secondPage = await screen.findByTitle('2'); expect(secondPage).toBeInTheDocument(); await user.click(secondPage.querySelector('a'));
    await waitFor(() => expect(jobsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: '2' })), { timeout: 1500 });
  });
  it('shows loading, empty and error states', async () => {
    jobsApi.list.mockResolvedValueOnce({ count: 0, results: [] }); renderRoute('/', <JobSearchPage />);
    expect(await screen.findByText('No jobs match these filters.')).toBeInTheDocument(); cleanup();
    jobsApi.list.mockRejectedValueOnce(new Error('offline')); renderRoute('/', <JobSearchPage />);
    expect(await screen.findByText('Jobs could not be loaded. Please try again.')).toBeInTheDocument();
  });
  it('renders job detail and sends anonymous Apply to login', async () => {
    const user = userEvent.setup(); jobsApi.detail.mockResolvedValue(job); renderRoute('/jobs/:id', <JobDetailPage />, '/jobs/job-1');
    expect(await screen.findByText('Build useful tools.')).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Log in to apply' })); expect(await screen.findByText('Login destination')).toBeInTheDocument();
  });
  it('submits an optional cover letter and handles duplicate and closed jobs', async () => {
    const user = userEvent.setup(); setUser(); jobsApi.detail.mockResolvedValue(job); jobsApi.apply.mockResolvedValue(application); jobsApi.application.mockResolvedValue(application);
    renderRoute('/jobs/:id/apply', <JobApplicationPage />, '/jobs/job-1/apply');
    await user.type(await screen.findByLabelText(/Cover letter/), 'I build React apps.'); await user.click(screen.getByRole('button', { name: 'Submit application' }));
    await waitFor(() => expect(jobsApi.apply).toHaveBeenCalledWith('job-1', { cover_letter: 'I build React apps.' })); expect(await screen.findByText('APPLICATION DETAIL')).toBeInTheDocument();
    cleanup(); jobsApi.detail.mockResolvedValue(job); jobsApi.apply.mockRejectedValueOnce({ response: { data: { job: ['You have already applied to this job.'] } } });
    renderRoute('/jobs/:id/apply', <JobApplicationPage />, '/jobs/job-1/apply'); await user.click(await screen.findByRole('button', { name: 'Submit application' })); expect(await screen.findByText('You have already applied to this job.')).toBeInTheDocument();
  });
  it('lists application status and withdraws then refreshes', async () => {
    const user = userEvent.setup(); setUser(); jobsApi.applications.mockResolvedValue({ results: [application] }); jobsApi.withdraw.mockResolvedValue({ ...application, status: 'WITHDRAWN' });
    renderRoute('/candidate/applications', <ApplicationsPage />); expect(await screen.findByText('Submitted')).toBeInTheDocument(); await user.click(screen.getAllByRole('button', { name: 'Withdraw', exact: true })[0]); await user.click((await screen.findAllByRole('button', { name: 'Withdraw', exact: true })).at(-1));
    await waitFor(() => expect(jobsApi.withdraw).toHaveBeenCalledWith('app-1')); expect(jobsApi.applications).toHaveBeenCalledTimes(2);
  });
  it('shows application details and only offers withdrawal for active statuses', async () => {
    setUser(); jobsApi.application.mockResolvedValue(application); renderRoute('/candidate/applications/:applicationId', <ApplicationDetailPage />, '/candidate/applications/app-1');
    expect(await screen.findByText('I build React apps.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Withdraw application' })).toBeInTheDocument();
  });
});
