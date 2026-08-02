import type { Exercise, LoggedSet, Workouts } from '../../domain/schemas';

export const dayKeys = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
] as const;
export type DayKey = (typeof dayKeys)[number];

export interface SetEntry extends LoggedSet {
  done: boolean;
}
export interface ExerciseEntry {
  exercise: Exercise;
  sets: SetEntry[];
}

export function todayDayKey(date = new Date()): DayKey {
  return dayKeys[date.getDay()] ?? 'domingo';
}
export function dateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
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
  return entries
    .flatMap(({ sets }) => sets)
    .filter(({ done }) => done)
    .reduce((total, set) => total + set.kg * set.reps, 0);
}

export function completedExerciseCount(entries: ExerciseEntry[]): number {
  return entries.filter(({ sets }) => sets.some(({ done }) => done)).length;
}

export function estimatedOneRepMax(kg: number, reps: number): number {
  if (!Number.isFinite(kg) || !Number.isFinite(reps) || kg <= 0 || reps <= 0) return 0;
  return reps === 1 ? kg : kg * (1 + Math.min(reps, 100) / 30);
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

export function calculatePlates(
  targetKg: number,
  barKg = 20,
  available = [25, 20, 15, 10, 5, 2.5, 1.25],
): number[] {
  if (!Number.isFinite(targetKg) || targetKg <= barKg) return [];
  let side = (targetKg - barKg) / 2;
  const plates: number[] = [];
  for (const plate of available) {
    while (side + 1e-9 >= plate) {
      plates.push(plate);
      side -= plate;
    }
  }
  return plates;
}
