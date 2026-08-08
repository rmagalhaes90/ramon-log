export interface DatedValue {
  d: string;
  value: number;
}

export function seriesDelta(values: DatedValue[]): number | null {
  if (values.length < 2) return null;
  const sorted = [...values].sort((a, b) => a.d.localeCompare(b.d));
  const first = sorted[0];
  const last = sorted.at(-1);
  return first && last ? last.value - first.value : null;
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
