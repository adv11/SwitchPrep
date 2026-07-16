import { ref, onValue, off, set, update, get, remove } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';
import { database, firebaseClock } from '../firebase.js';
import { StorageAdapter } from './StorageAdapter.js';
import { withTimeout } from './withTimeout.js';

// Every one-time get()/set()/update()/remove() below is wrapped — Firebase's
// realtime listeners (onValue, listenRoadmap/listenDailyTodos) are the one
// exception, since a stalled connection there just means no update arrives
// (nothing to time out; the existing stale-listener guard already handles a
// listener getting replaced). 15s comfortably covers a slow-but-working
// connection while still failing fast enough that a stalled one doesn't
// leave the UI stuck indefinitely — see withTimeout.js for why this exists
// at all (issue #6 Phase 5 follow-up: a user reported roadmap-switching
// hanging indefinitely, traced to switchRoadmap()'s unprotected `await
// flush()`/`await adapter.saveMeta()` calls having no way to ever give up).
const FIREBASE_TIMEOUT_MS = 15000;

// Firebase Realtime Database implementation of the storage adapter contract.
// This is the exact logic that previously lived as `dbApi` in firebase.js —
// moved here verbatim so roadmapStore.js can go through the adapter interface
// instead of importing Firebase directly (issue #5).
export class FirebaseAdapter extends StorageAdapter {
  // Pre-#58 singular roadmap path. Never written to anymore — kept only as a
  // one-time migration source and safety net for accounts that predate
  // per-template roadmap storage.
  legacyRoadmapRef(uid) {
    return ref(database, `users/${uid}/roadmap`);
  }

  roadmapRef(uid, templateId) {
    return ref(database, `users/${uid}/roadmaps/${templateId}`);
  }

  metaRef(uid) {
    return ref(database, `users/${uid}/meta`);
  }

  dailyTodosRef(uid) {
    return ref(database, `users/${uid}/dailyTodos`);
  }

  listenDailyTodos(uid, callback, onError) {
    const todosRef = this.dailyTodosRef(uid);
    onValue(todosRef, snapshot => callback(snapshot.exists() ? snapshot.val() : null), onError);
    return () => off(todosRef);
  }

  saveDailyTodos(uid, payload) {
    return withTimeout(set(this.dailyTodosRef(uid), payload), FIREBASE_TIMEOUT_MS, 'Timed out saving Daily Todos to Firebase');
  }

  activityLogRef(uid) {
    return ref(database, `users/${uid}/activityLog`);
  }

  listenActivityLog(uid, callback, onError) {
    const logRef = this.activityLogRef(uid);
    onValue(logRef, snapshot => callback(snapshot.exists() ? snapshot.val() : null), onError);
    return () => off(logRef);
  }

  saveActivityLog(uid, payload) {
    return withTimeout(set(this.activityLogRef(uid), payload), FIREBASE_TIMEOUT_MS, 'Timed out saving activity log to Firebase');
  }

  streakFreezesRef(uid) {
    return ref(database, `users/${uid}/streakFreezes`);
  }

  listenStreakFreezes(uid, callback, onError) {
    const freezesRef = this.streakFreezesRef(uid);
    onValue(freezesRef, snapshot => callback(snapshot.exists() ? snapshot.val() : null), onError);
    return () => off(freezesRef);
  }

  saveStreakFreezes(uid, payload) {
    return withTimeout(set(this.streakFreezesRef(uid), payload), FIREBASE_TIMEOUT_MS, 'Timed out saving streak freezes to Firebase');
  }

  listenRoadmap(uid, templateId, callback, onError) {
    const roadmapRef = this.roadmapRef(uid, templateId);
    // Unwrap Firebase's DataSnapshot here so the adapter interface's callback
    // contract stays backend-agnostic (issue #5 part 2) — callers must never
    // see a `.exists()`/`.val()` shape.
    onValue(roadmapRef, snapshot => callback(snapshot.exists() ? snapshot.val() : null), onError);
    return () => off(roadmapRef);
  }

  saveRoadmap(uid, templateId, payload) {
    return withTimeout(set(this.roadmapRef(uid, templateId), payload), FIREBASE_TIMEOUT_MS, 'Timed out saving roadmap to Firebase');
  }

  // Only ever called for a custom roadmap the user has explicitly deleted
  // (issue #4) — built-in template ids are never removed from Firebase.
  deleteRoadmap(uid, templateId) {
    return withTimeout(remove(this.roadmapRef(uid, templateId)), FIREBASE_TIMEOUT_MS, 'Timed out deleting roadmap from Firebase');
  }

  async getRoadmap(uid, templateId) {
    const snapshot = await withTimeout(get(this.roadmapRef(uid, templateId)), FIREBASE_TIMEOUT_MS, 'Timed out loading roadmap from Firebase');
    return snapshot.exists() ? snapshot.val() : null;
  }

  // Overrides StorageAdapter's read-modify-write default with a real scoped
  // write (issue #184): a multi-path update() keyed by `items/{itemId}/{field}`
  // touches only this item's own children, never the sibling `items` map or
  // any other item's node — so it can't race with a concurrent call for a
  // different itemId the way a full saveRoadmap({ items: nextItems }) can.
  // Resolves null without writing anything if the item doesn't exist remotely
  // yet, so the caller can fall back to a full saveRoadmap() instead of
  // creating a partial item node missing its other fields.
  async updateRoadmapItemFields(uid, templateId, itemId, fields) {
    const existing = await this.getRoadmapItem(uid, templateId, itemId);
    if (!existing) return null;
    const base = `users/${uid}/roadmaps/${templateId}`;
    const updates = { [`${base}/updatedAt`]: this.now() };
    for (const [key, value] of Object.entries(fields)) {
      updates[`${base}/items/${itemId}/${key}`] = value;
    }
    await withTimeout(update(ref(database), updates), FIREBASE_TIMEOUT_MS, 'Timed out updating roadmap item in Firebase');
    return { ...existing, ...fields };
  }

  async getRoadmapItem(uid, templateId, itemId) {
    const snapshot = await withTimeout(get(this.roadmapItemRef(uid, templateId, itemId)), FIREBASE_TIMEOUT_MS, 'Timed out loading roadmap item from Firebase');
    return snapshot.exists() ? snapshot.val() : null;
  }

  roadmapItemRef(uid, templateId, itemId) {
    return ref(database, `users/${uid}/roadmaps/${templateId}/items/${itemId}`);
  }

  async getLegacyRoadmap(uid) {
    const snapshot = await withTimeout(get(this.legacyRoadmapRef(uid)), FIREBASE_TIMEOUT_MS, 'Timed out loading legacy roadmap from Firebase');
    return snapshot.exists() ? snapshot.val() : null;
  }

  async getMeta(uid) {
    const snapshot = await withTimeout(get(this.metaRef(uid)), FIREBASE_TIMEOUT_MS, 'Timed out loading account data from Firebase');
    return snapshot.exists() ? snapshot.val() : null;
  }

  saveMeta(uid, meta) {
    return withTimeout(update(this.metaRef(uid), meta), FIREBASE_TIMEOUT_MS, 'Timed out saving account data to Firebase');
  }

  now() {
    return firebaseClock();
  }
}

export const firebaseAdapter = new FirebaseAdapter();
