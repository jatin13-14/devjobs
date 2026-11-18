import { describe, expect, it, vi } from 'vitest';
import { createSessionStore, sessionStorageKey } from './sessionStore.js';

const credentials = (id) => ({ user: { id, role: 'recruiter' }, access: `${id}-access`, refresh: `${id}-refresh` });
function documents() {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  // A deterministic exclusive scheduler. Shared requests are serialized too;
  // this intentionally tests ordering, not a browser implementation of Web Locks.
  let tail = Promise.resolve();
  const locks = { request: vi.fn((_name, _options, work) => {
    const next = tail.then(() => work());
    tail = next.catch(() => {});
    return next;
  }) };
  let sequence = 0;
  const eventsA = new EventTarget(); const eventsB = new EventTarget();
  const make = (events) => createSessionStore({ storage, locks, events, randomUUID: () => `epoch-${++sequence}` });
  return { a: make(eventsA), b: make(eventsB), storage, locks, eventsA, eventsB, make };
}
async function login(store, id) { return store.commitLogin(await store.beginLogin(), credentials(id)); }

describe('canonical session commit protocol', () => {
  it('rejects A editor dispatch before storage notification after B commits', async () => {
    const { a, b } = documents();
    const record = await login(a, 'a'); const permit = a.permit(record);
    await login(b, 'b');
    const transport = vi.fn();
    expect(() => a.dispatch(permit, transport)).toThrowError(expect.objectContaining({ sessionExpired: true }));
    expect(transport).not.toHaveBeenCalled();
    expect(a.read().credentials).toEqual(credentials('b'));
  });

  it('revalidates ownership at dispatch after a queued account replacement', async () => {
    const { a, b } = documents();
    const record = await login(a, 'a'); const permit = a.permit(record);
    const operation = await b.beginLogin();
    const replacement = b.commitLogin(operation, credentials('b'));
    const transport = vi.fn();
    const request = a.dispatch(permit, transport);
    await replacement;
    await expect(request).rejects.toMatchObject({ sessionExpired: true });
    expect(transport).not.toHaveBeenCalled();
  });

  it('supersedes competing login attempts across independent stores', async () => {
    const { a, b } = documents();
    await login(a, 'initial');
    const first = await a.beginLogin(); const second = await b.beginLogin();
    await expect(a.commitLogin(first, credentials('a'))).rejects.toMatchObject({ sessionExpired: true });
    await b.commitLogin(second, credentials('b'));
    expect(a.read().credentials.user.id).toBe('b');
  });

  it('rejects stale logout after replacement, including identical-user login', async () => {
    const { a, b } = documents();
    const old = await login(a, 'a');
    const next = await login(b, 'a');
    expect(next.epoch).not.toBe(old.epoch);
    await expect(a.logout(old.epoch)).rejects.toMatchObject({ sessionExpired: true });
    expect(a.read()).toEqual(next);
  });

  it('changes epochs across logout and same-user re-login and rejects late login', async () => {
    const { a, b } = documents();
    const initial = await login(a, 'a'); const pending = await a.beginLogin();
    const out = await b.logout(); const back = await login(b, 'a');
    expect(new Set([initial.epoch, out.epoch, back.epoch]).size).toBe(3);
    await expect(a.commitLogin(pending, credentials('a'))).rejects.toMatchObject({ sessionExpired: true });
    expect(a.read()).toEqual(back);
  });

  it.each(['refresh', 'expire'])('rejects stale %s after replacement', async (method) => {
    const { a, b } = documents();
    const initial = await login(a, 'a'); const permit = a.permit(initial);
    const next = await login(b, 'b');
    await expect(a[method](permit, initial.revision, { access: 'late-access' })).rejects.toMatchObject({ sessionExpired: true });
    expect(a.read()).toEqual(next);
  });

  it.each([false, true])('serializes competing refresh commits in reverse=%s order and preserves the session epoch', async (reverse) => {
    const { a, b } = documents();
    const initial = await login(a, 'a');
    const one = a.permit(initial); const two = b.permit(initial);
    const contenders = reverse ? [[b, two], [a, one]] : [[a, one], [b, two]];
    const outcomes = await Promise.allSettled(contenders.map(([store, permit], index) =>
      store.refresh(permit, initial.revision, index === 0 ? { access: 'fresh', refresh: 'rotated' } : { access: 'obsolete' })
    ));
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'rejected']);
    expect(a.read()).toMatchObject({ epoch: initial.epoch, revision: initial.revision + 1, credentials: { access: 'fresh', refresh: 'rotated' } });
    expect(a.assertPermit(one).epoch).toBe(initial.epoch);
    await expect(b.expire(two, initial.revision)).rejects.toMatchObject({ sessionExpired: true });
  });

  it('re-reads current storage on delayed notifications and unsubscribes', async () => {
    const { a, b, eventsA } = documents();
    const values = [];
    const callback = () => values.push(a.read().credentials?.user.id ?? null);
    const remove = vi.spyOn(eventsA, 'removeEventListener');
    const unsubscribe = a.subscribe(callback);
    await login(b, 'a'); await login(b, 'b'); await login(b, 'a');
    eventsA.dispatchEvent(new StorageEvent('storage', { key: sessionStorageKey, newValue: 'stale payload' }));
    expect(values).toEqual(['a']);
    unsubscribe();
    eventsA.dispatchEvent(new StorageEvent('storage', { key: sessionStorageKey }));
    expect(values).toHaveLength(1);
    expect(remove).toHaveBeenCalledOnce();
  });

  it('notifies same-document subscribers after a complete canonical write', async () => {
    const { a } = documents(); const records = [];
    const unsubscribe = a.subscribe(() => records.push(a.read()));
    const next = await login(a, 'a');
    expect(records.at(-1)).toEqual(next);
    expect(Object.keys(next).sort()).toEqual(['credentials', 'epoch', 'pendingLogin', 'revision', 'schema']);
    unsubscribe();
  });

  it('rejects forged, revoked, and foreign-document permits', async () => {
    const { a, b } = documents(); const record = await login(a, 'a');
    const permit = a.permit(record);
    expect(() => b.assertPermit(permit)).toThrowError(expect.objectContaining({ sessionExpired: true }));
    expect(() => a.assertPermit({ epoch: record.epoch, userId: 'a', live: true })).toThrow();
    a.revoke(permit);
    expect(() => a.assertPermit(permit)).toThrow();
  });

  it('fails closed without browser coordination and does not import legacy credentials', async () => {
    const { storage } = documents();
    storage.setItem('devjobs.auth', JSON.stringify(credentials('legacy')));
    const a = createSessionStore({ storage, locks: undefined, events: new EventTarget(), randomUUID: () => 'unused' });
    expect(a.read()).toBeNull();
    await expect(a.beginLogin()).rejects.toMatchObject({ sessionExpired: true });
    await expect(a.logout()).rejects.toMatchObject({ sessionExpired: true });
    expect(storage.getItem(sessionStorageKey)).toBeNull();
  });

  it('fails closed on malformed canonical records without exposing credentials in errors', () => {
    const { a, storage } = documents();
    storage.setItem(sessionStorageKey, JSON.stringify({ access: 'sensitive-token' }));
    expect(() => a.read()).toThrow('Invalid authentication record');
  });

  it('fails closed for persisted authenticated sessions when Web Locks is unavailable', async () => {
    const { a, storage } = documents();
    const record = await login(a, 'a');
    const unsupported = createSessionStore({ storage, events: new EventTarget(), randomUUID: () => 'unused' });
    const transport = vi.fn();
    await expect(unsupported.dispatch(unsupported.permit(record), transport)).rejects.toMatchObject({ sessionExpired: true });
    expect(transport).not.toHaveBeenCalled();
    expect(a.read()).toEqual(record);
  });

  it('releases the dispatch lock while transport is pending and cancels subsequent stale dispatch', async () => {
    const { a, b } = documents();
    const record = await login(a, 'a'); const permit = a.permit(record);
    let finish;
    const response = new Promise((resolve) => { finish = resolve; });
    const started = vi.fn(() => response);
    const pending = a.dispatch(permit, started);
    await vi.waitFor(() => expect(started).toHaveBeenCalledOnce());
    await login(b, 'b');
    const staleTransport = vi.fn();
    expect(() => a.dispatch(permit, staleTransport)).toThrow();
    expect(staleTransport).not.toHaveBeenCalled();
    finish('already dispatched');
    expect(await pending).toBe('already dispatched');
  });

  it('does not adopt a replacement epoch while login waits for its lock', async () => {
    const { a, b } = documents();
    await login(a, 'a');
    const replacing = await b.beginLogin();
    const replacement = b.commitLogin(replacing, credentials('b'));
    const queued = a.beginLogin();
    const current = await replacement;
    await expect(queued).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(a.read()).toEqual(current);
  });

  it('validates lifetime inside the credential commit lock', async () => {
    const { a, locks } = documents();
    let live = true;
    const attempt = await a.beginLogin(() => { if (!live) throw new Error('ended lifetime'); });
    let release;
    const held = locks.request('devjobs.auth.v2', {}, () => new Promise((resolve) => { release = resolve; }));
    await Promise.resolve();
    const commit = a.commitLogin(attempt, credentials('a'));
    live = false;
    release();
    await held;
    await expect(commit).rejects.toThrow('ended lifetime');
    expect(a.read().credentials).toBeNull();
  });

});

it.each(['{broken', JSON.stringify({ schema: 99 })])('allows an explicit login to recover corrupt storage %s', async (raw) => {
  const { a, storage } = documents();
  storage.setItem(sessionStorageKey, raw);
  await login(a, 'recovered');
  expect(a.read().credentials).toEqual(credentials('recovered'));
});

it('does not replace a peer login while corrupt-record recovery waits for its lock', async () => {
  const { a, storage, locks } = documents();
  storage.setItem(sessionStorageKey, '{broken');
  const peer = { schema: 1, epoch: 'peer-epoch', revision: 1, pendingLogin: null, credentials: credentials('peer') };
  locks.request.mockImplementationOnce(async (_name, _options, work) => {
    storage.setItem(sessionStorageKey, JSON.stringify(peer));
    return work();
  });
  await expect(a.beginLogin()).rejects.toMatchObject({ sessionExpired: true });
  expect(a.read()).toEqual(peer);
});

it('does not erase a peer record installed between corrupt detection and recovery capture', async () => {
  const { a, storage } = documents();
  const peer = { schema: 1, epoch: 'peer-epoch', revision: 1, pendingLogin: null, credentials: credentials('peer') };
  storage.setItem(sessionStorageKey, JSON.stringify(peer));
  vi.spyOn(storage, 'getItem').mockReturnValueOnce('{broken');
  await expect(a.beginLogin()).rejects.toMatchObject({ sessionExpired: true });
  expect(a.read()).toEqual(peer);
});
