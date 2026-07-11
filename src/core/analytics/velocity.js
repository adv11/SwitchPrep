import { dateKey, previousDateKey } from './dateKey.js';

const WINDOW_DAYS = 7;

// computeVelocity(activityLog, now) → average items completed per day over
// the trailing 7 calendar days (today inclusive). The denominator is always
// 7 — a day with zero completions still counts toward it, so a single burst
// followed by silence trends the average back down instead of staying
// artificially high. Call again with `now` shifted back 7 days to get the
// prior period for a week-over-week delta.
export function computeVelocity(activityLog = {}, now = Date.now()) {
  const entries = activityLog || {};
  let total = 0;
  let cursor = dateKey(now);
  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    total += entries[cursor] || 0;
    cursor = previousDateKey(cursor);
  }
  return total / WINDOW_DAYS;
}
