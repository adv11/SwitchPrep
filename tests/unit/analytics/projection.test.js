import { describe, it, expect } from 'vitest';
import { computeProjection } from '../../../src/core/analytics/projection.js';

const NOW = new Date(2026, 6, 10).getTime(); // 2026-07-10

function items(done, total) {
  return [
    ...Array.from({ length: done }, (_, i) => ({ id: `d${i}`, done: true })),
    ...Array.from({ length: total - done }, (_, i) => ({ id: `r${i}`, done: false }))
  ];
}

describe('computeProjection', () => {
  it('projects a completion date at the current velocity', () => {
    const log = { '2026-07-10': 7, '2026-07-09': 7 }; // velocity = 2/day
    const result = computeProjection(items(0, 20), log, NOW);
    expect(result.remainingItems).toBe(20);
    expect(result.velocity).toBe(2);
    expect(result.daysToComplete).toBe(10);
    expect(result.noRecentActivity).toBeUndefined();
    expect(result.complete).toBeUndefined();
  });

  it('offers a boosted +2 items/day scenario that completes sooner', () => {
    const log = { '2026-07-10': 7, '2026-07-09': 7 }; // velocity = 2/day
    const result = computeProjection(items(0, 20), log, NOW);
    expect(result.boostedDaysToComplete).toBeLessThan(result.daysToComplete);
  });

  it('reports no recent activity when 7-day velocity is 0', () => {
    const result = computeProjection(items(5, 20), {}, NOW);
    expect(result.noRecentActivity).toBe(true);
    expect(result.remainingItems).toBe(15);
  });

  it('reports complete when nothing remains, even with 0 velocity', () => {
    const result = computeProjection(items(20, 20), {}, NOW);
    expect(result.complete).toBe(true);
    expect(result.remainingItems).toBe(0);
  });

  it('reports complete before checking velocity, even with recent activity', () => {
    const log = { '2026-07-10': 3 };
    const result = computeProjection(items(20, 20), log, NOW);
    expect(result.complete).toBe(true);
  });
});
