export function loginDestination(user, from) {
  const fallback = user.is_platform_admin ? '/admin' : user.role === 'recruiter' ? '/recruiter' : '/candidate';
  const path = from?.pathname;
  if (typeof path !== 'string' || !path.startsWith('/') || /[\\?#\s%]/.test(path) || path.startsWith('//')
    || path.split('/').some((part) => part === '.' || part === '..')) return fallback;
  const allowed = path === '/' || (user.is_platform_admin ? path === '/admin'
    : path === `/${user.role}` || path.startsWith(`/${user.role}/`) || user.role === 'candidate' && /^\/jobs\/[^/]+\/apply$/.test(path));
  if (!allowed) return fallback;
  const search = typeof from.search === 'string' && from.search.startsWith('?') && !/[\r\n#]/.test(from.search) ? from.search : '';
  const hash = typeof from.hash === 'string' && from.hash.startsWith('#') && !/[\r\n]/.test(from.hash) ? from.hash : '';
  return { pathname: path, search, hash };
}
