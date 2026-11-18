import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecruiterOverview } from './RecruiterOverview.jsx';
import { jobsApi } from '../services/api.js';
vi.mock('../services/api.js', () => ({ jobsApi: { company: vi.fn(), companyApplicationOverview: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const summary = (name = 'Recent candidate') => ({ total: 400, submitted: 17, reviewing: 9, days: [{ date: '2026-03-08', count: 2 }], recent: [{ id: name, applied_at: '2026-03-08T12:00:00Z', candidate: { full_name: name }, job: { id: 'job', title: 'Engineer' } }] });
const selected = (id, role = 'OWNER') => ({ id, name: `Company ${id}`, role });
function content(company, authorization, extra = {}) {
  return <MemoryRouter><RecruiterOverview selected={company} authorization={authorization} activeJobs={240} profile={{ name: 'Recruiter' }} {...extra} /></MemoryRouter>;
}
it('renders company-wide totals and three-row summary without loading job/applicant pages', async () => {
  jobsApi.company.mockResolvedValue({}); jobsApi.companyApplicationOverview.mockResolvedValue(summary());
  const config = { _assertAuthority: vi.fn() };
  const authorization = { execute: vi.fn((work) => work(config)) };
  render(content(selected('a'), authorization));
  expect(await screen.findByText('Recent candidate')).toBeInTheDocument();
  for (const value of ['240', '400', '17', '9']) expect(screen.getByText(value)).toBeInTheDocument();
  expect(jobsApi.companyApplicationOverview).toHaveBeenCalledTimes(1);
  expect(jobsApi.companyApplicationOverview).toHaveBeenCalledWith('a', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', config);
  expect(screen.getByRole('link', { name: /Recent candidate/ })).toHaveAttribute('href', '/recruiter/jobs/job/applicants/Recent candidate?company=a');
});
it('never requests applicant data for MEMBER membership', async () => {
  jobsApi.company.mockResolvedValue({}); const authorization = { execute: vi.fn() };
  render(content(selected('a', 'MEMBER'), authorization));
  expect(await screen.findByText('Applicant activity requires an OWNER or ADMIN membership.')).toBeInTheDocument();
  expect(authorization.execute).not.toHaveBeenCalled();
  expect(jobsApi.companyApplicationOverview).not.toHaveBeenCalled();
  expect(screen.getByText('240')).toBeInTheDocument();
});
it('ignores obsolete summary success after company replacement', async () => {
  jobsApi.company.mockResolvedValue({}); let release;
  jobsApi.companyApplicationOverview.mockImplementation((id) => id === 'a' ? new Promise((resolve) => { release = resolve; }) : Promise.resolve(summary('Company B applicant')));
  const authorization = { execute: (work) => work({}) };
  const view = render(content(selected('a'), authorization));
  await act(async () => {});
  view.rerender(content(selected('b'), authorization));
  expect(await screen.findByText('Company B applicant')).toBeInTheDocument();
  await act(async () => { release(summary('Obsolete A applicant')); });
  expect(screen.queryByText('Obsolete A applicant')).not.toBeInTheDocument();
  expect(screen.getByText('Company B applicant')).toBeInTheDocument();
});
it('shows recovery after summary failure without presenting partial totals', async () => {
  jobsApi.company.mockResolvedValue({}); jobsApi.companyApplicationOverview.mockRejectedValue(new Error('offline'));
  const authorization = { execute: (work) => work({}) };
  render(content(selected('a'), authorization, { retry: vi.fn() }));
  expect(await screen.findByText('Application activity unavailable.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry activity' })).toBeInTheDocument();
  expect(screen.queryByText('400')).not.toBeInTheDocument();
});
it('ignores late summary failure after unmount', async () => {
  jobsApi.company.mockResolvedValue({}); let reject;
  jobsApi.companyApplicationOverview.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  const view = render(content(selected('a'), { execute: (work) => work({}) }));
  await act(async () => {});
  view.unmount();
  await act(async () => { reject(new Error('late')); });
  expect(screen.queryByText('Application activity unavailable.')).not.toBeInTheDocument();
});
