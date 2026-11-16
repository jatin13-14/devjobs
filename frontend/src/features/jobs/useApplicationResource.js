import { useCallback, useEffect, useRef, useState } from 'react';
import { useViewAuthority } from '../auth/useViewAuthority.js';
import { SessionExpiredError } from '../auth/sessionStore.js';
import { apiMessage, jobsApi } from './services/api.js';

// A request owns every completion side effect, including errors and loading.
export function useApplicationResource(key, load) {
  const view = useViewAuthority(key);
  const active = useRef(null);
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const refresh = useCallback(async () => {
    if (!view.valid()) return;
    active.current?.controller.abort();
    const request = { controller: new AbortController(), view };
    active.current = request;
    const valid = () => active.current === request && view.valid() && !request.controller.signal.aborted;
    const config = {
      ...view.config,
      signal: request.controller.signal,
      _assertAuthority: () => { if (!valid()) throw new SessionExpiredError('Application request superseded'); },
    };
    setState({ loading: true, data: null, error: '' });
    try {
      const data = await load(config);
      if (valid()) setState({ loading: false, data, error: '' });
    } catch (error) {
      if (valid()) setState({ loading: false, data: null, error: apiMessage(error) });
    }
  }, [view, load]);
  useEffect(() => {
    refresh();
    return () => { if (active.current?.view === view) active.current.controller.abort(); };
  }, [refresh, view]);
  const request = active.current;
  const withdraw = async (id) => {
    const valid = () => view.valid() && active.current === request && !request?.controller.signal.aborted;
    if (!valid() || view.busy || state.loading) return;
    view.busy = true;
    try {
      await jobsApi.withdraw(id, { ...view.config, _assertAuthority: () => {
        if (!valid()) throw new SessionExpiredError('Application action superseded');
      } });
      if (valid()) await refresh();
    } catch (error) {
      if (valid()) setState((previous) => ({ ...previous, error: apiMessage(error) }));
    } finally { view.busy = false; }
  };
  return { ...(request?.view === view ? state : { loading: true, data: null, error: '' }), refresh, withdraw };
}
