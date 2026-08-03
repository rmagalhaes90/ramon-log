import type { Exercise } from '../../domain/schemas';

export type MeasurementKey = 'waist' | 'chest' | 'arm' | 'hip' | 'thigh';
export interface DatedValue {
  d: string;
  value: number;
}

export function measurementSeries(
  measurements: Record<string, Partial<Record<MeasurementKey, number | undefined>>>,
  key: MeasurementKey,
): DatedValue[] {
  return Object.entries(measurements)
    .flatMap(([d, values]) => {
      const value = values[key];
      return typeof value === 'number' && Number.isFinite(value) ? [{ d, value }] : [];
    })
    .sort((a, b) => a.d.localeCompare(b.d));
}

export function seriesDelta(values: DatedValue[]): number | null {
  if (values.length < 2) return null;
  const sorted = [...values].sort((a, b) => a.d.localeCompare(b.d));
  const first = sorted[0];
  const last = sorted.at(-1);
  return first && last ? last.value - first.value : null;
}

interface HistoryEntry {
  date: string;
  sets: Array<{ kg: number; reps: number }>;
}

export function muscleVolume(
  history: Record<string, HistoryEntry[]>,
  catalog: Exercise[],
  since?: string,
): Array<{ muscle: string; volume: number }> {
  const exerciseByName = new Map(catalog.map((exercise) => [exercise.name, exercise]));
  const totals = new Map<string, number>();
  Object.entries(history).forEach(([name, entries]) => {
    const exercise = exerciseByName.get(name);
    if (!exercise) return;
    entries
      .filter((entry) => !since || entry.date >= since)
      .forEach((entry) => {
        const volume = entry.sets.reduce((sum, set) => sum + set.kg * set.reps, 0);
        Object.entries(exercise.muscles).forEach(([muscle, contribution]) => {
          if (contribution > 0)
            totals.set(muscle, (totals.get(muscle) ?? 0) + volume * contribution);
        });
      });
  });
  return [...totals]
    .map(([muscle, volume]) => ({ muscle, volume }))
    .sort((a, b) => b.volume - a.volume || a.muscle.localeCompare(b.muscle));
}

export function pearsonCorrelation(pairs: Array<{ x: number; y: number }>): number | null {
  const clean = pairs.filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y));
  if (clean.length < 3) return null;
  const meanX = clean.reduce((sum, pair) => sum + pair.x, 0) / clean.length;
  const meanY = clean.reduce((sum, pair) => sum + pair.y, 0) / clean.length;
  const numerator = clean.reduce((sum, pair) => sum + (pair.x - meanX) * (pair.y - meanY), 0);
  const varianceX = clean.reduce((sum, pair) => sum + (pair.x - meanX) ** 2, 0);
  const varianceY = clean.reduce((sum, pair) => sum + (pair.y - meanY) ** 2, 0);
  const denominator = Math.sqrt(varianceX * varianceY);
  return denominator ? Math.max(-1, Math.min(1, numerator / denominator)) : null;
}

export function readinessPerformanceCorrelation(
  readiness: Record<string, { score: number }>,
  sessions: Array<{ date: string; volume: number }>,
): { correlation: number | null; samples: number } {
  const volumeByDate = new Map<string, number>();
  sessions.forEach((session) =>
    volumeByDate.set(session.date, (volumeByDate.get(session.date) ?? 0) + session.volume),
  );
  const pairs = Object.entries(readiness).flatMap(([date, entry]) => {
    const volume = volumeByDate.get(date);
    return volume === undefined ? [] : [{ x: entry.score, y: volume }];
  });
  return { correlation: pearsonCorrelation(pairs), samples: pairs.length };
}
