import {
  calculatePlates,
  dateKey,
  dayKeys,
  estimatedOneRepMax,
  todayDayKey,
  type DayKey,
} from '@kyro/domain';

import type { Exercise, LoggedSet, Workouts } from '../../domain/schemas';

export { calculatePlates, dateKey, dayKeys, estimatedOneRepMax, todayDayKey };
export type { DayKey };

export interface SetEntry extends LoggedSet {
  done: boolean;
}
export interface ExerciseEntry {
  exercise: Exercise;
  sets: SetEntry[];
}

export function createEntries(workouts: Workouts, day: DayKey): ExerciseEntry[] {
  const workout = workouts[day];
  if (!workout) return [];
  return [...workout.exercises, ...workout.abs].map((exercise) => ({
    exercise,
    sets: Array.from({ length: exercise.sets }, () => ({
      kg: 0,
      reps: 0,
      done: false,
      rir: undefined,
      rpe: undefined,
    })),
  }));
}

export function workoutVolume(entries: ExerciseEntry[]): number {
  return entries
    .flatMap(({ sets }) => sets)
    .filter(({ done }) => done)
    .reduce((total, set) => total + set.kg * set.reps, 0);
}

export function completedExerciseCount(entries: ExerciseEntry[]): number {
  return entries.filter(({ sets }) => sets.some(({ done }) => done)).length;
}

export function bestCompletedSet(
  entry: ExerciseEntry,
): { maxWeight: number; maxWeightReps: number; maxE1rm: number } | null {
  const sets = entry.sets.filter((set) => set.done && set.kg > 0 && set.reps > 0);
  if (!sets.length) return null;
  const heaviest = [...sets].sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0];
  return heaviest
    ? {
        maxWeight: heaviest.kg,
        maxWeightReps: heaviest.reps,
        maxE1rm: Math.max(...sets.map((set) => estimatedOneRepMax(set.kg, set.reps))),
      }
    : null;
}
