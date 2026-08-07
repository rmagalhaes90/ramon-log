import { describe, expect, it } from 'vitest';
import {
  bestCompletedSet,
  calculatePlates,
  completedExerciseCount,
  createEntries,
  dateKey,
  estimatedOneRepMax,
  workoutVolume,
} from '../src/features/workouts/model';
import { workoutsSchema } from '../src/domain/schemas';

describe('workouts', () => {
  const workouts = {
    segunda: {
      title: 'Push',
      titleEn: '',
      cardioNote: '',
      abs: [],
      exercises: [
        {
          name: 'Supino',
          sets: 2,
          reps: '10',
          rest: 90,
          equipment: 'barbell' as const,
          muscles: { chest: 1 },
          videoUrl: '',
          videoUrlEn: '',
          exerciseDbId: '',
          notes: '',
        },
      ],
    },
  };
  it('creates one entry per configured set', () => {
    expect(createEntries(workouts, 'segunda')[0]?.sets).toHaveLength(2);
  });
  it('calculates volume using completed sets only', () => {
    const entries = createEntries(workouts, 'segunda');
    const first = entries[0];
    if (!first) throw new Error('fixture');
    first.sets[0] = { kg: 100, reps: 5, done: true };
    first.sets[1] = { kg: 100, reps: 5, done: false };
    expect(workoutVolume(entries)).toBe(500);
    expect(completedExerciseCount(entries)).toBe(1);
  });
  it('formats local dates without UTC drift', () => {
    expect(dateKey(new Date(2026, 7, 2, 23, 0))).toBe('2026-08-02');
  });
  it('calculates e1RM and plate loading defensively', () => {
    expect(estimatedOneRepMax(100, 10)).toBeCloseTo(133.33, 1);
    expect(estimatedOneRepMax(Infinity, 10)).toBe(0);
    expect(calculatePlates(100)).toEqual([25, 15]);
  });
  it('finds records only in completed sets', () => {
    const entries = createEntries(workouts, 'segunda');
    const first = entries[0];
    if (!first) throw new Error('fixture');
    first.sets[0] = { kg: 100, reps: 5, done: true };
    first.sets[1] = { kg: 120, reps: 3, done: false };
    expect(bestCompletedSet(first)?.maxWeight).toBe(100);
  });

  it('accepts legacy rest days stored as null without losing valid routines', () => {
    const parsed = workoutsSchema.parse({ ...workouts, terca: null, domingo: null });
    expect(parsed.segunda?.title).toBe('Push');
    expect(parsed.terca).toBeUndefined();
    expect(parsed.domingo).toBeUndefined();
  });
});
