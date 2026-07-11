import { computeVelocity } from './velocity.js';

const BOOST_ITEMS_PER_DAY = 2;

function addDays(now, days) {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

// computeProjection(items, activityLog, now) → projected completion at the
// current 7-day velocity, plus a "+2 items/day" boosted scenario. `items` is
// a roadmap snapshot's non-deleted item list (done/not-done, not full
// analytics — the caller decides which roadmap this is for).
export function computeProjection(items = [], activityLog = {}, now = Date.now()) {
  const total = items.length;
  const done = items.filter(item => item.done).length;
  const remaining = total - done;
  const velocity = computeVelocity(activityLog, now);

  if (remaining <= 0) {
    return { remainingItems: 0, velocity, complete: true };
  }
  if (velocity <= 0) {
    return { remainingItems: remaining, velocity: 0, noRecentActivity: true };
  }

  const daysToComplete = Math.ceil(remaining / velocity);
  const boostedVelocity = velocity + BOOST_ITEMS_PER_DAY;
  const boostedDaysToComplete = Math.ceil(remaining / boostedVelocity);

  return {
    remainingItems: remaining,
    velocity,
    daysToComplete,
    projectedDate: addDays(now, daysToComplete),
    boostedDaysToComplete,
    boostedProjectedDate: addDays(now, boostedDaysToComplete)
  };
}
