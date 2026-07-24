import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same CDN-stub pattern tests/integration/feedbackStore.test.js and
// tests/unit/storage/adapterFactory.test.js already established — the default
// ESM loader can't resolve a bare https:// import, so both the SDK module and
// firebase.js are mocked identically.
const get = vi.fn();
const update = vi.fn();
const ref = vi.fn((_db, path) => ({ path }));

vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref: (...args) => ref(...args),
  get: (...args) => get(...args),
  update: (...args) => update(...args)
}));
vi.mock('../../src/services/firebase.js', () => ({
  database: {}
}));

const { publishRoadmapShare, revokeRoadmapShare, listMyShares, getSharedRoadmap } = await import(
  '../../src/services/shareStore.js'
);

function snapshot(exists, val) {
  return { exists: () => exists, val: () => val };
}

beforeEach(() => {
  vi.resetAllMocks();
  ref.mockImplementation((_db, path) => ({ path }));
  update.mockResolvedValue(undefined);
  vi.stubGlobal('crypto', { randomUUID: () => 'share-id-1' });
});

describe('publishRoadmapShare', () => {
  const roadmapSnapshot = {
    activeTemplateId: 'java-backend',
    phases: [{ id: 'phase-1', title: 'Phase 1' }],
    allItems: {
      'item-1': {
        title: 'Learn Spring Boot',
        phase: 'Phase 1',
        section: 'Section 1',
        priority: 'P0',
        done: false,
        resources: []
      }
    }
  };

  it('writes sharedRoadmaps/{shareId} and appends the new id to the owner index in one multi-path update', async () => {
    get.mockResolvedValue(snapshot(false, null));

    const shareId = await publishRoadmapShare('uid-1', roadmapSnapshot, 'My Roadmap');

    expect(shareId).toBe('share-id-1');
    expect(update).toHaveBeenCalledTimes(1);
    const [, updates] = update.mock.calls[0];
    expect(Object.keys(updates).sort()).toEqual(
      ['sharedRoadmaps/share-id-1', 'users/uid-1/meta/shareIds'].sort()
    );
    expect(updates['users/uid-1/meta/shareIds']).toEqual(['share-id-1']);
  });

  it('writes the expected snapshot shape via buildRoadmapShareSnapshot — no notes/completedAt', async () => {
    get.mockResolvedValue(snapshot(false, null));

    await publishRoadmapShare('uid-1', roadmapSnapshot, 'My Roadmap');

    const [, updates] = update.mock.calls[0];
    const payload = updates['sharedRoadmaps/share-id-1'];
    expect(payload.ownerUid).toBe('uid-1');
    expect(payload.title).toBe('My Roadmap');
    expect(payload.templateId).toBe('java-backend');
    expect(payload.phases).toEqual(roadmapSnapshot.phases);
    expect(payload.items['item-1']).toEqual({
      title: 'Learn Spring Boot',
      phase: 'Phase 1',
      section: 'Section 1',
      priority: 'P0',
      done: false,
      resources: []
    });
    expect('notes' in payload.items['item-1']).toBe(false);
    expect('completedAt' in payload.items['item-1']).toBe(false);
    expect(typeof payload.publishedAt).toBe('number');
  });

  it('appends to an existing shareIds list rather than overwriting it', async () => {
    get.mockResolvedValue(snapshot(true, ['share-old']));

    await publishRoadmapShare('uid-1', roadmapSnapshot, 'My Roadmap');

    const [, updates] = update.mock.calls[0];
    expect(updates['users/uid-1/meta/shareIds']).toEqual(['share-old', 'share-id-1']);
  });

  it('rejects when the underlying Firebase write fails', async () => {
    get.mockResolvedValue(snapshot(false, null));
    update.mockRejectedValue(new Error('network down'));

    await expect(publishRoadmapShare('uid-1', roadmapSnapshot, 'My Roadmap')).rejects.toThrow('network down');
  });
});

// Issue #375 — same lost-update race issue #153/#350 already fixed for
// roadmapStore.js's array-field meta mutations: two overlapping publish/revoke
// calls used to each read shareIds before either write landed, so whichever
// update() resolved last silently dropped the other call's change. These
// tests fail against the pre-fix code (verified by temporarily reverting
// serializeShareIdsMutation and confirming the second overlapping call's
// write carries only its own id) and pass against the fix.
describe('lost-update race on shareIds — issue #375', () => {
  const roadmapSnapshot = {
    activeTemplateId: 'java-backend',
    phases: [{ id: 'phase-1', title: 'Phase 1' }],
    allItems: {
      'item-1': {
        title: 'Learn Spring Boot',
        phase: 'Phase 1',
        section: 'Section 1',
        priority: 'P0',
        done: false,
        resources: []
      }
    }
  };

  it('two overlapping publishRoadmapShare() calls both survive in shareIds, even when the first call\'s update() is the slow one', async () => {
    const ids = ['share-1', 'share-2'];
    vi.stubGlobal('crypto', { randomUUID: () => ids.shift() });
    // Mock get() to reflect committed writes (as real Firebase does on a
    // read-after-write) — the fix relies on the second queued closure's
    // getShareIds() only running after the first closure's update() has
    // actually settled, so the mock must track state rather than return a
    // static snapshot forever.
    let committedShareIds = [];
    get.mockImplementation(() => Promise.resolve(snapshot(committedShareIds.length > 0, committedShareIds)));

    let resolveFirstUpdate;
    let sawFirstCall = false;
    const updateCalls = [];
    update.mockImplementation((_ref, updates) => {
      updateCalls.push(updates);
      committedShareIds = updates['users/uid-1/meta/shareIds'];
      if (!sawFirstCall) {
        sawFirstCall = true;
        return new Promise(resolve => { resolveFirstUpdate = resolve; });
      }
      return Promise.resolve();
    });

    const publishA = publishRoadmapShare('uid-1', roadmapSnapshot, 'Roadmap A');
    const publishB = publishRoadmapShare('uid-1', roadmapSnapshot, 'Roadmap B');

    // Give both calls a chance to reach their update() call (each goes
    // through an extra getShareIds()/withTimeout() hop first, so this needs
    // more than a couple of microtask ticks) before letting the first (slow)
    // write settle. resolveFirstUpdate() is always called, even if the
    // waitFor assertion fails — the queue is a module-level singleton shared
    // across every test in this file, so leaving it unresolved would hang
    // every later test's mutation forever.
    try {
      await vi.waitFor(() => expect(updateCalls.length).toBe(1));
    } finally {
      resolveFirstUpdate();
    }

    const [shareIdA, shareIdB] = await Promise.all([publishA, publishB]);

    const lastCall = updateCalls[updateCalls.length - 1];
    expect(lastCall['users/uid-1/meta/shareIds']).toEqual(
      expect.arrayContaining([shareIdA, shareIdB])
    );
  });

  it('two overlapping revokeRoadmapShare() calls for different share ids both end up removed from shareIds', async () => {
    let committedShareIds = ['share-a', 'share-b'];
    get.mockImplementation(() => Promise.resolve(snapshot(committedShareIds.length > 0, committedShareIds)));

    let resolveFirstUpdate;
    let sawFirstCall = false;
    const updateCalls = [];
    update.mockImplementation((_ref, updates) => {
      updateCalls.push(updates);
      committedShareIds = updates['users/uid-1/meta/shareIds'];
      if (!sawFirstCall) {
        sawFirstCall = true;
        return new Promise(resolve => { resolveFirstUpdate = resolve; });
      }
      return Promise.resolve();
    });

    const revokeA = revokeRoadmapShare('uid-1', 'share-a');
    const revokeB = revokeRoadmapShare('uid-1', 'share-b');

    try {
      await vi.waitFor(() => expect(updateCalls.length).toBe(1));
    } finally {
      resolveFirstUpdate();
    }

    await Promise.all([revokeA, revokeB]);

    const lastCall = updateCalls[updateCalls.length - 1];
    expect(lastCall['users/uid-1/meta/shareIds']).toEqual([]);
  });
});

describe('listMyShares', () => {
  it("returns the current user's published roadmaps, merging each id with its snapshot", async () => {
    get.mockImplementation((_ref) => {
      const path = _ref.path;
      if (path === 'users/uid-1/meta/shareIds') return Promise.resolve(snapshot(true, ['share-a', 'share-b']));
      if (path === 'sharedRoadmaps/share-a') {
        return Promise.resolve(snapshot(true, { title: 'Roadmap A', ownerUid: 'uid-1' }));
      }
      if (path === 'sharedRoadmaps/share-b') {
        return Promise.resolve(snapshot(true, { title: 'Roadmap B', ownerUid: 'uid-1' }));
      }
      throw new Error(`unexpected path ${path}`);
    });

    const shares = await listMyShares('uid-1');

    expect(shares).toEqual([
      { id: 'share-a', title: 'Roadmap A', ownerUid: 'uid-1' },
      { id: 'share-b', title: 'Roadmap B', ownerUid: 'uid-1' }
    ]);
  });

  it('filters out a shareId whose snapshot no longer exists rather than showing it broken', async () => {
    get.mockImplementation((_ref) => {
      const path = _ref.path;
      if (path === 'users/uid-1/meta/shareIds') return Promise.resolve(snapshot(true, ['share-a', 'share-gone']));
      if (path === 'sharedRoadmaps/share-a') return Promise.resolve(snapshot(true, { title: 'Roadmap A' }));
      if (path === 'sharedRoadmaps/share-gone') return Promise.resolve(snapshot(false, null));
      throw new Error(`unexpected path ${path}`);
    });

    const shares = await listMyShares('uid-1');

    expect(shares).toEqual([{ id: 'share-a', title: 'Roadmap A' }]);
  });

  it('returns an empty array when the user has never published anything, without reading any snapshot', async () => {
    get.mockResolvedValue(snapshot(false, null));

    const shares = await listMyShares('uid-1');

    expect(shares).toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('rejects when the underlying Firebase read fails', async () => {
    get.mockRejectedValue(new Error('timed out'));

    await expect(listMyShares('uid-1')).rejects.toThrow('timed out');
  });
});

describe('revokeRoadmapShare', () => {
  it('deletes the shared snapshot and drops the id from the owner index in one multi-path update', async () => {
    get.mockResolvedValue(snapshot(true, ['share-a', 'share-b']));

    await revokeRoadmapShare('uid-1', 'share-a');

    expect(update).toHaveBeenCalledTimes(1);
    const [, updates] = update.mock.calls[0];
    expect(updates['sharedRoadmaps/share-a']).toBeNull();
    expect(updates['users/uid-1/meta/shareIds']).toEqual(['share-b']);
  });

  it('is a no-op on the index when the id is not present (still writes both paths)', async () => {
    get.mockResolvedValue(snapshot(true, ['share-b']));

    await revokeRoadmapShare('uid-1', 'share-missing');

    const [, updates] = update.mock.calls[0];
    expect(updates['sharedRoadmaps/share-missing']).toBeNull();
    expect(updates['users/uid-1/meta/shareIds']).toEqual(['share-b']);
  });

  it('rejects when the underlying Firebase write fails', async () => {
    get.mockResolvedValue(snapshot(true, ['share-a']));
    update.mockRejectedValue(new Error('write denied'));

    await expect(revokeRoadmapShare('uid-1', 'share-a')).rejects.toThrow('write denied');
  });
});

describe('getSharedRoadmap', () => {
  it('returns the snapshot value for an existing shareId', async () => {
    get.mockResolvedValue(snapshot(true, { title: 'Roadmap A' }));

    const result = await getSharedRoadmap('share-a');

    expect(result).toEqual({ title: 'Roadmap A' });
  });

  it('returns null for a revoked or never-existed shareId', async () => {
    get.mockResolvedValue(snapshot(false, null));

    const result = await getSharedRoadmap('share-gone');

    expect(result).toBeNull();
  });

  it('rejects when the underlying Firebase read fails', async () => {
    get.mockRejectedValue(new Error('timed out'));

    await expect(getSharedRoadmap('share-a')).rejects.toThrow('timed out');
  });
});
