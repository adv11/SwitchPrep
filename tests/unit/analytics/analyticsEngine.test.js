import { describe, it, expect } from 'vitest';
import {
  computeOverview,
  computePhaseBreakdown,
  computePriorityBreakdown,
  computeAnalytics,
  effectiveCompletedAt,
  buildEffectiveActivityLog
} from '../../../src/core/analytics/analyticsEngine.js';

const NOW = new Date(2026, 6, 10).getTime(); // 2026-07-10

describe('computeOverview', () => {
  it('computes done/total/pct', () => {
    const items = [{ done: true }, { done: true }, { done: false }, { done: false }];
    expect(computeOverview(items)).toEqual({ total: 4, done: 2, pct: 50 });
  });

  it('handles an empty roadmap without dividing by zero', () => {
    expect(computeOverview([])).toEqual({ total: 0, done: 0, pct: 0 });
  });
});

describe('computePhaseBreakdown', () => {
  it('groups by phase and sorts ascending by completion percentage', () => {
    const items = [
      { phase: 'Java', done: true }, { phase: 'Java', done: false },
      { phase: 'Spring', done: true }, { phase: 'Spring', done: true }
    ];
    const result = computePhaseBreakdown(items);
    expect(result[0].phase).toBe('Java');
    expect(result[0].pct).toBe(50);
    expect(result[1].phase).toBe('Spring');
    expect(result[1].pct).toBe(100);
  });
});

describe('computePriorityBreakdown', () => {
  it('cross-tabs done/total by priority within each phase', () => {
    const items = [
      { phase: 'Java', priority: 'P0', done: true },
      { phase: 'Java', priority: 'P0', done: false },
      { phase: 'Java', priority: 'P1', done: true }
    ];
    const result = computePriorityBreakdown(items);
    expect(result).toHaveLength(1);
    expect(result[0].phase).toBe('Java');
    expect(result[0].priorities.P0).toEqual({ done: 1, total: 2 });
    expect(result[0].priorities.P1).toEqual({ done: 1, total: 1 });
    expect(result[0].priorities.P2).toEqual({ done: 0, total: 0 });
  });

  it('falls back an invalid priority to P2', () => {
    const items = [{ phase: 'Java', priority: 'bogus', done: true }];
    expect(computePriorityBreakdown(items)[0].priorities.P2).toEqual({ done: 1, total: 1 });
  });
});

describe('effectiveCompletedAt (backfill)', () => {
  it('returns completedAt when present', () => {
    expect(effectiveCompletedAt({ done: true, completedAt: 100, updatedAt: 200 })).toBe(100);
  });

  it('falls back to updatedAt when done but completedAt is null (pre-issue-#18 data)', () => {
    expect(effectiveCompletedAt({ done: true, completedAt: null, updatedAt: 200 })).toBe(200);
  });

  it('returns null for a not-done item with no completedAt', () => {
    expect(effectiveCompletedAt({ done: false, completedAt: null, updatedAt: 200 })).toBeNull();
  });

  it('is never written back to the item — a pure read', () => {
    const item = { done: true, completedAt: null, updatedAt: 200 };
    effectiveCompletedAt(item);
    expect(item.completedAt).toBeNull();
  });
});

describe('buildEffectiveActivityLog', () => {
  it('backfills a day from items when activityLog has no entry for it at all', () => {
    const items = [{ done: true, completedAt: new Date(2026, 5, 1).getTime() }];
    const merged = buildEffectiveActivityLog(items, {});
    expect(merged['2026-06-01']).toBe(1);
  });

  it('lets a real activityLog entry win over the derived count for the same day, including an explicit 0', () => {
    const items = [{ done: true, completedAt: new Date(2026, 5, 1).getTime() }];
    const merged = buildEffectiveActivityLog(items, { '2026-06-01': 0 });
    expect(merged['2026-06-01']).toBe(0);
  });

  it('does not resurrect a since-unchecked item once the real log tracks that day', () => {
    // Item is currently unchecked (completedAt null) so it contributes
    // nothing to the derived log for that day, but activityLog's real entry
    // (from when it was checked, before being unchecked) still wins if present.
    const items = [{ done: false, completedAt: null, updatedAt: new Date(2026, 5, 1).getTime() }];
    const merged = buildEffectiveActivityLog(items, { '2026-06-01': 1 });
    expect(merged['2026-06-01']).toBe(1);
  });
});

describe('computeAnalytics', () => {
  it('composes every sub-metric from items + activityLog', () => {
    const items = [{ phase: 'Java', priority: 'P0', done: true, completedAt: NOW }];
    const activityLog = { '2026-07-10': 1 };
    const result = computeAnalytics(items, activityLog, NOW);
    expect(result.overview).toEqual({ total: 1, done: 1, pct: 100 });
    expect(result.streaks.current).toBe(1);
    expect(result.velocity).toBeGreaterThan(0);
    expect(result.phaseBreakdown).toHaveLength(1);
    expect(result.priorityBreakdown).toHaveLength(1);
    expect(result.heatmapData).toHaveLength(364);
    expect(result.projection.complete).toBe(true);
  });
});
