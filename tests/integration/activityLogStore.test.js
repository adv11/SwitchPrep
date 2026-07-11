import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createActivityLogStore, pruneOldEntries } from '../../src/services/activityLogStore.js';
import { getStorageAdapter, dbApi } from '../../src/services/storage/adapterFactory.js';
import { KEYS } from '../../src/services/localStorageKeys.js';

// Same fake-adapter approach as tests/integration/dailyTodoStore.test.js —
// getStorageAdapter is itself a vi.fn() so tests can assert on calls.
vi.mock('../../src/services/storage/adapterFactory.js', () => {
  const dbApi = {
    listenActivityLog: vi.fn((_uid, onData) => { onData(null); return () => {}; }),
    saveActivityLog: vi.fn(() => Promise.resolve())
  };
  return { getStorageAdapter: vi.fn(() => dbApi), dbApi };
});

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.useRealTimers();
  getStorageAdapter.mockImplementation(() => dbApi);
  dbApi.listenActivityLog.mockImplementation((_uid, onData) => { onData(null); return () => {}; });
  dbApi.saveActivityLog.mockResolvedValue(undefined);
});

describe('subscribe / notify cycle', () => {
  it('calls callback immediately on subscribe', () => {
    const store = createActivityLogStore();
    const snapshots = [];
    const unsub = store.subscribe(s => snapshots.push(s));
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].entries).toEqual({});
    unsub();
  });
});

describe('recordCompletion / recordUncompletion', () => {
  it('increments the current day on completion', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 4).getTime()); // 2026-07-04
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });

    store.recordCompletion();
    store.recordCompletion();
    expect(store.getSnapshot().entries['2026-07-04']).toBe(2);
    vi.useRealTimers();
  });

  it('decrements on uncompletion, floored at 0', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 4).getTime());
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });

    store.recordCompletion();
    store.recordUncompletion();
    expect(store.getSnapshot().entries['2026-07-04']).toBe(0);

    store.recordUncompletion();
    expect(store.getSnapshot().entries['2026-07-04']).toBe(0);
    vi.useRealTimers();
  });

  it('never mutates a historical day — only ever touches the current day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 3).getTime());
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    store.recordCompletion();
    expect(store.getSnapshot().entries['2026-07-03']).toBe(1);

    vi.setSystemTime(new Date(2026, 6, 4).getTime());
    store.recordCompletion();
    expect(store.getSnapshot().entries['2026-07-03']).toBe(1);
    expect(store.getSnapshot().entries['2026-07-04']).toBe(1);
    vi.useRealTimers();
  });
});

describe('pruneOldEntries', () => {
  it('drops entries older than 365 days', () => {
    const now = new Date(2026, 6, 4).getTime();
    const entries = { '2024-01-01': 3, '2025-07-04': 2, '2026-07-04': 1 };
    const pruned = pruneOldEntries(entries, now);
    // '2025-07-04' is exactly 365 days before '2026-07-04' — the boundary
    // itself is kept (see the boundary test below); only the clearly older
    // '2024-01-01' entry is dropped.
    expect(pruned).toEqual({ '2025-07-04': 2, '2026-07-04': 1 });
  });

  it('keeps entries exactly at the boundary', () => {
    const now = new Date(2026, 6, 4).getTime();
    const cutoff = new Date(2026, 6, 4);
    cutoff.setDate(cutoff.getDate() - 365);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    const pruned = pruneOldEntries({ [cutoffKey]: 5 }, now);
    expect(pruned[cutoffKey]).toBe(5);
  });

  it('is applied on setUser (via local load)', async () => {
    localStorage.setItem(KEYS.ACTIVITY_LOG, JSON.stringify({
      dirty: false,
      entries: { '2020-01-01': 4, '2026-07-04': 1 }
    }));
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 4).getTime());
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    expect(store.getSnapshot().entries).toEqual({ '2026-07-04': 1 });
    vi.useRealTimers();
  });
});

describe('persistence', () => {
  it('persists to localStorage under KEYS.ACTIVITY_LOG within the debounce window', async () => {
    vi.useFakeTimers();
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    store.recordCompletion();

    const raw = JSON.parse(localStorage.getItem(KEYS.ACTIVITY_LOG));
    expect(raw.dirty).toBe(true);
    expect(Object.values(raw.entries).reduce((a, b) => a + b, 0)).toBe(1);

    await vi.advanceTimersByTimeAsync(600);
    expect(dbApi.saveActivityLog).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('sign-out privacy guard', () => {
  it('clears local data on a uid transition', async () => {
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    store.recordCompletion();
    expect(Object.keys(store.getSnapshot().entries)).toHaveLength(1);

    await store.setUser({ uid: 'u2' });
    expect(store.getSnapshot().entries).toEqual({});
    expect(localStorage.getItem(KEYS.ACTIVITY_LOG)).toBeNull();
  });

  it('clears local data on sign-out (uid -> null)', async () => {
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    store.recordCompletion();

    await store.setUser(null);
    expect(store.getSnapshot().entries).toEqual({});
    expect(localStorage.getItem(KEYS.ACTIVITY_LOG)).toBeNull();
  });
});

describe('Firebase echo guard', () => {
  it('an echo of an unchanged log does not cause a spurious notify with new content', async () => {
    let listenerCallback;
    dbApi.listenActivityLog.mockImplementation((_uid, onData) => {
      listenerCallback = onData;
      onData(null);
      return () => {};
    });

    vi.useFakeTimers();
    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    store.recordCompletion();
    await vi.advanceTimersByTimeAsync(600);

    const beforeEcho = store.getSnapshot().entries;
    listenerCallback(JSON.parse(JSON.stringify(beforeEcho)));
    expect(store.getSnapshot().entries).toEqual(beforeEcho);
    vi.useRealTimers();
  });

  it('never applies a remote snapshot while a local edit is unflushed', async () => {
    let listenerCallback;
    dbApi.listenActivityLog.mockImplementation((_uid, onData) => {
      listenerCallback = onData;
      onData(null);
      return () => {};
    });

    const store = createActivityLogStore();
    await store.setUser({ uid: 'u1' });
    store.recordCompletion();

    // dirty is true (debounce hasn't fired) — a remote snapshot must be ignored.
    listenerCallback({ '1999-01-01': 9 });

    expect(store.getSnapshot().entries['1999-01-01']).toBeUndefined();
  });
});
