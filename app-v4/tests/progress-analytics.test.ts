import { describe, expect, it } from 'vitest';
import type { Exercise } from '../src/domain/schemas';
import {
  measurementSeries,
  muscleVolume,
  readinessPerformanceCorrelation,
  seriesDelta,
} from '../src/features/progress/analytics';

describe('premium progress analytics', () => {
  it('creates chronological measurement trends', () => {
    const series = measurementSeries(
      {
        '2026-08-03': { waist: 80 },
        '2026-08-01': { waist: 82, arm: 40 },
      },
      'waist',
    );
    expect(series.map(({ value }) => value)).toEqual([82, 80]);
    expect(seriesDelta(series)).toBe(-2);
  });

  it('distributes exercise volume by muscle contribution', () => {
    const exercise = {
      name: 'Press',
      sets: 3,
      reps: '10',
      rest: 90,
      equipment: 'barbell',
      muscles: { chest: 1, triceps: 0.5 },
      videoUrl: '',
      videoUrlEn: '',
      exerciseDbId: '',
      notes: '',
    } satisfies Exercise;
    expect(
      muscleVolume({ Press: [{ date: '2026-08-03', sets: [{ kg: 100, reps: 10 }] }] }, [exercise]),
    ).toEqual([
      { muscle: 'chest', volume: 1000 },
      { muscle: 'triceps', volume: 500 },
    ]);
  });

  it('correlates readiness and same-day performance with a sample gate', () => {
    const result = readinessPerformanceCorrelation(
      {
        '2026-08-01': { score: 20 },
        '2026-08-02': { score: 50 },
        '2026-08-03': { score: 90 },
      },
      [
        { date: '2026-08-01', volume: 100 },
        { date: '2026-08-02', volume: 300 },
        { date: '2026-08-03', volume: 600 },
      ],
    );
    expect(result.samples).toBe(3);
    expect(result.correlation).toBeGreaterThan(0.99);
    expect(readinessPerformanceCorrelation({}, []).correlation).toBeNull();
  });
});
