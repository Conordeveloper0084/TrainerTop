"use client";

import { formatPrice } from "@/lib/utils";

export interface MonthPoint {
  month: string; // "2026-09"
  gross: number;
  commission: number;
  net: number;
  sales: number;
}

const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

// Oylik sof daromad — oddiy SVG ustunlar (tashqi kutubxonasiz)
export function MonthlyChart({ data }: { data: MonthPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.net));
  const hasAny = data.some((d) => d.net > 0 || d.sales > 0);
  const W = 600, H = 150, PAD_B = 22, PAD_T = 8;
  const slot = W / Math.max(1, data.length);
  const bw = Math.min(28, slot * 0.6);

  if (!hasAny) {
    return <p className="text-xs text-white/30 text-center py-8">Hali sotuv yo'q. Birinchi sotuvdan keyin grafik shu yerda chiqadi.</p>;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Oylik sof daromad">
      {data.map((d, i) => {
        const h = Math.max(d.net > 0 ? 3 : 0, ((H - PAD_B - PAD_T) * d.net) / max);
        const x = i * slot + (slot - bw) / 2;
        const y = H - PAD_B - h;
        const isLast = i === data.length - 1;
        const mi = parseInt(d.month.slice(5, 7), 10) - 1;
        return (
          <g key={d.month}>
            <title>{`${MONTHS[mi]} ${d.month.slice(0, 4)}: ${formatPrice(d.net)} (${d.sales} ta sotuv)`}</title>
            <rect x={x} y={y} width={bw} height={h} rx={4} fill={isLast ? "#B4FF00" : "rgba(180,255,0,0.35)"} />
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.35)">{MONTHS[mi]}</text>
          </g>
        );
      })}
    </svg>
  );
}
