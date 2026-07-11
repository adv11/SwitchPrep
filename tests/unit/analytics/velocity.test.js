import { describe, it, expect } from 'vitest';
import { computeVelocity } from '../../../src/core/analytics/velocity.js';

const NOW = new Date(2026, 6, 10).getTime(); // 2026-07-10

describe('computeVelocity', () => {
  it('returns 0 for an empty log', () => {
    expect(computeVelocity({}, NOW)).toBe(0);
  });

  it('averages over a fixed 7-day denominator, zero days included', () => {
    // Only 2 of the trailing 7 days have activity (7 total, denominator stays 7).
    const log = { '2026-07-10': 7, '2026-07-09': 7 };
    expect(computeVelocity(log, NOW)).toBe(2);
  });

  it('ignores activity outside the trailing 7-day window', () => {
    const log = { '2026-07-10': 7, '2026-07-01': 100 };
    expect(computeVelocity(log, NOW)).toBe(1);
  });

  it('includes today in the window', () => {
    const log = { '2026-07-10': 14 };
    expect(computeVelocity(log, NOW)).toBe(2);
  });
});
