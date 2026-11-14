import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { jobsApi, apiMessage } from '../jobs/services/api.js';

export function useCompanyMembership(companyId) {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({});
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  const userId = user?.id;
  const [selection, setSelection] = useState({ userId, companyId, revision });
  // Rotate identity during render, before children can observe old permissions.
  // Returning to the same company is a new resolution, never a cache hit.
  const changed = selection.userId !== userId || selection.companyId !== companyId || selection.revision !== revision;
  if (changed) setSelection({ userId, companyId, revision });
  useEffect(() => {
    if (!userId || !companyId) { setResult({}); return; }
    let live = true;
    const controller = new AbortController();
    jobsApi.recruiterCompanies({ companyId, signal: controller.signal }).then((data) => {
      if (live) setResult({ selection, status: data.results.length ? 'success' : 'empty', membership: data.results[0] || null });
    }).catch((error) => { if (live) setResult({ selection, status: 'error', error: apiMessage(error) }); });
    return () => { live = false; controller.abort(); };
  }, [companyId, userId, selection]);
  const current = !userId || !companyId ? { status: 'empty' } : !changed && result.selection === selection ? result : { status: 'loading' };
  return { ...current, loading: current.status === 'loading', canManage: current.status === 'success' && ['OWNER', 'ADMIN'].includes(current.membership?.role), retry };
}
