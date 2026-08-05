import type { Exercise, Workouts } from '../../domain/schemas';
import { exerciseCatalog } from '../catalog';

type Equipment = Exercise['equipment'];
type WorkoutDay = NonNullable<Workouts[keyof Workouts]>;

export type MuscleGroupKey =
  'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'abs' | 'push' | 'pull' | 'fullbody';

export const MUSCLE_GROUPS: Record<MuscleGroupKey, readonly string[]> = {
  chest: ['chest'],
  back: ['upperback', 'lats'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  shoulders: ['shoulders', 'traps'],
  arms: ['biceps', 'triceps', 'forearms'],
  abs: ['abs', 'obliques'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['upperback', 'lats', 'biceps'],
  fullbody: [
    'quads',
    'hamstrings',
    'glutes',
    'chest',
    'upperback',
    'lats',
    'shoulders',
    'biceps',
    'triceps',
    'calves',
  ],
};

export type IntensityKey = 'light' | 'medium' | 'heavy';

interface IntensityLevel {
  exerciseCount: number;
  sets: number;
  reps: string;
  rest: number;
}

export const INTENSITY_LEVELS: Record<IntensityKey, IntensityLevel> = {
  light: { exerciseCount: 3, sets: 3, reps: '12-15', rest: 45 },
  medium: { exerciseCount: 5, sets: 4, reps: '8-12', rest: 75 },
  heavy: { exerciseCount: 6, sets: 5, reps: '5-8', rest: 105 },
};

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}

/** Picks up to `count` exercises spread across the primary muscle each one best targets, for variety. */
export function pickDiverseExercises(
  muscleKeys: readonly string[],
  count: number,
  excludeNames: readonly string[] = [],
  equipmentFilter: readonly Equipment[] = [],
  catalog: Exercise[] = exerciseCatalog,
): Exercise[] {
  const scored = catalog
    .filter((exercise) => !excludeNames.includes(exercise.name))
    .filter((exercise) => !equipmentFilter.length || equipmentFilter.includes(exercise.equipment))
    .map((exercise) => ({
      exercise,
      score: muscleKeys.reduce((sum, muscle) => sum + (exercise.muscles[muscle] ?? 0), 0),
    }))
    .filter(({ score }) => score > 0);

  const byPrimaryMuscle = new Map<string, Exercise[]>();
  scored.forEach(({ exercise }) => {
    let bestMuscle: string | null = null;
    let bestValue = -1;
    Object.entries(exercise.muscles).forEach(([muscle, value]) => {
      if (muscleKeys.includes(muscle) && value > bestValue) {
        bestValue = value;
        bestMuscle = muscle;
      }
    });
    const key = bestMuscle ?? '';
    byPrimaryMuscle.set(key, [...(byPrimaryMuscle.get(key) ?? []), exercise]);
  });
  const buckets = shuffle([...byPrimaryMuscle.keys()]).map((key) => ({
    key,
    items: shuffle(byPrimaryMuscle.get(key) ?? []),
  }));

  const picked: Exercise[] = [];
  let index = 0;
  while (picked.length < count && buckets.some((bucket) => bucket.items.length)) {
    const bucket = buckets[index % buckets.length];
    const next = bucket?.items.shift();
    if (next) picked.push(next);
    index += 1;
  }
  return picked;
}

function toRoutineExercise(exercise: Exercise, sets: number, reps: string, rest: number): Exercise {
  return { ...exercise, sets, reps, rest };
}

/** Generates a single day's routine for the chosen muscle groups/intensity/equipment, mirroring the legacy app's auto-generator. */
export function generateWorkout(
  groupKeys: readonly MuscleGroupKey[],
  intensityKey: IntensityKey,
  equipmentFilter: readonly Equipment[] = [],
  catalog: Exercise[] = exerciseCatalog,
): WorkoutDay {
  const level = INTENSITY_LEVELS[intensityKey];
  const combinedMuscles = [...new Set(groupKeys.flatMap((key) => MUSCLE_GROUPS[key]))];
  const totalCount = Math.max(
    level.exerciseCount,
    Math.round(level.exerciseCount * (0.7 + 0.55 * (groupKeys.length - 1))),
  );
  const mainExercises = pickDiverseExercises(
    combinedMuscles,
    totalCount,
    [],
    equipmentFilter,
    catalog,
  ).map((exercise) => toRoutineExercise(exercise, level.sets, level.reps, level.rest));

  let abs: Exercise[] = [];
  if (!groupKeys.includes('abs')) {
    const abCount = intensityKey === 'light' ? 1 : intensityKey === 'heavy' ? 3 : 2;
    abs = pickDiverseExercises(MUSCLE_GROUPS.abs, abCount, [], equipmentFilter, catalog).map(
      (exercise) =>
        toRoutineExercise(
          exercise,
          Math.min(3, level.sets),
          exercise.reps || '15',
          exercise.rest || 45,
        ),
    );
  }

  return {
    title: '',
    titleEn: '',
    cardioNote: '',
    exercises: mainExercises,
    abs,
  };
}
