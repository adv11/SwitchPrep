import { describe, it, expect } from 'vitest';
import { computeStreaks } from '../../../src/core/analytics/streaks.js';

const NOW = new Date(2026, 6, 10).getTime(); // 2026-07-10

describe('computeStreaks', () => {
  it('returns zeros for an empty log', () => {
    expect(computeStreaks({}, NOW)).toEqual({ current: 0, longest: 0 });
  });

  it('counts a current streak ending today', () => {
    const log = { '2026-07-08': 1, '2026-07-09': 2, '2026-07-10': 1 };
    expect(computeStreaks(log, NOW)).toEqual({ current: 3, longest: 3 });
  });

  it('today with 0 items does not break an existing streak but does not extend it', () => {
    const log = { '2026-07-08': 1, '2026-07-09': 1, '2026-07-10': 0 };
    expect(computeStreaks(log, NOW).current).toBe(2);
  });

  it('a gap breaks the current streak', () => {
    const log = { '2026-07-05': 1, '2026-07-06': 1, '2026-07-08': 1, '2026-07-09': 1, '2026-07-10': 1 };
    const result = computeStreaks(log, NOW);
    expect(result.current).toBe(3);
    expect(result.longest).toBe(3);
  });

  it('longest streak can be in the past, independent of the current one', () => {
    const log = {
      '2026-06-01': 1, '2026-06-02': 1, '2026-06-03': 1, '2026-06-04': 1, '2026-06-05': 1,
      '2026-07-10': 1
    };
    const result = computeStreaks(log, NOW);
    expect(result.current).toBe(1);
    expect(result.longest).toBe(5);
  });

  it('current streak is 0 when neither today nor yesterday has activity', () => {
    const log = { '2026-07-01': 1 };
    expect(computeStreaks(log, NOW).current).toBe(0);
  });
});
