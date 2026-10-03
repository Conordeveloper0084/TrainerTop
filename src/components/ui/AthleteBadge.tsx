import { cn } from "@/lib/utils";

interface AthleteBadgeProps {
  /** Belgi o'lchami (px). Ism yonida: 16–18, sarlavhada: 22–26 */
  size?: number;
  /** Yozuvli kapsula ko'rinishi */
  label?: boolean;
  /** "trainer" — "TrainerTop Trener" (yashil muhr); "athlete" — "TrainerTop Athlete" (ko'k muhr, atletlar uchun) */
  kind?: "trainer" | "athlete";
  className?: string;
}

// 8 bargli muhr (scalloped seal) — 8 ta yoy, qavariq qismlari yuqoridan boshlanadi.
const SEAL_PATH =
  "M8.26 2.98A4 4 0 0 1 15.74 2.98A4 4 0 0 1 21.02 8.26A4 4 0 0 1 21.02 15.74A4 4 0 0 1 15.74 21.02A4 4 0 0 1 8.26 21.02A4 4 0 0 1 2.98 15.74A4 4 0 0 1 2.98 8.26A4 4 0 0 1 8.26 2.98Z";

const KINDS = {
  trainer: { name: "TrainerTop Trener", title: "TrainerTop Trener — rasmiy trener", fill: "var(--lime, #B4FF00)", pill: "border-lime/30 bg-lime/[0.08] text-lime" },
  athlete: { name: "TrainerTop Athlete", title: "TrainerTop Athlete — mashhur atlet", fill: "#38BDF8", pill: "border-sky-400/30 bg-sky-400/[0.08] text-sky-400" },
} as const;

/**
 * Rasmiy nishon: muhr + galochka. Ikki xil:
 *  • trener  → "TrainerTop Trener" (yashil; dark rejimda #B4FF00, light rejimda #6BA300)
 *  • atlet   → "TrainerTop Athlete" (ko'k)
 * Galochka har doim qora. Gradient/id ishlatilmaydi, shuning uchun bir sahifada ko'p nusxa bo'lsa ham to'qnashuv yo'q.
 */
export function AthleteBadge({ size = 18, label = false, kind = "trainer", className }: AthleteBadgeProps) {
  const k = KINDS[kind] || KINDS.trainer;
  const icon = (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={k.name} className="shrink-0">
      <path d={SEAL_PATH} style={{ fill: k.fill }} />
      <path d="M7.2 12.5 10.6 15.9 16.8 8.4" fill="none" stroke="#0A0A0A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (!label) return <span className={cn("inline-flex items-center", className)} title={k.title}>{icon}</span>;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border pl-1.5 pr-2.5 py-1 text-[11px] font-semibold", k.pill, className)} title={k.title}>
      {icon}
      {k.name}
    </span>
  );
}
