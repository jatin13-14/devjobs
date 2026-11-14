import { afterEach, expect, it, vi } from 'vitest';
import { http } from '../../auth/api.js';
import { jobsApi } from './api.js';

vi.mock('../../auth/api.js', () => ({ captureRequestOwnership: () => ({}), http: { get: vi.fn() } }));
afterEach(() => vi.restoreAllMocks());

it('finds protected company jobs beyond the first page without following arbitrary next URLs', async () => {
  const list = vi.spyOn(jobsApi, 'companyJobs')
    .mockResolvedValueOnce({ results: [{ id: 'first' }], next: 'https://untrusted.invalid/' })
    .mockResolvedValueOnce({ results: [{ id: 'target', status: 'DRAFT' }], next: null });
  expect(await jobsApi.companyJob('company', 'target')).toEqual({ id: 'target', status: 'DRAFT' });
  expect(list).toHaveBeenNthCalledWith(2, 'company', { page: 2 }, {});
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
