import { expect, it } from 'vitest';
import { validateReadResponse } from './validateResponse.js';

it.each(['page', 'cursor'])('rejects legacy skills arrays when %s pagination was requested', (pagination) => {
  const response = { config: { method: 'get', url: '/candidates/me/skills/', params: { pagination } }, status: 200, data: [] };
  expect(() => validateReadResponse(response)).toThrow('invalid response');
});
it.each(['page', 'cursor'])('preserves valid %s collection envelopes', (pagination) => {
  const response = { config: { method: 'get', params: { pagination } }, status: 200, data: { results: [], next: null, ...(pagination === 'page' ? { count: 0, previous: null } : {}) } };
  expect(validateReadResponse(response)).toBe(response);
});

it.each([null, undefined, '<html>SPA fallback</html>', 42, {}, { results: null }, { count: 0 }])('rejects malformed root/collection payload %j where applicable', (data) => {
  const response = { config: { method: 'get' }, status: 200, data };
  if (data && typeof data === 'object' && Object.keys(data).length === 0) expect(validateReadResponse(response)).toBe(response);
  else expect(() => validateReadResponse(response)).toThrow('invalid response');
});
it.each([{ resume: null }, [], { results: [], count: 0 }, { title: 'Job' }])('preserves legitimate object, empty and legacy responses %j', (data) => {
  const response = { config: { method: 'get' }, status: 200, data };
  expect(validateReadResponse(response)).toBe(response);
});
it.each([{ method: 'get', responseType: 'blob' }, { method: 'delete' }])('preserves download and mutation bodies', (config) => {
  const response = { config, status: 204, data: null };
  expect(validateReadResponse(response)).toBe(response);
});
