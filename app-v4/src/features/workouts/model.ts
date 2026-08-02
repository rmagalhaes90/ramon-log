import type { Exercise, LoggedSet, Workouts } from '../../domain/schemas';

export const dayKeys = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const;
export type DayKey = (typeof dayKeys)[number];

export interface SetEntry extends LoggedSet { done: boolean }
export interface ExerciseEntry { exercise: Exercise; sets: SetEntry[] }

export function todayDayKey(date = new Date()): DayKey { return dayKeys[date.getDay()] ?? 'domingo'; }
export function dateKey(date = new Date()): string {
  const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createEntries(workouts: Workouts, day: DayKey): ExerciseEntry[] {
  const workout = workouts[day];
  if (!workout) return [];
  return [...workout.exercises, ...workout.abs].map((exercise) => ({
    exercise,
    sets: Array.from({ length: exercise.sets }, () => ({ kg: 0, reps: 0, done: false })),
  }));
}

export function workoutVolume(entries: ExerciseEntry[]): number {
  return entries.flatMap(({ sets }) => sets).filter(({ done }) => done).reduce((total, set) => total + set.kg * set.reps, 0);
}

export function completedExerciseCount(entries: ExerciseEntry[]): number {
  return entries.filter(({ sets }) => sets.some(({ done }) => done)).length;
}
