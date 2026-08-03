import { describe, expect, it } from 'vitest';

import {
  calculatePlates,
  dashboardSummary,
  estimatedOneRepMax,
  hasRevisionConflict,
  pearsonCorrelation,
} from '../src';

describe('shared KYRO domain', () => {
  it('keeps workout calculations platform independent', () => {
    expect(estimatedOneRepMax(100, 10)).toBeCloseTo(133.33, 2);
    expect(calculatePlates(100)).toEqual([25, 15]);
  });

  it('calculates a bounded correlation with enough samples', () => {
    expect(
      pearsonCorrelation([
        { x: 1, y: 10 },
        { x: 2, y: 20 },
        { x: 3, y: 30 },
      ]),
    ).toBe(1);
  });

  it('summarizes the same dashboard data on every platform', () => {
    expect(
      dashboardSummary(
        [{ d: '2026-08-02', kg: 80 }],
        [
          { date: '2026-07-20', volume: 999 },
          { date: '2026-08-01', volume: 1200 },
        ],
        { '2026-08-03': { score: 84 } },
        { '2026-08-03': { kcal: 2100, protein: 170, water: 2.5 } },
        new Date('2026-08-03T12:00:00'),
      ),
    ).toEqual({
      weight: 80,
      weeklySessions: 1,
      weeklyVolume: 1200,
      readiness: 84,
      calories: 2100,
      protein: 170,
      water: 2.5,
    });
  });

  it('prevents an older device from overwriting a newer remote revision', () => {
    expect(
      hasRevisionConflict('2026-08-03T12:00:00Z', '2026-08-03T10:00:00Z', { kg: 81 }, { kg: 80 }),
    ).toBe(true);
    expect(
      hasRevisionConflict('2026-08-03T12:00:00Z', '2026-08-03T10:00:00Z', { kg: 80 }, { kg: 80 }),
    ).toBe(false);
  });
});
