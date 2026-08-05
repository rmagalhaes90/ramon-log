import { describe, expect, it } from 'vitest';
import {
  generateWorkout,
  pickDiverseExercises,
  MUSCLE_GROUPS,
  INTENSITY_LEVELS,
} from '../src/features/workouts/generator';
import { exerciseCatalog } from '../src/features/catalog';

describe('workout generator', () => {
  it('picks exercises that actually target the requested muscles, without duplicates', () => {
    const picks = pickDiverseExercises(MUSCLE_GROUPS.chest, 5);
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.length).toBeLessThanOrEqual(5);
    const names = new Set(picks.map((exercise) => exercise.name));
    expect(names.size).toBe(picks.length);
    picks.forEach((exercise) => {
      expect(MUSCLE_GROUPS.chest.some((muscle) => (exercise.muscles[muscle] ?? 0) > 0)).toBe(true);
    });
  });

  it('respects an equipment filter', () => {
    const picks = pickDiverseExercises(MUSCLE_GROUPS.legs, 10, [], ['bodyweight']);
    picks.forEach((exercise) => expect(exercise.equipment).toBe('bodyweight'));
  });

  it('scales exercise count with intensity and applies sets/reps/rest from the level', () => {
    const light = generateWorkout(['chest'], 'light');
    const heavy = generateWorkout(['chest'], 'heavy');
    expect(light.exercises.length).toBeLessThanOrEqual(INTENSITY_LEVELS.light.exerciseCount);
    expect(heavy.exercises.length).toBeGreaterThanOrEqual(light.exercises.length);
    light.exercises.forEach((exercise) => {
      expect(exercise.sets).toBe(INTENSITY_LEVELS.light.sets);
      expect(exercise.reps).toBe(INTENSITY_LEVELS.light.reps);
      expect(exercise.rest).toBe(INTENSITY_LEVELS.light.rest);
    });
  });

  it('adds bonus ab exercises unless abs was explicitly picked', () => {
    const withoutAbs = generateWorkout(['chest'], 'medium');
    const withAbs = generateWorkout(['abs'], 'medium');
    expect(withoutAbs.abs.length).toBeGreaterThan(0);
    expect(withAbs.abs.length).toBe(0);
  });

  it('combines multiple muscle groups into a single routine', () => {
    const combo = generateWorkout(['push', 'pull'], 'medium');
    expect(combo.exercises.length).toBeGreaterThan(0);
  });

  it('never returns more real exercises than exist in the catalog for a tiny filtered pool', () => {
    const picks = pickDiverseExercises(['chest'], 1000, [], ['cable']);
    const catalogCount = exerciseCatalog.filter(
      (exercise) => exercise.equipment === 'cable' && (exercise.muscles.chest ?? 0) > 0,
    ).length;
    expect(picks.length).toBe(catalogCount);
  });
});
