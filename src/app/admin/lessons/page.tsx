"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, BookOpen, Loader2, Pencil, Trash2, Eye, EyeOff, Play, Dumbbell, Search, Undo2, ShoppingBag, Rocket } from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice, formatLessonPrice, getInitials, getSpecializationLabel, getCategoryColor } from "@/lib/utils";
import { RemoveLessonModal } from "@/components/admin/RemoveLessonModal";
import { BoostLessonModal } from "@/components/admin/BoostLessonModal";

type Scope = "all" | "platform" | "trainers" | "removed";
const TABS: { key: Scope; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "platform", label: "Platforma" },
  { key: "trainers", label: "Trenerlar" },
  { key: "removed", label: "O'chirilganlar" },
];

export default function AdminLessonsPage() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<any | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [boosting, setBoosting] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/admin/lessons?${params}`);
      if (res.ok) setLessons(await res.json());
      else toast.error("Yuklashda xatolik");
    } catch { toast.error("Yuklashda xatolik"); } finally { setLoading(false); }
  }, [scope, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const restore = async (l: any) => {
    setRestoring(l.id);
    try {
      const res = await fetch(`/api/admin/lessons/${l.id}/restore`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Xatolik");
      toast.success("Darslik tiklandi");
      load();
    } catch (e: any) { toast.error(e.message || "Xatolik"); } finally { setRestoring(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><BookOpen className="h-5 w-5 text-lime" />Darsliklar</h1>
          <p className="text-xs text-white/40 mt-1">Barcha darsliklarni ko'rish. Trenerlar darsligini tahrirlab bo'lmaydi — faqat ko'rish va olib tashlash</p>
        </div>
        <Link href="/admin/lessons/create" className="btn-primary flex items-center gap-2 text-sm shrink-0">
          <Plus className="h-4 w-4" /><span className="hidden sm:inline">Platforma darsligi</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setScope(t.key)} className={cn("px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors", scope === t.key ? "bg-lime text-black" : "bg-dark-surface border border-white/[0.08] text-white/60 hover:bg-white/5")}>{t.label}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Darslik nomi bo'yicha..." className="input-field pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>
      ) : lessons.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="h-12 w-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-sm">{scope === "removed" ? "O'chirilgan darslik yo'q" : "Darslik topilmadi"}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {lessons.map((l) => {
            const price = formatLessonPrice(l);
            const isRemoved = l.status === "removed";
            return (
              <div key={l.id} className={cn("card overflow-hidden flex flex-col", isRemoved && "opacity-80 border-red-500/20")}>
                <Link href={`/admin/lessons/${l.id}`} className="block group">
                  <div className="w-full aspect-video bg-dark-card flex items-center justify-center overflow-hidden relative">
                    {l.cover_image_url ? (
                      <img src={l.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-lime/[0.04] to-dark-card flex items-center justify-center"><Dumbbell className="h-8 w-8 text-lime/15" /></div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1.5">
                      {l.is_platform && <span className="text-[9px] bg-lime text-black font-bold px-1.5 py-0.5 rounded-full">PLATFORMA</span>}
                      {isRemoved ? (
                        <span className="text-[9px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">O'CHIRILGAN</span>
                      ) : l.status === "published" ? (
                        <span className="text-[9px] bg-black/60 text-lime px-1.5 py-0.5 rounded-full flex items-center gap-1"><Eye className="h-2.5 w-2.5" />E'lon</span>
                      ) : (
                        <span className="text-[9px] bg-black/60 text-white/60 px-1.5 py-0.5 rounded-full flex items-center gap-1"><EyeOff className="h-2.5 w-2.5" />Qoralama</span>
                      )}
                    </div>
                  </div>
                  <div className="p-4 pb-2">
                    <div className="flex gap-2 mb-2">
                      {l.category && <span className={cn("badge text-[10px]", getCategoryColor(l.category))}>{getSpecializationLabel(l.category)}</span>}
                    </div>
                    <h3 className="font-semibold text-sm mb-1.5 group-hover:text-lime transition-colors line-clamp-2">{l.title}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-dark-elevated flex items-center justify-center overflow-hidden shrink-0">
                        {l.profiles?.avatar_url ? <img src={l.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] font-bold text-white/20">{getInitials(l.profiles?.full_name || "")}</span>}
                      </div>
                      <span className="text-[11px] text-white/40 truncate">{l.is_platform ? "TrainerTop" : l.profiles?.full_name || "Trener"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-white/30">
                      <span>{l.sections_count} bo'lim</span>
                      <span className="flex items-center gap-1"><Play className="h-2.5 w-2.5" />{l.videos_count} video</span>
                      <span className="flex items-center gap-1"><ShoppingBag className="h-2.5 w-2.5" />{l.total_sales || 0} sotuv</span>
                    </div>
                  </div>
                </Link>

                {isRemoved && l.removed_reason && (
                  <div className="mx-4 mb-2 bg-red-500/[0.05] border border-red-500/20 rounded-lg p-2.5">
                    <p className="text-[9px] text-red-400/80 uppercase tracking-wider mb-0.5">Olib tashlash sababi</p>
                    <p className="text-[11px] text-white/70">{l.removed_reason}</p>
                  </div>
                )}

                <div className="mt-auto p-4 pt-2 flex items-center justify-between gap-2">
                  <span className="text-lime font-bold text-sm">{price.display}{price.sub ? <span className="text-[10px] text-white/40 font-normal ml-1">{price.sub}</span> : null}</span>
                  <div className="flex items-center gap-1.5">
                    {isRemoved ? (
                      <button onClick={() => restore(l)} disabled={restoring === l.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-lime/10 text-lime border border-lime/20 hover:bg-lime/20 disabled:opacity-40">
                        {restoring === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}Tiklash
                      </button>
                    ) : (
                      <>
                        {l.status === "published" && (
                          <button onClick={() => setBoosting(l)} className="p-2 text-white/40 hover:text-lime rounded-lg hover:bg-lime/10 transition-colors" title="Boost qilish (rasmiy kanalda hammaga)" aria-label={`«${l.title}» ni boost qilish`}><Rocket className="h-4 w-4" /></button>
                        )}
                        <Link href={`/admin/lessons/${l.id}`} className="p-2 text-white/40 hover:text-lime rounded-lg hover:bg-lime/10 transition-colors" title="Ko'rish"><Eye className="h-4 w-4" /></Link>
                        {l.is_platform && (
                          <Link href={`/admin/lessons/create?edit=${l.id}`} className="p-2 text-white/40 hover:text-lime rounded-lg hover:bg-lime/10 transition-colors" title="Tahrirlash"><Pencil className="h-4 w-4" /></Link>
                        )}
                        <button onClick={() => setRemoving(l)} className="p-2 text-white/40 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors" title="Olib tashlash"><Trash2 className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {boosting && (
        <BoostLessonModal lesson={boosting} onClose={() => setBoosting(null)} onDone={() => setBoosting(null)} />
      )}

      {removing && (
        <RemoveLessonModal lesson={removing} onClose={() => setRemoving(null)} onDone={() => { setRemoving(null); load(); }} />
      )}
    </div>
  );
}
