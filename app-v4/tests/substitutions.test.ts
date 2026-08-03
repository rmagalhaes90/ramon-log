import { describe, expect, it } from 'vitest';
import type { Exercise } from '../src/domain/schemas';
import { rankExerciseAlternatives } from '../src/features/workouts/substitutions';

const exercise = (
  name: string,
  equipment: Exercise['equipment'],
  muscles: Record<string, number>,
) =>
  ({
    name,
    equipment,
    muscles,
    sets: 3,
    reps: '10',
    rest: 60,
    videoUrl: '',
    notes: '',
    titleEn: '',
  }) as Exercise;

describe('occupied gym substitutions', () => {
  it('prioritizes muscle overlap and offers alternate equipment', () => {
    const current = exercise('Press A', 'barbell', { chest: 1, triceps: 0.4 });
    const ranked = rankExerciseAlternatives(current, [
      current,
      exercise('Curl', 'dumbbell', { biceps: 1 }),
      exercise('Press B', 'machine', { chest: 0.9, triceps: 0.4 }),
      exercise('Press C', 'barbell', { chest: 0.9 }),
    ]);
    expect(ranked[0]?.exercise.name).toBe('Press B');
    expect(ranked.map(({ exercise: item }) => item.name)).not.toContain('Curl');
  });
});
