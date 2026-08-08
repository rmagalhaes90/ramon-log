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

export function todayDayKey(date = new Date()): DayKey {
  return dayKeys[date.getDay()] ?? 'domingo';
}

export function dateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function estimatedOneRepMax(kg: number, reps: number): number {
  if (!Number.isFinite(kg) || !Number.isFinite(reps) || kg <= 0 || reps <= 0) return 0;
  return reps === 1 ? kg : kg * (1 + Math.min(reps, 100) / 30);
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
