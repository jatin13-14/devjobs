// All participants must use this protocol. Legacy split records are deliberately
// not imported: an old tab cannot prove ownership of a versioned session.
export const sessionStorageKey = 'devjobs.auth.v2';
const lockName = 'devjobs.auth.v2';

export class SessionExpiredError extends Error {
  constructor(message = 'Authentication session changed') {
    super(message);
    this.name = 'CanceledError';
    this.code = 'ERR_CANCELED';
    this.sessionExpired = true;
  }
}

function validRecord(record) {
  return record?.schema === 1 && typeof record.epoch === 'string' && record.epoch.length > 0
    && Number.isSafeInteger(record.revision) && record.revision >= 1
    && (record.pendingLogin === null || typeof record.pendingLogin === 'string')
    && (record.credentials === null || (
      typeof record.credentials?.user?.id === 'string' && record.credentials.user.id.length > 0
      && typeof record.credentials.access === 'string' && record.credentials.access.length > 0
      && (record.credentials.refresh === undefined || typeof record.credentials.refresh === 'string')
    ));
}

// Factory also permits independent documents to be exercised against a shared
// storage/lock implementation without sharing process-local operation state.
class SessionPermit {}

export function createSessionStore({ storage, locks, events, randomUUID }) {
  const subscribers = new Set();
  const attempts = new WeakSet();
  const permits = new WeakMap();
  function read() {
    const raw = storage.getItem(sessionStorageKey);
    if (raw === null) return null;
    let record;
    try { record = JSON.parse(raw); } catch { throw new SessionExpiredError('Invalid authentication record'); }
    if (!validRecord(record)) throw new SessionExpiredError('Invalid authentication record');
    return record;
  }
  function epoch() { return read()?.epoch ?? null; }
  function assertEpoch(expected) {
    const current = read();
    if ((current?.epoch ?? null) !== expected) throw new SessionExpiredError();
    return current;
  }
  function coordinated(work, mode = 'exclusive') {
    if (typeof locks?.request !== 'function') return Promise.reject(new SessionExpiredError('Browser session locking unavailable'));
    return locks.request(lockName, { mode }, work);
  }
  function notify() { for (const subscriber of subscribers) subscriber(); }
  function persist(record) {
    if (!validRecord(record)) throw new SessionExpiredError('Invalid authentication record');
    storage.setItem(sessionStorageKey, JSON.stringify(record));
    notify();
    return record;
  }
  function replace(current, credentials) {
    return persist({ schema: 1, epoch: randomUUID(), revision: (current?.revision ?? 0) + 1, credentials, pendingLogin: null });
  }
  function storageChanged(event) {
    if (event.key === null || event.key === sessionStorageKey) notify();
  }
  function assertAttempt(attempt) {
    if (!attempts.has(attempt) || !attempt.live) throw new SessionExpiredError('Login operation invalidated');
    attempt.validate();
    const current = assertEpoch(attempt.epoch);
    if (current?.pendingLogin !== attempt.id) throw new SessionExpiredError('Login operation invalidated');
    return current;
  }
  function assertPermit(permit) {
    const identity = permits.get(permit);
    if (!identity?.live) throw new SessionExpiredError();
    const current = assertEpoch(identity.epoch);
    if (!current?.credentials || current.credentials.user.id !== identity.userId) throw new SessionExpiredError();
    return current;
  }
  return {
    read,
    epoch,
    subscribe(subscriber) {
      if (!subscribers.size) events.addEventListener('storage', storageChanged);
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
        if (!subscribers.size) events.removeEventListener('storage', storageChanged);
      };
    },
    async beginLogin(validate = () => {}) {
      validate();
      const expected = epoch();
      const attempt = { epoch: null, id: randomUUID(), live: true, validate };
      attempts.add(attempt);
      await coordinated(() => {
        validate();
        const current = assertEpoch(expected);
        const next = persist({ schema: 1, epoch: current?.epoch ?? randomUUID(), revision: current?.revision ?? 1, credentials: current?.credentials ?? null, pendingLogin: attempt.id });
        attempt.epoch = next.epoch;
      });
      return attempt;
    },
    assertAttempt,
    cancelLogin(attempt) { if (attempts.has(attempt)) attempt.live = false; },
    commitLogin(attempt, credentials) {
      return coordinated(() => {
        const current = assertAttempt(attempt);
        const next = replace(current, credentials);
        attempt.live = false;
        return next;
      });
    },
    logout(expected = epoch(), validate = () => {}) {
      validate();
      return coordinated(() => { validate(); return replace(assertEpoch(expected), null); });
    },
    permit(record) {
      const current = assertEpoch(record?.epoch ?? null);
      if (!current?.credentials || current.credentials.user.id !== record?.credentials?.user?.id) throw new SessionExpiredError();
      const permit = Object.freeze(new SessionPermit());
      permits.set(permit, { epoch: current.epoch, userId: current.credentials.user.id, live: true });
      return permit;
    },
    revoke(permit) { const identity = permits.get(permit); if (identity) identity.live = false; },
    assertPermit,
    dispatch(permit, transport) {
      assertPermit(permit);
      // The transport starts while a shared lock excludes credential commits.
      // Its response must not retain the lock (refresh needs an exclusive lock).
      return coordinated(() => ({ response: transport(assertPermit(permit).credentials) }), 'shared')
        .then(({ response }) => response);
    },
    refresh(permit, expectedRevision, credentials) {
      return coordinated(() => {
        const current = assertPermit(permit);
        if (current.revision !== expectedRevision) throw new SessionExpiredError('Refresh result superseded');
        return persist({ ...current, revision: current.revision + 1, credentials: { ...current.credentials, ...credentials } });
      });
    },
    expire(permit, expectedRevision) {
      return coordinated(() => {
        const current = assertPermit(permit);
        if (current.revision !== expectedRevision) throw new SessionExpiredError('Refresh result superseded');
        return replace(current, null);
      });
    },
  };
}
