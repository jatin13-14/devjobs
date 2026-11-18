import { afterEach, expect, it, vi } from 'vitest';
import { http } from '../../auth/api.js';
import { jobsApi } from './api.js';

vi.mock('../../auth/api.js', () => ({ assertRequestOwnership: vi.fn(), captureRequestOwnership: () => ({}), http: { get: vi.fn() } }));
afterEach(() => vi.restoreAllMocks());

it('looks up protected jobs in one bounded company-scoped request', async () => {
  const list = vi.spyOn(jobsApi, 'companyJobs')
    .mockResolvedValueOnce({ results: [{ id: 'target', status: 'DRAFT' }], next: null });
  expect(await jobsApi.companyJob('company', 'target')).toEqual({ id: 'target', status: 'DRAFT' });
  expect(list).toHaveBeenCalledExactlyOnceWith('company', { job_id: 'target', pagination: 'cursor', page_size: 1 }, {});
});

it('rejects jobs absent from the authorized company collection', async () => {
  vi.spyOn(jobsApi, 'companyJobs').mockResolvedValue({ results: [], next: null });
  await expect(jobsApi.companyJob('company', 'foreign')).rejects.toThrow('not part of the selected company');
});


it('requests only approved company parameters on the configured API path and retains envelope/cancellation', async () => {
  const signal = new AbortController().signal;
  const data = { count: 30, next: 'https://untrusted.invalid/', previous: null, results: [] };
  http.get.mockResolvedValue({ data });
  expect(await jobsApi.recruiterCompanies({ page: 2, pageSize: 10, search: 'labs', companyId: 'synthetic', signal, next: data.next })).toBe(data);
  expect(http.get).toHaveBeenCalledWith('/recruiters/me/companies/', { params: { pagination: 'page', page: 2, page_size: 10, search: 'labs', company_id: 'synthetic' }, signal });
});

it('uses the fixed company overview endpoint with captured authority and local time zone', async () => {
  const ownership = { _assertAuthority: vi.fn(), signal: new AbortController().signal };
  const data = { total: 101, days: [], recent: [] };
  http.get.mockResolvedValue({ data });
  expect(await jobsApi.companyApplicationOverview('company', 'Asia/Kolkata', ownership)).toBe(data);
  expect(http.get).toHaveBeenCalledWith('/companies/company/application-overview/', { ...ownership, params: { time_zone: 'Asia/Kolkata' } });
});
