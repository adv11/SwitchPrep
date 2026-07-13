import { navigate } from '../router.js';
import { confirmDialog } from './confirmDialog.js';
import { shouldShowGuestRiskNudge, markGuestRiskNudgeShown } from '../utils/guestDataRisk.js';

// Issue #123 — after a guest has built real progress, nudge toward creating
// a real account so it isn't silently lost to a cleared cache/new device/
// closed tab. Reuses confirmDialog rather than inventing a new UI primitive
// (per the issue's own scope note); fires at most once ever per uid
// regardless of which button is clicked — the point is a single heads-up,
// not a recurring interruption.
export async function maybeShowGuestDataRiskNudge({ user, store }) {
  if (!user.isAnonymous) return;

  const completedCount = store.getSnapshot().items.filter(item => item.done).length;
  if (!shouldShowGuestRiskNudge(user.uid, user.isAnonymous, completedCount)) return;

  markGuestRiskNudgeShown(user.uid);

  const wantsAccount = await confirmDialog({
    title: 'Your progress is only on this device',
    message: "You're using a guest session — your roadmap is stored only in this browser. Clearing your browser data, switching devices, or losing this device would lose it for good. Create a free account to keep it safe, or download a backup from the account menu instead.",
    confirmText: 'Create account',
    cancelText: 'Not now'
  });

  if (wantsAccount) navigate('/signup');
}
