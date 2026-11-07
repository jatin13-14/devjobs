import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext.jsx';
import { CompanyJobsPage, RecruiterApplicantsPage, RecruiterDashboardPage } from './RecruiterPages.jsx';
import { jobsApi } from '../services/api.js';

vi.mock('../services/api.js', () => ({ jobsApi: { recruiterProfile: vi.fn(), recruiterCompanies: vi.fn(), company: vi.fn(), companyJobs: vi.fn(), recruiterApplications: vi.fn(), recruiterApplication: vi.fn(), updateApplicationStatus: vi.fn() }, apiMessage: (error) => error.response?.data?.detail || 'Something went wrong. Please try again.' }));

afterEach(() => cleanup());

function mount(path, element) {
  window.localStorage.setItem('devjobs.auth', JSON.stringify({ access: 'token', refresh: 'refresh', user: { id: 'r1', email: 'recruiter@example.test', role: 'recruiter' } }));
  return render(<ConfigProvider><AuthProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/recruiter" element={element} /><Route path="/recruiter/jobs" element={element} /><Route path="/recruiter/jobs/:id/applicants" element={element} /></Routes></MemoryRouter></AuthProvider></ConfigProvider>);
}

function CompanyNavigation() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/recruiter/jobs?company=company-2')}>Switch company</button>;
}

describe('recruiter workspace', () => {
  beforeEach(() => { vi.clearAllMocks(); window.localStorage.clear(); });
  afterEach(() => cleanup());

  it('automatically selects a single company and shows its active role', async () => {
    jobsApi.recruiterProfile.mockResolvedValue({ name: 'Riley Recruiter' });
    jobsApi.recruiterCompanies.mockResolvedValue([{ id: 'company-1', name: 'Synthetic Labs', role: 'OWNER' }]);
    jobsApi.companyJobs.mockResolvedValue({ results: [] });
    mount('/recruiter', <RecruiterDashboardPage />);
    expect(await screen.findByText(/Welcome, Riley Recruiter/)).toBeInTheDocument();
    expect(await screen.findByText('Synthetic Labs')).toBeInTheDocument();
    expect(screen.getByText('Active membership · OWNER')).toBeInTheDocument();
    expect(screen.getByText('Create job')).toBeInTheDocument();
  });

  it('lets a recruiter choose among multiple companies and hides controls for MEMBER', async () => {
    jobsApi.recruiterProfile.mockResolvedValue({ name: 'Riley Recruiter' });
    jobsApi.recruiterCompanies.mockResolvedValue([{ id: 'company-1', name: 'Synthetic Labs', role: 'MEMBER' }, { id: 'company-2', name: 'Other Labs', role: 'ADMIN' }]);
    jobsApi.companyJobs.mockResolvedValue({ results: [] });
    mount('/recruiter?company=company-1', <RecruiterDashboardPage />);
    expect(await screen.findByText('Active membership · MEMBER')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Company' })).toBeInTheDocument();
    expect(screen.queryByText('Create job')).not.toBeInTheDocument();
  });

  it('shows an empty membership state', async () => {
    jobsApi.recruiterProfile.mockResolvedValue({ name: 'Riley Recruiter' });
    jobsApi.recruiterCompanies.mockResolvedValue([]);
    mount('/recruiter', <RecruiterDashboardPage />);
    expect(await screen.findByText(/no active company memberships/i)).toBeInTheDocument();
  });

  it('shows API errors for company job loading', async () => {
    jobsApi.companyJobs.mockRejectedValue({ response: { data: { detail: 'Forbidden' } } });
    mount('/recruiter/jobs?company=company-1', <CompanyJobsPage />);
    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
  });

  it('does not show stale jobs or membership controls after switching companies', async () => {
    let resolveFirst;
    let resolveSecond;
    jobsApi.companyJobs.mockImplementation((id) => new Promise((resolve) => {
      if (id === 'company-1') resolveFirst = resolve;
      else resolveSecond = resolve;
    }));
    window.localStorage.setItem('devjobs.auth', JSON.stringify({ access: 'token', refresh: 'refresh', user: { id: 'r1', email: 'recruiter@example.test', role: 'recruiter' } }));
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
    jobsApi.recruiterApplications.mockResolvedValue({ results: [{ id: 'app-1', status: 'SUBMITTED', candidate: { full_name: 'Taylor Candidate', professional_headline: 'Backend developer', skills: ['python'] } }], next: null });
    mount('/recruiter/jobs/job-1/applicants?company=company-1', <RecruiterApplicantsPage />);
    expect(await screen.findByText('Taylor Candidate')).toBeInTheDocument();
    expect(screen.getByText('Backend developer')).toBeInTheDocument();
    expect(screen.queryByText('taylor.private@example.test')).not.toBeInTheDocument();
  });
});

it('loads subsequent company job pages and returns to the first page', async () => {
  jobsApi.recruiterCompanies.mockResolvedValue([]);
  jobsApi.companyJobs.mockImplementation((_id, { page }) => Promise.resolve({ results: [{ id: `j${page}`, title: `Page ${page} job`, status: 'PUBLISHED' }], next: page === 1 ? 'next' : null, previous: page === 2 ? 'previous' : null }));
  mount('/recruiter/jobs?company=company-1', <CompanyJobsPage />);
  expect(await screen.findByText('Page 1 job')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(await screen.findByText('Page 2 job')).toBeInTheDocument();
  expect(screen.queryByText('Page 1 job')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
  expect(await screen.findByText('Page 1 job')).toBeInTheDocument();
});

it('resets company job pagination when a status filter changes', async () => {
  jobsApi.recruiterCompanies.mockResolvedValue([]);
  jobsApi.companyJobs.mockImplementation((_id, { page }) => Promise.resolve({ results: [], next: page === 1 ? 'next' : null, previous: page === 2 ? 'previous' : null }));
  mount('/recruiter/jobs?company=company-1', <CompanyJobsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Next page' }));
  await waitFor(() => expect(jobsApi.companyJobs).toHaveBeenCalledWith('company-1', { page: 2, status: undefined }));
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Job status' }));
  fireEvent.click(await screen.findByText('DRAFT', { selector: '.ant-select-item-option-content' }));
  await waitFor(() => expect(jobsApi.companyJobs).toHaveBeenCalledWith('company-1', { page: 1, status: 'DRAFT' }));
});
