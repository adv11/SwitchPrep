import { describe, it, expect } from 'vitest';
import { computeHeatmap, heatLevel } from '../../../src/core/analytics/heatmapData.js';

const NOW = new Date(2026, 6, 10).getTime(); // 2026-07-10

describe('heatLevel', () => {
  it('buckets counts per issue #8 thresholds (0 / 1-2 / 3-4 / 5-6 / 7+)', () => {
    expect(heatLevel(0)).toBe(0);
    expect(heatLevel(1)).toBe(1);
    expect(heatLevel(2)).toBe(1);
    expect(heatLevel(3)).toBe(2);
    expect(heatLevel(4)).toBe(2);
    expect(heatLevel(5)).toBe(3);
    expect(heatLevel(6)).toBe(3);
    expect(heatLevel(7)).toBe(4);
    expect(heatLevel(20)).toBe(4);
  });
});

describe('computeHeatmap', () => {
  it('always generates exactly 364 cells', () => {
    expect(computeHeatmap({}, NOW)).toHaveLength(364);
  });

  it('is ordered oldest-first with today as the last cell', () => {
    const cells = computeHeatmap({}, NOW);
    expect(cells[cells.length - 1].date).toBe('2026-07-10');
    expect(cells[cells.length - 1].isToday).toBe(true);
  });

  it('identifies today correctly and no other cell', () => {
    const cells = computeHeatmap({}, NOW);
    expect(cells.filter(c => c.isToday)).toHaveLength(1);
  });

  it('reflects real counts and levels for tracked days', () => {
    const cells = computeHeatmap({ '2026-07-10': 5 }, NOW);
    const today = cells[cells.length - 1];
    expect(today.count).toBe(5);
    expect(today.level).toBe(3);
  });

  it('renders a day with no entry as a level-0 cell, not omitted', () => {
    const cells = computeHeatmap({}, NOW);
    expect(cells.every(c => c.level === 0 && c.count === 0)).toBe(true);
  });
});
