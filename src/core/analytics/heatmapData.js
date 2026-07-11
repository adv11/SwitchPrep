import { dateKey, previousDateKey } from './dateKey.js';

const WEEKS = 52;
const DAYS_PER_WEEK = 7;
const TOTAL_CELLS = WEEKS * DAYS_PER_WEEK;

// Bucket thresholds from issue #8's heatmap spec: 0 / 1-2 / 3-4 / 5-6 / 7+.
export function heatLevel(count) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

// computeHeatmap(activityLog, now) → always exactly 364 cells
// (52 weeks x 7 days), oldest first, each { date, count, level, isToday }.
// Always generates the full grid regardless of how much history exists —
// missing days are level-0 cells, not omitted, so the UI never has to
// special-case a short history.
export function computeHeatmap(activityLog = {}, now = Date.now()) {
  const entries = activityLog || {};
  const todayStr = dateKey(now);
  const cells = [];
  let cursor = todayStr;
  for (let i = 0; i < TOTAL_CELLS; i += 1) {
    const count = entries[cursor] || 0;
    cells.push({ date: cursor, count, level: heatLevel(count), isToday: cursor === todayStr });
    cursor = previousDateKey(cursor);
  }
  return cells.reverse();
}
