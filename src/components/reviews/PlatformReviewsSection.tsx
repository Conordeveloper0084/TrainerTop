"use client";

import { useEffect, useState } from "react";
import { StarRating } from "@/components/ui/StarRating";
import { getInitials } from "@/lib/utils";
import type { PlatformReviewStats, FeaturedReview } from "@/lib/platform-reviews";

// Bosh sahifada: foydalanuvchilarning TrainerTop ga bergan bahosi (o'rtacha, soni, taqsimot) va admin tanlagan sharhlar.
// Baho yo'q bo'lsa hech narsa ko'rsatilmaydi (bo'sh "0 ta baho" bo'limi obro'ga zarar).
export function PlatformReviewsSection() {
  const [data, setData] = useState<(PlatformReviewStats & { featured: FeaturedReview[] }) | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => { try { const res = await fetch("/api/platform-reviews"); const d = res.ok ? await res.json() : null; if (alive && d) setData(d); } catch {} })();
    return () => { alive = false; };
  }, []);
  if (!data || !data.count || data.average == null) return null;
  const max = Math.max(1, ...Object.values(data.distribution || {}).map(Number));
  return (
    <section className="section border-t border-white/[0.06]" data-testid="reviews-section">
      <div className="container-main">
        <h2 className="text-2xl font-bold text-center mb-8">Foydalanuvchilar baholari</h2>
        <div className="grid md:grid-cols-[220px_1fr] gap-8 items-start">
          <div className="text-center">
            <p className="text-5xl font-bold text-lime" data-testid="avg">{data.average.toFixed(1)}</p>
            <StarRating value={data.average} size={20} className="my-2" />
            <p className="text-xs text-white/40">{data.count} ta baho</p>
            <div className="mt-4 space-y-1">
              {[5, 4, 3, 2, 1].map((n) => (
                <div key={n} className="flex items-center gap-2 text-[10px] text-white/40"><span className="w-2">{n}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-lime/70" style={{ width: `${(Number(data.distribution?.[String(n)]) || 0) / max * 100}%` }} /></div></div>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {data.featured.map((r, i) => (
              <div key={i} className="card p-4" data-testid="featured-review">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center overflow-hidden shrink-0">{r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-white/30">{getInitials(r.name)}</span>}</div>
                  <div><p className="text-sm font-medium">{r.name}</p><StarRating value={r.rating} size={12} /></div>
                </div>
                <p className="text-sm text-white/60 whitespace-pre-line break-words">{r.comment}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
