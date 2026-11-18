"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// "Topish" bo'limi (mobil): Trenerlar | Darsliklar — pastki menyuda bitta tugma, sahifa tepasida ikki tab.
// Faqat ro'yxat sahifalarida ko'rinadi (trener/darslik ichida emas). Kompyuterda yuqori menyuda ikkalasi alohida bor.
const TABS = [{ href: "/trainers", label: "Trenerlar" }, { href: "/lessons", label: "Darsliklar" }];

export default function DiscoverTabs() {
  const pathname = usePathname();
  if (!TABS.some((t) => t.href === pathname)) return null;
  return (
    <div className="md:hidden container-main pt-4" data-testid="discover-tabs">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-dark-surface border border-white/[0.06]">
        {TABS.map((t) => {
          const on = pathname === t.href;
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
              className={cn("text-center py-2 rounded-lg text-sm transition-colors", on ? "bg-lime text-black font-semibold" : "text-white/60")}>
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
