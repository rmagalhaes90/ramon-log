import { describe, expect, it } from 'vitest';
import { translateExerciseNameToEnglish } from '../src/features/catalog/translateExerciseName';

describe('translateExerciseNameToEnglish', () => {
  it('translates common catalog exercise names to searchable English terms', () => {
    expect(translateExerciseNameToEnglish('Supino Reto')).toBe('bench press flat');
    expect(translateExerciseNameToEnglish('Agachamento Livre')).toBe('squat free');
    expect(translateExerciseNameToEnglish('Rosca Direta com Halteres')).toBe(
      'curl straight bar with dumbbell',
    );
    expect(translateExerciseNameToEnglish('Levantamento Terra Romeno')).toBe(
      'deadlift deadlift romanian',
    );
  });

  it('drops parenthetical hints and falls back to the original word when unmapped', () => {
    expect(translateExerciseNameToEnglish('Ab Wheel (Roda Abdominal)')).toBe('Ab Wheel');
    expect(translateExerciseNameToEnglish('Xyzzy Unknown Move')).toContain('Xyzzy');
  });

  it('never returns an empty string', () => {
    expect(translateExerciseNameToEnglish('de na no em')).toBe('de na no em');
  });
});
