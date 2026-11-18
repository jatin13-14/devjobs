import { message } from 'antd';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { assertLogin, authApi, beginLogin, cancelLogin, commitLogin, ownRequests, sessionStore } from './api.js';
import { SessionExpiredError } from './sessionStore.js';
import { AuthContext } from './authContext.js';

function snapshot() { try { return sessionStore.read(); } catch { return null; } }
function SessionProvider({ record, children }) {
  const active = useRef(null);
  const [lifetime, setLifetime] = useState(null);
  useLayoutEffect(() => {
    const owner = { live: true, generation: 0, operation: null };
    active.current = owner;
    const permit = record?.credentials ? sessionStore.permit(record) : null;
    const release = ownRequests(permit);
    setLifetime(owner);
    return () => {
      owner.live = false;
      owner.generation += 1;
      cancelLogin(owner.operation);
      sessionStore.revoke(permit);
      release();
    };
    // Epoch transitions remount this component; refresh must retain its owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const value = useMemo(() => {
    const assertLifetime = () => {
      if (!lifetime?.live || active.current !== lifetime) throw new SessionExpiredError('Provider lifetime ended');
    };
    return {
      user: record?.credentials?.user ?? null,
      login: async (values) => {
        assertLifetime();
        const generation = ++lifetime.generation;
        cancelLogin(lifetime.operation);
        const validate = () => {
          assertLifetime();
          if (lifetime.generation !== generation) throw new SessionExpiredError('Login superseded');
        };
        const attempt = await beginLogin(validate);
        lifetime.operation = attempt;
        try {
          assertLogin(attempt);
          const result = await authApi.login(values, () => assertLogin(attempt));
          await commitLogin(attempt, { access: result.access, refresh: result.refresh, user: result.user });
          return result.user;
        } catch (error) {
          assertLogin(attempt);
          cancelLogin(attempt);
          throw error;
        }
      },
      logout: async () => {
        assertLifetime();
        cancelLogin(lifetime.operation);
        lifetime.generation += 1;
        const refresh = record?.credentials?.refresh;
        const result = await sessionStore.logout(record?.epoch ?? null, assertLifetime);
        if (refresh) {
          try {
            await authApi.logout(refresh);
          } catch {
            message.warning('Signed out on this device, but server logout could not be confirmed.');
          }
        }
        return result;
      },
    };
  }, [record, lifetime]);
  return <AuthContext.Provider value={value}>{lifetime?.live ? children : null}</AuthContext.Provider>;
}
export function AuthProvider({ children }) {
  const [record, setRecord] = useState(snapshot);
  useLayoutEffect(() => {
    const synchronize = () => setRecord(snapshot());
    const unsubscribe = sessionStore.subscribe(synchronize);
    synchronize();
    return unsubscribe;
  }, []);
  // Epoch changes remount private state, including logout/login as the same user.
  return <SessionProvider key={record?.credentials ? record.epoch : 'anonymous'} record={record}>{children}</SessionProvider>;
}
