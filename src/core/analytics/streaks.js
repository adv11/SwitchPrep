import { dateKey, previousDateKey } from './dateKey.js';

// computeStreaks(activityLog, now) → { current, longest }. A day "counts" if
// entries[date] >= 1. Today counts toward the current streak the moment at
// least one item is completed today; if today has zero activity yet, the
// streak is still "in progress" (walking back from yesterday keeps it alive)
// rather than broken — it just isn't extended until something is completed.
export function computeStreaks(activityLog = {}, now = Date.now()) {
  const entries = activityLog || {};
  const todayKey = dateKey(now);
  const hasToday = (entries[todayKey] || 0) >= 1;

  let current = 0;
  let cursor = hasToday ? todayKey : previousDateKey(todayKey);
  while ((entries[cursor] || 0) >= 1) {
    current += 1;
    cursor = previousDateKey(cursor);
  }

  // Longest streak: walk the sorted set of active dates (string sort is
  // chronological order for zero-padded YYYY-MM-DD) and track the longest
  // run of consecutive calendar days.
  const activeDates = Object.keys(entries).filter(date => (entries[date] || 0) >= 1).sort();
  let longest = 0;
  let run = 0;
  let prevDate = null;
  activeDates.forEach(date => {
    run = prevDate && previousDateKey(date) === prevDate ? run + 1 : 1;
    longest = Math.max(longest, run);
    prevDate = date;
  });

  return { current, longest };
}
