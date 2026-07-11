import { describe, it, expect } from 'vitest';
import { dateKey, previousDateKey } from '../../../src/core/analytics/dateKey.js';

describe('dateKey', () => {
  it('formats as zero-padded YYYY-MM-DD in local time', () => {
    expect(dateKey(new Date(2026, 0, 5).getTime())).toBe('2026-01-05');
    expect(dateKey(new Date(2026, 11, 31).getTime())).toBe('2026-12-31');
  });
});

describe('previousDateKey', () => {
  it('steps back one calendar day', () => {
    expect(previousDateKey('2026-07-04')).toBe('2026-07-03');
  });

  it('crosses a month boundary', () => {
    expect(previousDateKey('2026-03-01')).toBe('2026-02-28');
  });

  it('crosses a year boundary', () => {
    expect(previousDateKey('2026-01-01')).toBe('2025-12-31');
  });

  it('handles a leap-year February', () => {
    expect(previousDateKey('2024-03-01')).toBe('2024-02-29');
  });
});
