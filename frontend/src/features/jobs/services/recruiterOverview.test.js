import { describe, expect, it, vi } from 'vitest';
import { jobsApi } from './api.js';
import { loadCompanyApplications, summarizeApplications } from './recruiterOverview.js';
vi.mock('./api.js', () => ({ jobsApi: { recruiterApplications: vi.fn() } }));
describe('recruiter overview data', () => {
  it('traverses every job and applicant page and orders recent applicants', async () => {
    jobsApi.recruiterApplications.mockImplementation((id, page) => Promise.resolve({ results: [{ id: `${id}-${page}`, applied_at: `2026-11-0${page}T10:00:00Z` }], next: id === 'j1' && page === 1 ? 'next' : null }));
    const rows = await loadCompanyApplications([{ id: 'j1' }, { id: 'j2' }]);
    expect(rows.map((a) => a.id)).toEqual(['j1-2', 'j1-1', 'j2-1']);
    expect(jobsApi.recruiterApplications).toHaveBeenCalledWith('j1', 2);
  });
  it('counts statuses separately from daily submission activity including terminal applications', () => {
    const now = new Date(2026, 10, 8, 12);
    const applied_at = new Date(2026, 10, 8, 9).toISOString();
    const data = summarizeApplications([{ status: 'SUBMITTED', applied_at }, { status: 'WITHDRAWN', applied_at }, { status: 'REVIEWING', applied_at: new Date(2026, 9, 1).toISOString() }], now);
    expect(data.total).toBe(3); expect(data.submitted).toBe(1); expect(data.reviewing).toBe(1);
    expect(data.days.map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 0, 2]);
  });
  it('preserves zero values for a real empty response', () => {
    expect(summarizeApplications([]).total).toBe(0);
  });
});

it('uses local midnight boundaries across month changes and excludes future activity', () => {
  const now = new Date(2026, 2, 2, 12);
  const row = (date) => ({ status: 'SUBMITTED', applied_at: date.toISOString() });
  const summary = summarizeApplications([
    row(new Date(2026, 1, 23, 23, 59, 59)),
    row(new Date(2026, 1, 24)),
    row(new Date(2026, 2, 1, 23, 59, 59)),
    row(new Date(2026, 2, 2)),
    row(new Date(2026, 2, 3)),
  ], now);
  expect(summary.days.map((day) => day.count)).toEqual([1, 0, 0, 0, 0, 1, 1]);
  expect(summary.days.map((day) => day.date.getHours())).toEqual(Array(7).fill(0));
  expect(summary.total).toBe(5);
});

it('rejects partial activity when a later API page fails', async () => {
  jobsApi.recruiterApplications.mockImplementation((_id, page) => page === 1
    ? Promise.resolve({ results: [{ id: 'a1', applied_at: '2026-11-08T00:00:00Z' }], next: 'next' })
    : Promise.reject(new Error('Unavailable')));
  await expect(loadCompanyApplications([{ id: 'j1' }])).rejects.toThrow('Unavailable');
});
