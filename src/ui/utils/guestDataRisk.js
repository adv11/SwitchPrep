import { guestRiskNudgeShownKey } from '../../services/localStorageKeys.js';

// Issue #123 — a guest ("anonymous") session's roadmap lives only in
// localStorage/an anonymous Firebase Auth identity until converted to a real
// account; nothing in the app ever warned about that before this. Nudging
// immediately on first sign-in would be noise (a guest hasn't built anything
// worth losing yet) — the trigger is real progress, the same
// `done || custom` "has real progress" check `roadmapStore.js`'s own internal
// guard and `backupReminderBanner.js` already use, once at least
// COMPLETED_THRESHOLD items are actually done. Shown at most once ever per
// uid (dismiss-and-remember, no snooze/re-nag window like the backup
// reminder has — this is a one-time heads-up, not a recurring nudge).
export const COMPLETED_THRESHOLD = 5;

export function shouldShowGuestRiskNudge(uid, isAnonymous, completedCount) {
  if (!uid || !isAnonymous) return false;
  if (completedCount < COMPLETED_THRESHOLD) return false;
  return !localStorage.getItem(guestRiskNudgeShownKey(uid));
}

export function markGuestRiskNudgeShown(uid) {
  if (!uid) return;
  localStorage.setItem(guestRiskNudgeShownKey(uid), '1');
}
