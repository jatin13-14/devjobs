import { useLayoutEffect, useMemo } from 'react';
import { assertRequestOwnership, captureRequestOwnership } from './api.js';
import { SessionExpiredError } from './sessionStore.js';

// Capture once per view lifetime, never when a retained action is invoked.
// The canonical Axios boundary checks this same permit at dispatch and retry.
export function useViewAuthority(key) {
  const view = useMemo(() => ({ key, live: false, busy: false, config: null, valid: () => false }), [key]);
  useLayoutEffect(() => {
    const controller = new AbortController();
    let live = true;
    view.live = true;
    let ownership;
    try { ownership = captureRequestOwnership(); } catch { live = false; view.live = false; }
    const valid = () => {
      if (!live || !view.live) return false;
      try { assertRequestOwnership(ownership); return true; } catch { return false; }
    };
    const assert = () => {
      if (!valid()) throw new SessionExpiredError('View or session lifetime ended');
    };
    view.valid = valid;
    view.config = { ...ownership, signal: controller.signal, _assertAuthority: assert };
    return () => { live = false; view.live = false; controller.abort(); };
  }, [view]);
  return view;
}
