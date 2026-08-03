import { pearsonCorrelation, seriesDelta, type DatedValue } from '@kyro/domain';

import type { Exercise } from '../../domain/schemas';

export type MeasurementKey = 'waist' | 'chest' | 'arm' | 'hip' | 'thigh';
export { pearsonCorrelation, seriesDelta };
export type { DatedValue };

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
