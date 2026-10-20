/** Tiny trend line for KPI tiles. Flat line when all values are equal. */
export function Sparkline({ values, color, width = 72, height = 22 }: { values: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" points={points}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}
