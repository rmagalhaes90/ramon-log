export type ProgressionAction = 'insufficient' | 'increase' | 'maintain' | 'deload' | 'plateau';

export interface PerformanceEntry {
  date: string;
  sets: Array<{ kg: number; reps: number }>;
  e1rm: number;
}

export interface ProgressionRecommendation {
  action: ProgressionAction;
  confidence: 'low' | 'medium' | 'high';
  suggestedLoad: number | null;
}

function bestSet(entry: PerformanceEntry): { kg: number; reps: number } | null {
  return [...entry.sets].sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0] ?? null;
}

export function targetRepMaximum(range: string): number {
  const values = range.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? [];
  return values.length ? Math.max(...values) : 10;
}

export function progressionRecommendation(
  history: PerformanceEntry[],
  repRange: string,
  increment = 2.5,
): ProgressionRecommendation {
  const recent = [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const best = recent.map(bestSet);
  const latest = best[0];
  if (recent.length < 2 || !latest)
    return { action: 'insufficient', confidence: 'low', suggestedLoad: null };

  const target = targetRepMaximum(repRange);
  const previous = best[1];
  if (previous && latest.reps >= target && previous.reps >= target && latest.kg >= previous.kg) {
    const step = Math.max(0.25, increment);
    const suggestedLoad = Math.round((latest.kg + step) / step) * step;
    return {
      action: 'increase',
      confidence: recent.length >= 3 ? 'high' : 'medium',
      suggestedLoad,
    };
  }

  if (recent.length >= 3 && recent[0] && recent[2] && recent[0].e1rm < recent[2].e1rm * 0.92)
    return {
      action: 'deload',
      confidence: 'high',
      suggestedLoad: Math.round(latest.kg * 0.9 * 2) / 2,
    };

  if (
    recent.length >= 3 &&
    best.every((set) => set && set.kg === latest.kg && set.reps === latest.reps)
  )
    return { action: 'plateau', confidence: 'medium', suggestedLoad: latest.kg };

  return { action: 'maintain', confidence: 'medium', suggestedLoad: latest.kg };
}
