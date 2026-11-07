import { useEffect, useMemo, useState } from 'react';
import { authApi, readAuth, writeAuth } from './api.js';
import { AuthContext } from './authContext.js';

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readAuth);
  useEffect(() => {
    const logout = () => setAuth(null);
    window.addEventListener('devjobs:logout', logout);
    return () => window.removeEventListener('devjobs:logout', logout);
  }, []);
  const value = useMemo(() => ({
    user: auth?.user || null,
    login: async (values) => { const result = await authApi.login(values); const next = { access: result.access, refresh: result.refresh, user: result.user }; writeAuth(next); setAuth(next); return result.user; },
    logout: () => { writeAuth(null); setAuth(null); },
  }), [auth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
