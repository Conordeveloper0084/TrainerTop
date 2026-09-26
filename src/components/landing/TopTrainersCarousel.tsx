"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { AthleteBadge } from "@/components/ui/AthleteBadge";
import { getInitials, getSpecializationLabel } from "@/lib/utils";

export interface CarouselTrainer {
  id: string; name: string; avatar_url: string | null; specialization: string | null;
  rating?: number | null; blurb?: string | null; href: string | null; verified?: boolean;
}

const SWIPE_THRESHOLD = 40;

// Cheksiz aylanadigan karusel: bitta chetdagi nusxa (yuqoriga/pastga sakramasdan davom etadi),
// chapga/o'ngga tugmalar va barmoq bilan surish (touch) — o'ngdan chapga ham, teskarisiga ham.
export function TopTrainersCarousel({ items }: { items: CarouselTrainer[] }) {
  const n = items.length;
  const display = n > 1 ? [items[n - 1], ...items, items[0]] : items;
  const [index, setIndex] = useState(n > 1 ? 1 : 0);
  const [animate, setAnimate] = useState(true);
  const touchStart = useRef<number | null>(null);

  const go = (dir: 1 | -1) => { if (n <= 1) return; setAnimate(true); setIndex((i) => i + dir); };

  // Klonga yetganda animatsiyasiz asl joyga qaytaradi — cheksiz aylanish effekti
  useEffect(() => {
    if (n <= 1) return;
    if (index === display.length - 1) { const t = setTimeout(() => { setAnimate(false); setIndex(1); }, 350); return () => clearTimeout(t); }
    if (index === 0) { const t = setTimeout(() => { setAnimate(false); setIndex(n); }, 350); return () => clearTimeout(t); }
  }, [index, n, display.length]);

  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStart.current; touchStart.current = null;
    if (dx > SWIPE_THRESHOLD) go(-1); else if (dx < -SWIPE_THRESHOLD) go(1);
  };

  const realIndex = ((index - 1) % n + n) % n;

  return (
    <div data-testid="top-trainers-carousel">
      <div className="relative overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          data-testid="carousel-track"
          className={cnTransition(animate)}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {display.map((t, i) => (
            <div key={`${t.id}-${i}`} className="w-full shrink-0 px-1 sm:w-1/2 lg:w-1/4">
              <TrainerCard t={t} />
            </div>
          ))}
        </div>
        {n > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="Oldingi" className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 rounded-full bg-dark-card border border-white/10 items-center justify-center hover:border-lime/40 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => go(1)} aria-label="Keyingi" className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 rounded-full bg-dark-card border border-white/10 items-center justify-center hover:border-lime/40 transition-colors"><ChevronRight className="h-4 w-4" /></button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-5">
          {items.map((_, i) => (
            <span key={i} data-testid="carousel-dot" data-active={i === realIndex} className={`h-1.5 rounded-full transition-all ${i === realIndex ? "w-5 bg-lime" : "w-1.5 bg-white/15"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function cnTransition(animate: boolean) {
  return `flex${animate ? " transition-transform duration-350 ease-out" : ""}`;
}

function TrainerCard({ t }: { t: CarouselTrainer }) {
  const body = (
    <div className="card-hover p-4 h-full">
      <div className="aspect-square rounded-xl overflow-hidden bg-lime/[0.06] mb-3 flex items-center justify-center">
        {t.avatar_url ? <img src={t.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-4xl font-bold text-lime/30">{getInitials(t.name)}</span>}
      </div>
      <h3 className="font-semibold text-sm flex items-center gap-1 min-w-0"><span className="truncate">{t.name}</span>{t.verified && <AthleteBadge size={14} />}</h3>
      <div className="flex items-center gap-1 mt-1 min-w-0">
        {!!t.rating && (<><Star className="h-3 w-3 text-lime fill-lime shrink-0" /><span className="text-xs text-white/50">{t.rating.toFixed(1)}</span></>)}
        <span className="text-xs text-white/30 truncate ml-1">{t.blurb || (t.specialization ? getSpecializationLabel(t.specialization) : "")}</span>
      </div>
    </div>
  );
  return t.href ? <Link href={t.href}>{body}</Link> : <div>{body}</div>;
}
