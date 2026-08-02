import type { Exercise, Workouts } from '../../domain/schemas';
import { exerciseCatalog } from '../catalog';
import type { DayKey } from './model';

export type TemplateKey = 'fullbody' | 'upperLower' | 'ppl';
const muscleGroups: Record<string, string[]> = {
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'lats', 'biceps'],
  legs: ['quads', 'glutes', 'hamstrings', 'calves'],
  upper: ['chest', 'shoulders', 'back', 'lats', 'biceps', 'triceps'],
  full: ['quads', 'glutes', 'chest', 'back', 'lats', 'shoulders'],
};

export function pickExercises(
  groups: string[],
  count = 6,
  catalog: Exercise[] = exerciseCatalog,
): Exercise[] {
  const scored = catalog
    .map((exercise, index) => ({
      exercise,
      index,
      score: groups.reduce((sum, group) => sum + (exercise.muscles[group] ?? 0), 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const used = new Set<string>();
  const result: Exercise[] = [];
  for (const { exercise } of scored) {
    const primary =
      Object.entries(exercise.muscles).sort((a, b) => b[1] - a[1])[0]?.[0] ?? exercise.name;
    if (used.has(primary) && result.length < Math.ceil(count / 2)) continue;
    used.add(primary);
    result.push(exercise);
    if (result.length === count) break;
  }
  return result;
}

function routine(title: string, groups: string[]) {
  return { title, titleEn: title, cardioNote: '', exercises: pickExercises(groups), abs: [] };
}

export function createTemplate(key: TemplateKey): Workouts {
  if (key === 'fullbody')
    return {
      segunda: routine('Full Body A', muscleGroups.full ?? []),
      quarta: routine('Full Body B', muscleGroups.full ?? []),
      sexta: routine('Full Body C', muscleGroups.full ?? []),
    };
  if (key === 'upperLower')
    return {
      segunda: routine('Upper A', muscleGroups.upper ?? []),
      terca: routine('Lower A', muscleGroups.legs ?? []),
      quinta: routine('Upper B', muscleGroups.upper ?? []),
      sexta: routine('Lower B', muscleGroups.legs ?? []),
    };
  return {
    segunda: routine('Push', muscleGroups.push ?? []),
    terca: routine('Pull', muscleGroups.pull ?? []),
    quarta: routine('Legs', muscleGroups.legs ?? []),
    quinta: routine('Push B', muscleGroups.push ?? []),
    sexta: routine('Pull B', muscleGroups.pull ?? []),
    sabado: routine('Legs B', muscleGroups.legs ?? []),
  };
}

export function moveExercise(
  workouts: Workouts,
  day: DayKey,
  index: number,
  direction: -1 | 1,
): Workouts {
  const current = workouts[day];
  if (!current) return workouts;
  const target = index + direction;
  if (target < 0 || target >= current.exercises.length) return workouts;
  const exercises = [...current.exercises];
  const [item] = exercises.splice(index, 1);
  if (!item) return workouts;
  exercises.splice(target, 0, item);
  return { ...workouts, [day]: { ...current, exercises } };
}
