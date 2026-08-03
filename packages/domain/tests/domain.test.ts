import { describe, expect, it } from 'vitest';

import { calculatePlates, estimatedOneRepMax, pearsonCorrelation } from '../src';

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
});
