import { describe, expect, it } from 'vitest';
import {
  progressionRecommendation,
  targetRepMaximum,
} from '../src/features/intelligence/progression';

const entry = (date: string, kg: number, reps: number, e1rm = kg * (1 + reps / 30)) => ({
  date,
  sets: [{ kg, reps }],
  e1rm,
});

describe('progression engine', () => {
  it('parses rep ranges and suggests the next safe increment after repeated success', () => {
    expect(targetRepMaximum('8-12')).toBe(12);
    expect(
      progressionRecommendation(
        [entry('2026-08-01', 30, 12), entry('2026-07-28', 30, 12)],
        '8-12',
        2,
      ),
    ).toMatchObject({ action: 'increase', suggestedLoad: 32 });
  });

  it('requires evidence and detects sustained regression or a plateau', () => {
    expect(progressionRecommendation([entry('2026-08-01', 30, 10)], '8-12').action).toBe(
      'insufficient',
    );
    expect(
      progressionRecommendation(
        [
          entry('2026-08-01', 40, 6, 45),
          entry('2026-07-25', 42, 7, 50),
          entry('2026-07-18', 45, 8, 55),
        ],
        '8-12',
      ).action,
    ).toBe('deload');
    expect(
      progressionRecommendation(
        [entry('2026-08-01', 40, 8), entry('2026-07-25', 40, 8), entry('2026-07-18', 40, 8)],
        '8-12',
      ).action,
    ).toBe('plateau');
  });

  it('does not increase load when the latest set reached failure', () => {
    const result = progressionRecommendation(
      [
        { ...entry('2026-08-01', 30, 12), sets: [{ kg: 30, reps: 12, rir: 0 }] },
        entry('2026-07-28', 30, 12),
      ],
      '8-12',
    );
    expect(result.action).toBe('maintain');
  });
});
