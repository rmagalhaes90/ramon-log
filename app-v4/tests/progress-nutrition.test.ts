import { describe, expect, it } from 'vitest';
import { readinessClass, readinessScore, weightDelta } from '../src/features/progress/model';
import { emptyNutritionDay, percentage } from '../src/features/nutrition/model';

describe('progress and nutrition', () => {
  it('keeps the baseline readiness formula', () => {
    expect(readinessScore(5, 5, 1, 1)).toBe(100);
    expect(readinessScore(1, 1, 5, 5)).toBe(0);
    expect(readinessClass(60)).toBe('normal');
  });
  it('calculates weight delta chronologically', () => {
    expect(
      weightDelta([
        { d: '2026-02-01', kg: 80 },
        { d: '2026-01-01', kg: 82 },
      ]),
    ).toBe(-2);
  });
  it('inherits nutrition goals without totals', () => {
    const next = emptyNutritionDay({ ...emptyNutritionDay(), proteinGoal: 180, kcal: 2000 });
    expect(next.proteinGoal).toBe(180);
    expect(next.kcal).toBe(0);
  });
  it('bounds percentages', () => {
    expect(percentage(150, 100)).toBe(100);
    expect(percentage(1, 0)).toBe(0);
  });
});
