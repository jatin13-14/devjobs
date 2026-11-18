import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useViewAuthority } from '../auth/useViewAuthority.js';
import { SessionExpiredError } from '../auth/sessionStore.js';
import { useAuth } from '../auth/useAuth.js';
import { jobsApi, apiMessage } from '../jobs/services/api.js';

export function useCompanyMembership(companyId) {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({});
  const active = useRef(null);
  const denied = useRef(false);
  const retry = useCallback(() => {
    if (active.current) active.current.live = false;
    setRevision((value) => value + 1);
  }, []);
  const userId = user?.id;
  const [selection, setSelection] = useState({ userId, companyId, revision });
  // Rotate identity during render, before children can observe old permissions.
  // Returning to the same company is a new resolution, never a cache hit.
  const changed = selection.userId !== userId || selection.companyId !== companyId || selection.revision !== revision;
  if (changed) setSelection({ userId, companyId, revision });
  const authority = useViewAuthority(selection);
  useLayoutEffect(() => { active.current = authority; }, [authority]);
  useLayoutEffect(() => { denied.current = false; }, [companyId, userId]);
  useEffect(() => {
    if (!userId || !companyId) { setResult({}); return; }
    let live = true;
    const controller = new AbortController();
    jobsApi.recruiterCompanies({ companyId, signal: controller.signal, ownership: authority.config }).then((data) => {
      if (live && authority.valid()) setResult({ selection, status: data.results.length ? 'success' : 'empty', membership: data.results[0] || null, resolvedAt: Date.now() });
    }).catch((error) => { if (live && authority.valid()) setResult({ selection, status: 'error', error: apiMessage(error) }); });
    return () => { live = false; controller.abort(); };
  }, [companyId, userId, selection, authority]);
  const current = !userId || !companyId ? { status: 'empty' } : !changed && result.selection === selection ? result : { status: 'loading' };
  // Visible workspaces revalidate at most every minute; returning to a tab
  // revalidates after a five-second freshness window. Errors require explicit retry.
  useEffect(() => {
    if (!['success', 'empty'].includes(current.status) || !companyId) return;
    const check = () => { if (document.visibilityState === 'visible' && authority.valid() && Date.now() - current.resolvedAt >= 5_000) retry(); };
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); };
  }, [current.status, current.resolvedAt, companyId, authority, retry]);
  const handleDenial = useCallback((error) => {
    if (!authority.valid() || error.response?.status !== 403) return;
    if (!denied.current) { denied.current = true; retry(); }
    else {
      authority.live = false;
      setResult({ selection, status: 'error', error: apiMessage(error) });
    }
  }, [authority, retry, selection]);
  const execute = useCallback(async (operation) => {
    const valid = () => authority.valid() && current.status === 'success' && ['OWNER', 'ADMIN'].includes(current.membership?.role);
    const assert = () => { if (!valid()) throw new SessionExpiredError('Company permissions changed'); };
    assert();
    try {
      const result = await operation({ ...authority.config, _assertAuthority: assert });
      assert();
      denied.current = false;
      return result;
    } catch (error) {
      handleDenial(error);
      throw error;
    }
  }, [authority, current.status, current.membership, handleDenial]);
  return { ...current, execute, handleDenial, loading: current.status === 'loading', canManage: current.status === 'success' && ['OWNER', 'ADMIN'].includes(current.membership?.role), retry };
}
