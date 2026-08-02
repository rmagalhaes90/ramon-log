export interface ChartDatum { d: string; value: number }
export interface ChartPoint extends ChartDatum { x: number; y: number }

export function chartPoints(values: ChartDatum[], width = 600, height = 180): ChartPoint[] {
  const clean = values.filter(({ value }) => Number.isFinite(value)).sort((a, b) => a.d.localeCompare(b.d)).slice(-60);
  if (!clean.length) return [];
  const numbers = clean.map(({ value }) => value); const min = Math.min(...numbers); const max = Math.max(...numbers); const range = max - min || 1;
  return clean.map((item, index) => ({ ...item, x: clean.length === 1 ? width / 2 : index / (clean.length - 1) * width, y: height - (item.value - min) / range * height }));
}
