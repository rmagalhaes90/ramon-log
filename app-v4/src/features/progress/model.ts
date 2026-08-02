export function readinessScore(sleep: number, energy: number, soreness: number, stress: number): number {
  const clamp = (value: number) => Math.min(5, Math.max(1, Number.isFinite(value) ? value : 1));
  const positive = [clamp(sleep), clamp(energy)].map((value) => (value - 1) / 4);
  const inverse = [clamp(soreness), clamp(stress)].map((value) => 1 - (value - 1) / 4);
  return Math.round(Math.min(100, Math.max(0, [...positive, ...inverse].reduce((sum, value) => sum + value, 0) / 4 * 100)));
}

export function readinessClass(score: number): 'high' | 'normal' | 'reduce' | 'light' | 'rest' {
  if (score >= 80) return 'high'; if (score >= 60) return 'normal'; if (score >= 40) return 'reduce'; if (score >= 20) return 'light'; return 'rest';
}

export function weightDelta(weights: Array<{ d: string; kg: number }>): number | null {
  if (weights.length < 2) return null;
  const sorted = [...weights].sort((a, b) => a.d.localeCompare(b.d));
  const first = sorted[0]; const last = sorted.at(-1); return first && last ? last.kg - first.kg : null;
}
