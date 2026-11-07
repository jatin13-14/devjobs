import { afterEach, expect, it, vi } from 'vitest';
import { jobsApi } from './api.js';

vi.mock('../../auth/api.js', () => ({ http: {} }));
afterEach(() => vi.restoreAllMocks());

it('finds protected company jobs beyond the first page without following arbitrary next URLs', async () => {
  const list = vi.spyOn(jobsApi, 'companyJobs')
    .mockResolvedValueOnce({ results: [{ id: 'first' }], next: 'https://untrusted.invalid/' })
    .mockResolvedValueOnce({ results: [{ id: 'target', status: 'DRAFT' }], next: null });
  expect(await jobsApi.companyJob('company', 'target')).toEqual({ id: 'target', status: 'DRAFT' });
  expect(list).toHaveBeenNthCalledWith(2, 'company', { page: 2 });
});

it('rejects jobs absent from the authorized company collection', async () => {
  vi.spyOn(jobsApi, 'companyJobs').mockResolvedValue({ results: [], next: null });
  await expect(jobsApi.companyJob('company', 'foreign')).rejects.toThrow('not part of the selected company');
});
