import { dateKey } from './workouts';

export interface DashboardSummary {
  weight: number | null;
  weeklySessions: number;
  weeklyVolume: number;
  readiness: number | null;
  calories: number;
  protein: number;
  water: number;
}

export function dashboardSummary(
  weights: Array<{ d: string; kg: number }> | null,
  sessions: Array<{ date: string; volume: number }> | null,
  readiness: Record<string, { score: number }> | null,
  nutrition: Record<string, { kcal: number; protein: number; water: number }> | null,
  now = new Date(),
): DashboardSummary {
  const today = dateKey(now);
  const since = dateKey(new Date(now.getTime() - 6 * 86_400_000));
  const latestWeight = weights
    ? ([...weights].sort((a, b) => b.d.localeCompare(a.d))[0]?.kg ?? null)
    : null;
  const weekly =
    sessions?.filter((session) => session.date >= since && session.date <= today) ?? [];
  const todayNutrition = nutrition?.[today];
  return {
    weight: latestWeight,
    weeklySessions: weekly.length,
    weeklyVolume: weekly.reduce((sum, session) => sum + session.volume, 0),
    readiness: readiness?.[today]?.score ?? null,
    calories: todayNutrition?.kcal ?? 0,
    protein: todayNutrition?.protein ?? 0,
    water: todayNutrition?.water ?? 0,
  };
}
