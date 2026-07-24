import { ref, get, update } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';
import { database } from './firebase.js';
import { withTimeout } from './storage/withTimeout.js';
import { buildRoadmapShareSnapshot } from '../core/roadmap/shareSchema.js';

// Thin, mostly-stateless wrapper around `sharedRoadmaps/{shareId}` — same
// "doesn't fit the StorageAdapter contract" precedent as feedbackStore.js
// (see ".claude/rules/roadmap-store.md"'s "In-app feedback & bug reporting"
// section): this is a one-shot publish/revoke/list flow over a top-level,
// non-per-template path, not bidirectional synced account state.

const FIREBASE_TIMEOUT_MS = 15000;

// Issue #375 — same lost-update race issue #153/#350 already fixed for
// roadmapStore.js's startedTemplateIds/customRoadmaps/favoriteRoadmapIds/
// hiddenTemplateIds: a plain read-modify-write on shareIds lets two
// overlapping publish/revoke calls each read the array before either write
// lands, so whichever update() resolves last silently drops the other
// call's change. roadmapStore.js's serializeMetaMutation() isn't importable
// here — it's created fresh inside createRoadmapStore()'s closure, not
// exported at module scope — so this is a dedicated equivalent: a single
// in-module promise queue every shareIds mutation chains behind. The
// computation of the next shareIds array must happen *inside* the queued
// closure (not before it), same discipline roadmap-store.md documents —
// wrapping an already-computed array in the queue doesn't fix the race.
let shareIdsMutationQueue = Promise.resolve();
function serializeShareIdsMutation(run) {
  const settled = shareIdsMutationQueue.then(run, run);
  shareIdsMutationQueue = settled.then(() => {}, () => {});
  return settled;
}

async function getShareIds(uid) {
  const snap = await withTimeout(
    get(ref(database, `users/${uid}/meta/shareIds`)),
    FIREBASE_TIMEOUT_MS,
    'Timed out loading your share links'
  );
  return snap.exists() ? snap.val() : [];
}

// Writes a frozen snapshot to a freshly generated `shareId` and appends it to
// the owner's own index (`users/{uid}/meta/shareIds`) in one multi-path
// update, so a client never observes one written without the other.
// Republishing always mints a new shareId — see roadmap-store.md for why
// this is deliberate (a share link never silently mutates under a viewer).
export async function publishRoadmapShare(uid, roadmapSnapshot, title) {
  const shareId = crypto.randomUUID();
  const payload = buildRoadmapShareSnapshot(roadmapSnapshot, { uid, title });
  return serializeShareIdsMutation(async () => {
    const shareIds = await getShareIds(uid);
    const updates = {
      [`sharedRoadmaps/${shareId}`]: payload,
      [`users/${uid}/meta/shareIds`]: [...shareIds, shareId]
    };
    await withTimeout(update(ref(database), updates), FIREBASE_TIMEOUT_MS, 'Timed out publishing your share link');
    return shareId;
  });
}

// Deletes the shared snapshot (the link 404s immediately after — see
// sharedRoadmapView.js's revoked state) and drops it from the owner's index.
export async function revokeRoadmapShare(uid, shareId) {
  return serializeShareIdsMutation(async () => {
    const shareIds = await getShareIds(uid);
    const updates = {
      [`sharedRoadmaps/${shareId}`]: null,
      [`users/${uid}/meta/shareIds`]: shareIds.filter(id => id !== shareId)
    };
    await withTimeout(update(ref(database), updates), FIREBASE_TIMEOUT_MS, 'Timed out revoking that share link');
  });
}

// The signed-in owner's own list of currently-published shares, for the
// "Share this roadmap" modal's management list. A shareId whose snapshot no
// longer exists (a revoke that updated one path but not the other, e.g. a
// dropped connection mid-update) is filtered out rather than shown broken.
export async function listMyShares(uid) {
  const shareIds = await getShareIds(uid);
  if (!shareIds.length) return [];
  const snapshots = await Promise.all(
    shareIds.map(id =>
      withTimeout(get(ref(database, `sharedRoadmaps/${id}`)), FIREBASE_TIMEOUT_MS, 'Timed out loading your share links')
    )
  );
  return shareIds
    .map((id, i) => (snapshots[i].exists() ? { id, ...snapshots[i].val() } : null))
    .filter(Boolean);
}

// Unauthenticated, one-shot read for the public `#/shared` view. Returns
// `null` for a revoked or never-existed shareId — the caller renders the
// "this link has been revoked" state rather than a raw 404/blank page.
export async function getSharedRoadmap(shareId) {
  const snap = await withTimeout(
    get(ref(database, `sharedRoadmaps/${shareId}`)),
    FIREBASE_TIMEOUT_MS,
    'Timed out loading this shared roadmap'
  );
  return snap.exists() ? snap.val() : null;
}
