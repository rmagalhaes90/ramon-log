import { describe, expect, it } from 'vitest';
import { bodyWeightsSchema, exerciseSchema, readinessLogSchema } from '../src/domain/schemas';

describe('domain schemas', () => {
  it('accepts a bounded exercise compatible with the baseline', () => {
    const exercise = exerciseSchema.parse({ name: 'Supino', sets: 4, reps: '8-10', rest: 90 });
    expect(exercise.equipment).toBe('');
    expect(exercise.muscles).toEqual({});
  });

  it('rejects dangerous or unrealistic exercise data', () => {
    expect(() => exerciseSchema.parse({ name: '', sets: 100, reps: '10', rest: 90 })).toThrow();
    expect(() => exerciseSchema.parse({ name: 'X', sets: 4, reps: '10', rest: 90, videoUrl: 'javascript:alert(1)' })).toThrow();
  });

  it('rejects malformed dates and non-finite measurements', () => {
    expect(() => bodyWeightsSchema.parse([{ d: '02/08/2026', kg: 80 }])).toThrow();
    expect(() => bodyWeightsSchema.parse([{ d: '2026-08-02', kg: Number.NaN }])).toThrow();
  });

  it('validates readiness ranges', () => {
    expect(() => readinessLogSchema.parse({ '2026-08-02': { sleep: 9, energy: 3, soreness: 2, stress: 2, score: 50, classification: 'ok', recordedAt: '2026-08-02T12:00:00.000Z' } })).toThrow();
  });
});
