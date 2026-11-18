"use client";

import { useMemo, useState } from "react";
import { formatDateUz, formatKg } from "@/lib/workout";

// Oddiy chiziqli grafik (SVG, kutubxonasiz): progress — eskisidan yangisiga. Nuqta bosilsa qiymati ko'rinadi.
export function LineChart({ points, unit, today }: { points: { date: string; value: number }[]; unit: string; today?: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const W = 320, H = 150, PX = 14, PT = 14, PB = 22;
  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const vals = points.map((p) => p.value);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min = min - Math.max(1, min * 0.1); max = max + Math.max(1, max * 0.1); }
    const pad = (max - min) * 0.12; min -= pad; max += pad;
    const x = (i: number) => (points.length === 1 ? W / 2 : PX + (i * (W - 2 * PX)) / (points.length - 1));
    const y = (v: number) => PT + (1 - (v - min) / (max - min)) * (H - PT - PB);
    return { x, y, xy: points.map((p, i) => [x(i), y(p.value)] as const) };
  }, [points]);
  if (!geo) return null;
  const line = geo.xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${geo.xy[geo.xy.length - 1][0].toFixed(1)},${H - PB} L${geo.xy[0][0].toFixed(1)},${H - PB} Z`;
  const active = sel ?? points.length - 1;
  const last = points[active];
  return (
    <div data-testid="line-chart">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-lg font-semibold text-white" data-testid="chart-value">{formatKg(last.value)} <span className="text-xs text-white/40 font-normal">{unit}</span></span>
        <span className="text-xs text-white/40">{formatDateUz(last.date, today)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Progress grafigi">
        <defs>
          <linearGradient id="wl-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="text-lime">
          {points.length > 1 && <path d={area} fill="url(#wl-fill)" />}
          {points.length > 1 && <path d={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {geo.xy.map(([x, y], i) => (
            <g key={i} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
              <circle cx={x} cy={y} r="12" fill="transparent" />
              <circle cx={x} cy={y} r={i === active ? 5 : 3} fill="currentColor" stroke={i === active ? "var(--dark-surface, #141414)" : "none"} strokeWidth="2" />
            </g>
          ))}
        </g>
        <text x={PX} y={H - 6} className="fill-current text-white/30" fontSize="10">{formatDateUz(points[0].date, today)}</text>
        {points.length > 1 && <text x={W - PX} y={H - 6} textAnchor="end" className="fill-current text-white/30" fontSize="10">{formatDateUz(points[points.length - 1].date, today)}</text>}
      </svg>
    </div>
  );
}
