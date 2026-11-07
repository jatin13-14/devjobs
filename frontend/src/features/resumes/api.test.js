import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { http } from '../auth/api.js';
import { resumeApi } from './api.js';

const adapter = http.defaults.adapter;
beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { http.defaults.adapter = adapter; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('sends multipart bytes despite the shared JSON client default', async () => {
  const file = new File(['synthetic PDF'], 'resume.pdf', { type: 'application/pdf' });
  const transport = vi.fn(async (config) => ({ data: { resume: { size: file.size } }, status: 200, headers: {}, config }));
  http.defaults.adapter = transport;
  expect(await resumeApi.upload(file)).toEqual({ size: file.size });
  const config = transport.mock.calls[0][0];
  expect(config.method).toBe('put');
  expect(config.url).toBe('/candidates/me/resume/');
  expect(config.data).toBeInstanceOf(FormData);
  expect(config.data.get('file')).toBe(file);
  expect(config.headers.get('Content-Type')).not.toBe('application/json');
});

it('downloads authenticated blobs through the application scope and releases the browser URL', async () => {
  vi.useFakeTimers();
  const blob = new Blob(['synthetic'], { type: 'application/pdf' });
  const transport = vi.fn(async (config) => ({ data: blob, status: 200, headers: {}, config }));
  http.defaults.adapter = transport;
  window.localStorage.setItem('devjobs.auth', JSON.stringify({ access: 'synthetic-access', user: { id: 'synthetic' } }));
  const createObjectURL = vi.fn(() => 'blob:synthetic'); const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await resumeApi.applicantDownload('job-1', 'application-1');
  const config = transport.mock.calls[0][0];
  expect(config.url).toBe('/jobs/job-1/applications/application-1/resume/');
  expect(config.responseType).toBe('blob');
  expect(config.headers.get('Authorization')).toBe('Bearer synthetic-access');
  expect(createObjectURL).toHaveBeenCalledWith(blob);
  expect(click).toHaveBeenCalled();
  expect(document.querySelector('a[download="resume.pdf"]')).not.toBeInTheDocument();
  vi.runAllTimers();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:synthetic');
});
