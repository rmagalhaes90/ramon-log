export { readinessClass, readinessScore } from '@kyro/domain';

export function weightDelta(weights: Array<{ d: string; kg: number }>): number | null {
  if (weights.length < 2) return null;
  const sorted = [...weights].sort((a, b) => a.d.localeCompare(b.d));
  const first = sorted[0];
  const last = sorted.at(-1);
  return first && last ? last.kg - first.kg : null;
}
