import type { Exercise, Workouts } from '../../domain/schemas';
import { exerciseCatalog } from '../catalog';
import { pickDiverseExercises } from './generator';
import type { DayKey } from './model';

export type TemplateKey =
  'fullbody' | 'upperLower' | 'ppl' | 'pplUpperLower' | 'broSplit' | 'fullBody5x';

const muscleGroups: Record<string, string[]> = {
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['upperback', 'lats', 'biceps'],
  legs: ['quads', 'glutes', 'hamstrings', 'calves'],
  upper: ['chest', 'shoulders', 'upperback', 'lats', 'biceps', 'triceps'],
  full: ['quads', 'glutes', 'chest', 'upperback', 'lats', 'shoulders'],
  chest: ['chest'],
  back: ['upperback', 'lats'],
  shoulders: ['shoulders', 'traps'],
  arms: ['biceps', 'triceps', 'forearms'],
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

function routine(
  title: string,
  groups: string[],
  excludeNames: string[] = [],
  titleEn: string = title,
) {
  return {
    title,
    titleEn,
    cardioNote: '',
    exercises: pickDiverseExercises(groups, 6, excludeNames),
    abs: [],
  };
}

const names = (workout: { exercises: Exercise[] }) => workout.exercises.map((item) => item.name);

export function createTemplate(key: TemplateKey): Workouts {
  if (key === 'fullbody') {
    const a = routine('Full Body A', muscleGroups.full ?? []);
    const b = routine('Full Body B', muscleGroups.full ?? [], names(a));
    const c = routine('Full Body C', muscleGroups.full ?? [], [...names(a), ...names(b)]);
    return { segunda: a, quarta: b, sexta: c };
  }
  if (key === 'upperLower') {
    const upperA = routine('Upper A', muscleGroups.upper ?? []);
    const lowerA = routine('Lower A', muscleGroups.legs ?? []);
    const upperB = routine('Upper B', muscleGroups.upper ?? [], names(upperA));
    const lowerB = routine('Lower B', muscleGroups.legs ?? [], names(lowerA));
    return { segunda: upperA, terca: lowerA, quinta: upperB, sexta: lowerB };
  }
  if (key === 'ppl') {
    const push = routine('Push', muscleGroups.push ?? []);
    const pull = routine('Pull', muscleGroups.pull ?? []);
    const legs = routine('Legs', muscleGroups.legs ?? []);
    const pushB = routine('Push B', muscleGroups.push ?? [], names(push));
    const pullB = routine('Pull B', muscleGroups.pull ?? [], names(pull));
    const legsB = routine('Legs B', muscleGroups.legs ?? [], names(legs));
    return {
      segunda: push,
      terca: pull,
      quarta: legs,
      quinta: pushB,
      sexta: pullB,
      sabado: legsB,
    };
  }
  if (key === 'pplUpperLower')
    return {
      segunda: routine('Push', muscleGroups.push ?? []),
      terca: routine('Pull', muscleGroups.pull ?? []),
      quarta: routine('Legs', muscleGroups.legs ?? []),
      quinta: routine('Upper', muscleGroups.upper ?? []),
      sexta: routine('Lower', muscleGroups.legs ?? []),
    };
  if (key === 'broSplit')
    return {
      segunda: routine('Peito', muscleGroups.chest ?? [], [], 'Chest'),
      terca: routine('Costas', muscleGroups.back ?? [], [], 'Back'),
      quarta: routine('Pernas', muscleGroups.legs ?? [], [], 'Legs'),
      quinta: routine('Ombros', muscleGroups.shoulders ?? [], [], 'Shoulders'),
      sexta: routine('Braços', muscleGroups.arms ?? [], [], 'Arms'),
    };
  const fullBodyDays: Array<[DayKey, string]> = [
    ['segunda', 'Full Body A'],
    ['terca', 'Full Body B'],
    ['quarta', 'Full Body C'],
    ['quinta', 'Full Body D'],
    ['sexta', 'Full Body E'],
  ];
  const result: Workouts = {};
  let excluded: string[] = [];
  for (const [day, title] of fullBodyDays) {
    const day_ = routine(title, muscleGroups.full ?? [], excluded);
    result[day] = day_;
    excluded = [...excluded, ...names(day_)];
  }
  return result;
}

export function reorderExercise(
  workouts: Workouts,
  day: DayKey,
  fromIndex: number,
  toIndex: number,
): Workouts {
  const current = workouts[day];
  if (!current) return workouts;
  const { length } = current.exercises;
  if (fromIndex < 0 || fromIndex >= length || toIndex < 0 || toIndex >= length) return workouts;
  const exercises = [...current.exercises];
  const [item] = exercises.splice(fromIndex, 1);
  if (!item) return workouts;
  exercises.splice(toIndex, 0, item);
  return { ...workouts, [day]: { ...current, exercises } };
}

export function moveExercise(
  workouts: Workouts,
  day: DayKey,
  index: number,
  direction: -1 | 1,
): Workouts {
  return reorderExercise(workouts, day, index, index + direction);
}
