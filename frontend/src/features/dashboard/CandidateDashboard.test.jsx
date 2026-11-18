import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CandidateDashboard } from './CandidateDashboard.jsx';
import { http } from '../auth/api.js';
import { jobsApi } from '../jobs/services/api.js';
import { resumeApi } from '../resumes/api.js';
vi.mock('../auth/api.js', () => ({ http: { get: vi.fn() } }));
vi.mock('../jobs/services/api.js', () => ({ jobsApi: { applications: vi.fn(), list: vi.fn() }, apiMessage: () => 'Unable to load workspace' }));
vi.mock('../resumes/api.js', () => ({ resumeApi: { metadata: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('derives completion from actual fields including zero experience and renders actual recent applications', async () => {
  http.get.mockImplementation((url) => Promise.resolve(url.includes('/skills/') ? { data: { count: 0, results: [], next: null, previous: null } } : { data: { full_name: 'Casey', professional_headline: 'Engineer', country: 'GB', city: 'London', about: 'Developer', years_of_experience: 0 } }));
  jobsApi.list.mockResolvedValue({ results: [] });
  resumeApi.metadata.mockResolvedValue(null);
  jobsApi.applications.mockResolvedValue({ count: 24, next: 'page2', results: [{ id: 'one', status: 'SUBMITTED', applied_at: '2026-11-07T12:00:00Z', job: { title: 'Engineer', company: 'Example' } }] });
  render(<MemoryRouter><CandidateDashboard /></MemoryRouter>);
  expect(await screen.findByText('Welcome back, Casey 👋')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Find Your Next Opportunity' })).toBeInTheDocument();
  expect(screen.getByText('67%')).toBeInTheDocument();
  expect(screen.getByText('No resume uploaded yet.')).toBeInTheDocument();
  expect(screen.queryByText('Your developer profile')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Engineer/ })).toHaveAttribute('href', '/candidate/applications/one');
});
it('shows an actionable failure without fabricated statistics', async () => {
  jobsApi.list.mockResolvedValue({ results: [] }); http.get.mockRejectedValue(new Error('offline')); resumeApi.metadata.mockResolvedValue(null); jobsApi.applications.mockResolvedValue({ results: [] });
  render(<MemoryRouter><CandidateDashboard /></MemoryRouter>);
  expect(await screen.findByText('Unable to load workspace')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  expect(screen.queryByText('Applications')).not.toBeInTheDocument();
});
it('renders API job identity, skills and salary without fabricated jobs, bookmarks or experience years', async () => {
  http.get.mockImplementation((url) => Promise.resolve({ data: url.includes('/skills/') ? { count: 0, results: [], next: null, previous: null } : { full_name: 'Casey Developer' } }));
  resumeApi.metadata.mockResolvedValue(null); jobsApi.applications.mockResolvedValue({ results: [] });
  jobsApi.list.mockResolvedValue({ results: [{ id: 'published-job', title: 'Platform Developer', company: { name: 'Example Company' }, location: 'London', country: 'GB', workplace_type: 'REMOTE', experience_level: 'MID', skills: ['Python'], salary_min: '50000', salary_max: '70000', salary_currency: 'GBP' }] });
  render(<MemoryRouter><CandidateDashboard /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'Platform Developer' })).toHaveAttribute('href', '/jobs/published-job');
  expect(screen.getByText('Example Company')).toBeInTheDocument();
  expect(screen.getByText('GBP 50,000–70,000')).toBeInTheDocument();
  expect(screen.getByText('Python')).toBeInTheDocument();
  expect(screen.getByText('No applications yet.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /save|bookmark/i })).not.toBeInTheDocument();
});

it('requests only bounded previews and recognizes skills without traversing their collection', async () => {
  http.get.mockImplementation((url) => Promise.resolve({ data: url.includes('/skills/')
    ? { count: 101, results: [{ id: 'first', name: 'python' }], next: 'https://untrusted.invalid/', previous: null }
    : { full_name: 'Casey' } }));
  resumeApi.metadata.mockResolvedValue(null);
  jobsApi.applications.mockResolvedValue({ count: 200, results: [], next: 'more' });
  jobsApi.list.mockResolvedValue({ count: 500, results: [], next: 'more' });
  render(<MemoryRouter><CandidateDashboard /></MemoryRouter>);
  expect(await screen.findByText('Welcome back, Casey 👋')).toBeInTheDocument();
  expect(screen.getByText('22%')).toBeInTheDocument();
  expect(http.get).toHaveBeenCalledWith('/candidates/me/skills/', { params: { pagination: 'cursor', page_size: 1 } });
  expect(http.get.mock.calls.filter(([url]) => url.includes('/skills/'))).toHaveLength(1);
  expect(jobsApi.applications).toHaveBeenCalledWith({ pagination: 'cursor', page_size: 3 });
  expect(jobsApi.list).toHaveBeenCalledWith({ pagination: 'cursor', page_size: 3 });
});

it('discards a retired dashboard response after the next view has loaded', async () => {
  let resolveOld;
  http.get.mockImplementation((url) => Promise.resolve({ data: url.includes('/skills/') ? { results: [] } : { full_name: 'Current' } }));
  resumeApi.metadata.mockResolvedValue(null);
  jobsApi.applications.mockResolvedValue({ results: [] });
  jobsApi.list.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValue({ results: [{ id: 'current', title: 'Current job', company: { name: 'Current company' } }] });
  const old = render(<MemoryRouter><CandidateDashboard /></MemoryRouter>);
  old.unmount();
  render(<MemoryRouter><CandidateDashboard /></MemoryRouter>);
  expect(await screen.findByText('Current job')).toBeInTheDocument();
  const { act } = await import('@testing-library/react');
  await act(async () => resolveOld({ results: [{ id: 'old', title: 'Retired job', company: { name: 'Old company' } }] }));
  expect(screen.getByText('Current job')).toBeInTheDocument();
  expect(screen.queryByText('Retired job')).not.toBeInTheDocument();
});
