"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// 5 yulduzli baho: onChange berilsa — tanlash mumkin (klaviatura bilan ham), aks holda faqat ko'rsatish
export function StarRating({ value, onChange, size = 20, className }: { value: number; onChange?: (v: number) => void; size?: number; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)} role={onChange ? "radiogroup" : "img"} aria-label={onChange ? "Baho" : `${value} yulduz`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= Math.round(value);
        const star = <Star width={size} height={size} className={cn(on ? "fill-lime text-lime" : "text-white/20")} />;
        return onChange
          ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} yulduz`} onClick={() => onChange(n)} className="p-0.5 hover:scale-110 transition-transform">{star}</button>
          : <span key={n}>{star}</span>;
      })}
    </div>
  );
}
