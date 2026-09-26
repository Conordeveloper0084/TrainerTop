"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2, Pencil, Play, Undo2, ShoppingBag, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { cn, formatLessonPrice, getInitials } from "@/lib/utils";
import { RemoveLessonModal } from "@/components/admin/RemoveLessonModal";
import SecureVideoPlayer from "@/components/video/SecureVideoPlayer";

// Admin uchun darslikni TO'LIQ ko'rish (faqat o'qish). Tahrirlash faqat platforma darsliklari uchun.
export default function AdminLessonViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [groupBusy, setGroupBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/admin/lessons/${params.id}`);
      if (res.status === 404) { setMissing(true); return; }
      if (res.ok) setLesson(await res.json());
      else toast.error("Yuklashda xatolik");
    } catch { toast.error("Yuklashda xatolik"); } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.id]);

  const restore = async () => {
    setRestoring(true);
    try {
      const res = await fetch(`/api/admin/lessons/${params.id}/restore`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Xatolik");
      toast.success("Darslik tiklandi");
      load();
    } catch (e: any) { toast.error(e.message || "Xatolik"); } finally { setRestoring(false); }
  };

  const toggleGroup = async (archived: boolean) => {
    if (!lesson?.chat_group) return;
    if (archived && !confirm("Guruh yopiladi: hech kim (trener ham) kira olmaydi. Xabarlar saqlanadi, keyin qayta ochish mumkin. Davom etasizmi?")) return;
    setGroupBusy(true);
    try {
      const res = await fetch(`/api/admin/groups/${lesson.chat_group.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Xatolik");
      toast.success(archived ? "Guruh yopildi" : "Guruh qayta ochildi");
      load();
    } catch (e: any) { toast.error(e.message || "Xatolik"); } finally { setGroupBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;
  if (missing || !lesson) return <div className="card p-10 text-center"><p className="text-white/40 text-sm">Darslik topilmadi</p><Link href="/admin/lessons" className="text-lime text-sm hover:underline mt-2 inline-block">Ro'yxatga qaytish</Link></div>;

  const raw = lesson.content;
  const sections: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.sections) ? raw.sections : [];
  const price = formatLessonPrice(lesson);
  const isRemoved = lesson.status === "removed";

  return (
    <div className="max-w-3xl">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white mb-5"><ArrowLeft className="h-4 w-4" />Orqaga</button>

      {isRemoved && (
        <div className="card p-4 mb-4 border-red-500/30 bg-red-500/[0.04]">
          <p className="text-sm font-semibold text-red-400 mb-1">Bu darslik olib tashlangan</p>
          <p className="text-xs text-white/60">Sabab: {lesson.removed_reason || "—"}</p>
          <button onClick={restore} disabled={restoring} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-lime/10 text-lime border border-lime/20 hover:bg-lime/20 disabled:opacity-40">
            {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}Tiklash
          </button>
        </div>
      )}

      <div className="card overflow-hidden mb-4">
        {lesson.cover_image_url && <img src={lesson.cover_image_url} alt="" className="w-full aspect-video object-cover" />}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-xl font-bold">{lesson.title}</h1>
            <span className={cn("text-[10px] px-2 py-1 rounded-full font-semibold shrink-0", isRemoved ? "bg-red-500/10 text-red-400" : lesson.status === "published" ? "bg-lime-muted text-lime" : "bg-white/[0.06] text-white/50")}>
              {isRemoved ? "O'chirilgan" : lesson.status === "published" ? "E'lon qilingan" : "Qoralama"}
            </span>
          </div>
          {lesson.description && <p className="text-sm text-white/60 mb-4 whitespace-pre-line">{lesson.description}</p>}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/40">
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-dark-elevated flex items-center justify-center overflow-hidden shrink-0">
                {lesson.profiles?.avatar_url ? <img src={lesson.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] font-bold text-white/20">{getInitials(lesson.profiles?.full_name || "")}</span>}
              </span>
              {lesson.is_platform ? "TrainerTop (platforma)" : `${lesson.profiles?.full_name || "Trener"}${lesson.profiles?.email ? ` · ${lesson.profiles.email}` : ""}`}
            </span>
            <span className="text-lime font-semibold">{price.display}{price.sub ? ` ${price.sub}` : ""}</span>
            <span className="flex items-center gap-1"><ShoppingBag className="h-3 w-3" />{lesson.total_sales || 0} sotuv</span>
            {lesson.rating > 0 && <span className="flex items-center gap-1"><Star className="h-3 w-3 text-lime fill-lime" />{Number(lesson.rating).toFixed(1)} ({lesson.total_reviews})</span>}
          </div>

          {!isRemoved && (
            <div className="flex gap-2 mt-5 pt-4 border-t border-white/[0.04]">
              {lesson.is_platform && <Link href={`/admin/lessons/create?edit=${lesson.id}`} className="btn-outline !py-2 !px-4 text-xs flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" />Tahrirlash</Link>}
              <button onClick={() => setRemoving(true)} className="px-4 py-2 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" />Olib tashlash</button>
            </div>
          )}
        </div>
      </div>

      {lesson.chat_group && (
        <div className="card p-4 mb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-dark-card flex items-center justify-center shrink-0"><Users className="h-4 w-4 text-white/40" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Chat guruhi: {lesson.chat_group.name}</p>
            <p className="text-[11px] text-white/40">{lesson.chat_group.members} ta a'zo · {lesson.chat_group.is_archived ? "yopilgan" : "ochiq"}</p>
          </div>
          <button onClick={() => toggleGroup(!lesson.chat_group.is_archived)} disabled={groupBusy}
            className={lesson.chat_group.is_archived ? "px-3 py-1.5 rounded-lg text-xs bg-lime/10 text-lime border border-lime/20 disabled:opacity-40" : "px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 disabled:opacity-40"}>
            {lesson.chat_group.is_archived ? "Qayta ochish" : "Guruhni yopish"}
          </button>
        </div>
      )}

      <h2 className="text-sm font-semibold text-white/60 mb-3">Kontent ({sections.length} bo'lim)</h2>
      {sections.length === 0 ? (
        <div className="card p-8 text-center"><p className="text-xs text-white/30">Kontent yo'q</p></div>
      ) : (
        <div className="space-y-3">
          {sections.map((s, i) => (
            <div key={i} className="card p-5">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{i + 1}-bo'lim</p>
              <h3 className="font-semibold text-sm mb-2">{s.title || "Nomsiz bo'lim"}</h3>
              {(s.content || s.body) && <p className="text-sm text-white/60 whitespace-pre-line mb-3">{s.content || s.body}</p>}
              {s.image_url && <img src={s.image_url} alt="" className="rounded-lg max-h-72 mb-3" />}
              {Array.isArray(s.videos) && s.videos.length > 0 && (
                <div className="space-y-4">
                  {s.videos.map((v: any, j: number) => (
                    <div key={j}>
                      <p className="text-xs text-white/70 mb-2 flex items-center gap-1.5"><Play className="h-3 w-3 text-lime" />{v.title || `Video ${j + 1}`}</p>
                      {v.url ? <SecureVideoPlayer videoUrl={v.url} title={v.title} /> : <p className="text-[11px] text-white/30">Video havolasi yo'q</p>}
                      {v.description && <p className="text-[11px] text-white/40 mt-1.5">{v.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {removing && <RemoveLessonModal lesson={lesson} onClose={() => setRemoving(false)} onDone={() => { setRemoving(false); router.push("/admin/lessons"); }} />}
    </div>
  );
}
