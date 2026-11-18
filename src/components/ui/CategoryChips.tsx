"use client";

import { cn } from "@/lib/utils";

export interface ChipOption { value: string; label: string }

// Yonga aylantiriladigan "chip" qatori (iOS/Android ilovalardagi kabi): Hammasi, Fitness, Bodybuilding, ...
// Ochiladigan ro'yxat (select) o'rniga — kam joy egallaydi va bitta bosish bilan tanlanadi.
// `value === ""` — "Hammasi" (filtr yo'q).
export function CategoryChips({ options, value, onChange, allLabel = "Hammasi", ariaLabel = "Kategoriya" }: {
  options: readonly ChipOption[]; value: string; onChange: (value: string) => void; allLabel?: string; ariaLabel?: string;
}) {
  const items: ChipOption[] = [{ value: "", label: allLabel }, ...options];
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
      {items.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value || "__all"} type="button" aria-pressed={active} onClick={() => onChange(o.value)}
            className={cn("shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm border transition-colors",
              active ? "bg-lime-muted text-lime border-lime/30" : "bg-white/[0.04] text-white/60 border-white/[0.06] hover:text-white")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
