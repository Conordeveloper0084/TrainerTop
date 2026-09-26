"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Star, Eye, EyeOff, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { StarRating } from "@/components/ui/StarRating";

const FILTERS = [["all", "Hammasi"], ["with_comment", "Izohli"], ["featured", "Bosh sahifada"], ["hidden", "Yashirilgan"]] as const;
const ACTION_TEXT: Record<string, string> = { feature: "Bosh sahifada ko'rsatildi", unfeature: "Bosh sahifadan olindi", hide: "Yashirildi", unhide: "Yashirin ochildi" };

// Admin › Baholar: TrainerTop ga berilgan baholar. Izohli bahoni bosh sahifada ko'rsatish (tanlash) yoki spamni yashirish.
export default function AdminReviewsPage() {
  const [filter, setFilter] = useState<string>("all");
  const [rows, setRows] = useState<any[]>([]); const [total, setTotal] = useState(0); const [stats, setStats] = useState<any>(null); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/platform-reviews?filter=${filter}`); const d = await res.json().catch(() => ({}));
      if (res.ok) { setRows(d.rows || []); setTotal(d.total || 0); setStats(d.stats); } else toast.error(d.message || "Yuklab bo'lmadi");
    } catch { toast.error("Yuklab bo'lmadi"); } finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  const act = async (r: any, action: string) => {
    const res = await fetch(`/api/admin/platform-reviews/${r.user_id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.message || "Xatolik"); return; }
    toast.success(ACTION_TEXT[action]); void load();
  };

  return (
    <div>
      <h1 className="text-lg font-bold mb-4 flex items-center gap-2"><Star className="h-5 w-5 text-lime" />Baholar</h1>
      {stats && stats.count > 0 && (
        <div className="card p-4 mb-4 flex flex-wrap items-center gap-6" data-testid="review-stats">
          <div><p className="text-3xl font-bold text-lime">{Number(stats.average).toFixed(1)}</p><StarRating value={Number(stats.average)} size={14} /><p className="text-[10px] text-white/30 mt-1">{stats.count} ta baho (yashirinlarsiz)</p></div>
          <div className="flex-1 min-w-[160px] space-y-1">{[5, 4, 3, 2, 1].map((n) => <div key={n} className="flex items-center gap-2 text-[10px] text-white/40"><span className="w-2">{n}</span><div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-lime/70" style={{ width: `${(Number(stats.distribution?.[String(n)]) || 0) / Math.max(1, stats.count) * 100}%` }} /></div><span className="w-6 text-right">{stats.distribution?.[String(n)] || 0}</span></div>)}</div>
        </div>
      )}
      <div className="flex gap-2 mb-3">{FILTERS.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={cn("px-3 py-1.5 rounded-lg text-xs border", filter === k ? "bg-lime-muted text-lime border-lime/30 font-semibold" : "border-white/[0.08] text-white/50")}>{l}</button>)}<span className="text-[11px] text-white/30 ml-auto self-center">Jami: {total}</span></div>
      {loading ? <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin text-lime mx-auto" /></div> : rows.length === 0 ? <p className="text-xs text-white/30 py-10 text-center">Baho yo'q</p> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.user_id} className={cn("card p-4", r.hidden && "opacity-60")} data-testid="review-row">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <StarRating value={r.rating} size={14} /><span className="text-sm font-medium">{r.full_name}</span><span className="text-[11px] text-white/30">{r.email}</span>
                {r.featured && <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime/15 text-lime flex items-center gap-1"><Sparkles className="h-2.5 w-2.5" />Bosh sahifada</span>}
                {r.hidden && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">Yashirilgan</span>}
                <span className="text-[10px] text-white/30 ml-auto">{new Date(r.updated_at).toLocaleDateString("uz-UZ")}</span>
              </div>
              {r.comment ? <p className="text-sm text-white/70 whitespace-pre-line break-words mb-2">{r.comment}</p> : <p className="text-xs text-white/25 italic mb-2">Izohsiz</p>}
              <div className="flex gap-2">
                {!r.hidden && r.comment && (r.featured ? <button onClick={() => act(r, "unfeature")} className="px-3 py-1.5 rounded-lg text-xs border border-white/[0.1] text-white/60">Bosh sahifadan olish</button> : <button onClick={() => act(r, "feature")} className="px-3 py-1.5 rounded-lg text-xs bg-lime/10 text-lime border border-lime/20">Bosh sahifada ko'rsatish</button>)}
                {r.hidden ? <button onClick={() => act(r, "unhide")} className="px-3 py-1.5 rounded-lg text-xs border border-white/[0.1] text-white/60 flex items-center gap-1"><Eye className="h-3 w-3" />Ochish</button> : <button onClick={() => act(r, "hide")} className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1"><EyeOff className="h-3 w-3" />Yashirish (spam)</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
