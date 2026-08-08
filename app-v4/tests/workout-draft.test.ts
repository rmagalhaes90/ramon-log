import { describe, expect, it } from 'vitest';
import { exerciseSchema } from '../src/domain/schemas';
import { createEntries } from '../src/features/workouts/model';
import { parseWorkoutDraft } from '../src/features/workouts/draft';

describe('workout draft compatibility', () => {
  it('validates active values and rejects unbounded sets', () => {
    const exercise = exerciseSchema.parse({ name: 'Squat', sets: 2, reps: '5', rest: 90 });
    const entries = createEntries(
      { segunda: { title: 'A', titleEn: '', cardioNote: '', exercises: [exercise], abs: [] } },
      'segunda',
    );
    entries[0]!.sets[0] = { kg: 100, reps: 5, done: true };
    const draft = parseWorkoutDraft({
      day: 'segunda',
      startedAt: '2026-08-02T12:00:00.000Z',
      updatedAt: '2026-08-02T12:01:00.000Z',
      entries,
    });
    expect(draft.entries[0]?.sets[0]).toEqual({ kg: 100, reps: 5, done: true });
    expect(() =>
      parseWorkoutDraft({
        ...draft,
        entries: [{ exercise, sets: Array(21).fill({ kg: 1, reps: 1, done: false }) }],
      }),
    ).toThrow();
  });
});
