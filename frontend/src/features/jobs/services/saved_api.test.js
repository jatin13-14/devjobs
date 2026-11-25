import { afterEach, expect, it, vi } from 'vitest';
import { http } from '../../auth/api.js';
import { jobsApi } from './api.js';

vi.mock('../../auth/api.js', () => ({
  assertRequestOwnership: vi.fn(),
  captureRequestOwnership: vi.fn(),
  http: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
afterEach(() => vi.resetAllMocks());

it('fetches only the current candidate saved collection with ownership and pagination', async () => {
  const config = { signal: new AbortController().signal, _assertAuthority: vi.fn() };
  const data = { count: 0, next: null, previous: null, results: [] };
  http.get.mockResolvedValue({ data });
  expect(await jobsApi.savedJobs({ page: 2 }, config)).toBe(data);
  expect(http.get).toHaveBeenCalledWith('/candidates/me/saved-jobs/', {
    ...config,
    params: { page: 2 },
  });
});

it('reads private saved state and saves or removes only the given job', async () => {
  const config = { signal: new AbortController().signal };
  http.get.mockResolvedValue({ data: { saved: false } });
  http.put.mockResolvedValue({ data: { job: { id: 'job-id' } } });
  http.delete.mockResolvedValue({ status: 204 });

  expect(await jobsApi.savedJobStatus('job-id', config)).toEqual({ saved: false });
  expect(await jobsApi.saveJob('job-id', config)).toEqual({ job: { id: 'job-id' } });
  await jobsApi.unsaveJob('job-id', config);
  expect(http.get).toHaveBeenCalledWith('/candidates/me/saved-jobs/job-id/', config);
  expect(http.put).toHaveBeenCalledWith('/candidates/me/saved-jobs/job-id/', {}, config);
  expect(http.delete).toHaveBeenCalledWith('/candidates/me/saved-jobs/job-id/', config);
});

it('looks up multiple card statuses with repeated bounded job_id query keys', async () => {
  const config = { signal: new AbortController().signal, _assertAuthority: vi.fn() };
  const data = { saved_job_ids: ['first'] };
  http.get.mockResolvedValue({ data });
  expect(await jobsApi.savedJobStatuses(['first', 'second'], config)).toBe(data);
  const [path, options] = http.get.mock.calls[0];
  expect(path).toBe('/candidates/me/saved-jobs/statuses/');
  expect(options.signal).toBe(config.signal);
  expect(options._assertAuthority).toBe(config._assertAuthority);
  expect(options.params.toString()).toBe('job_id=first&job_id=second');
});
