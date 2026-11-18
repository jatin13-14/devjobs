import { expect, it } from 'vitest';
import { loginDestination } from './loginDestination.js';

it.each(['//evil.test', '/\\evil.test', 'https://evil.test', '/recruiter/../login', '/recruiter/%2e%2e/login', '/recruiter?next=//evil.test', '/candidate', '/administrator', '/recruiter\n/jobs'])('rejects unsafe or wrong-role destination %s', (pathname) => {
  expect(loginDestination({ role: 'recruiter' }, { pathname })).toBe('/recruiter');
});
it.each([
  [{ role: 'recruiter' }, '/recruiter/jobs'],
  [{ role: 'candidate' }, '/jobs/synthetic/apply'],
  [{ is_platform_admin: true }, '/admin'],
])('preserves local query and hash for %j', (user, pathname) => {
  expect(loginDestination(user, { pathname, search: '?company=synthetic&search=a%20b', hash: '#details' }))
    .toEqual({ pathname, search: '?company=synthetic&search=a%20b', hash: '#details' });
});
it('rejects admin prefix lookalikes', () => {
  expect(loginDestination({ is_platform_admin: true }, { pathname: '/admin-elsewhere' })).toBe('/admin');
});
