"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, BookOpen, Loader2, Pencil, Trash2, Eye, EyeOff, Play } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/utils";

export default function AdminLessonsPage() {
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/lessons");
      if (res.ok) setLessons(await res.json());
    } catch { toast.error("Yuklashda xatolik"); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" darsligini o'chirishni tasdiqlaysizmi? Bu amal qaytarib bo'lmaydi.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/lessons/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Darslik o'chirildi");
      setLessons((prev) => prev.filter((l) => l.id !== id));
    } catch { toast.error("O'chirishda xatolik"); } finally { setDeleting(null); }
  };

  return (
    <div>
      {/* Sarlavha + yaratish tugmasi */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-lime" />
            Platforma darsliklari
          </h1>
          <p className="text-xs text-white/40 mt-1">TrainerTop o'z premium darsliklari</p>
        </div>
        <Link href="/admin/lessons/create" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" />Yangi darslik
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>
      ) : lessons.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="h-12 w-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/40 text-sm">Hali platforma darsligi yo'q</p>
          <Link href="/admin/lessons/create" className="text-lime text-sm hover:underline mt-2 inline-block">Birinchi darslikni yarating</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => {
            const sectionCount = lesson.content?.sections?.length || 0;
            const videoCount = lesson.content?.sections?.reduce((acc: number, s: any) => acc + (s.videos?.length || 0), 0) || 0;
            return (
              <div key={lesson.id} className="bg-dark-surface border border-white/[0.06] rounded-xl p-4 flex items-center gap-4">
                {/* Muqova */}
                <div className="w-16 h-16 rounded-lg bg-white/[0.04] shrink-0 overflow-hidden flex items-center justify-center">
                  {lesson.cover_image_url ? (
                    <img src={lesson.cover_image_url} alt={lesson.title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="h-6 w-6 text-white/20" />
                  )}
                </div>

                {/* Ma'lumot */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm truncate">{lesson.title}</h3>
                    {lesson.status === "published" ? (
                      <span className="text-[9px] bg-lime/10 text-lime px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0"><Eye className="h-2.5 w-2.5" />E'lon</span>
                    ) : (
                      <span className="text-[9px] bg-white/[0.06] text-white/40 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0"><EyeOff className="h-2.5 w-2.5" />Qoralama</span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5 truncate">{lesson.description || "Tavsifsiz"}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/30">
                    <span>{sectionCount} bo'lim</span>
                    <span className="flex items-center gap-1"><Play className="h-2.5 w-2.5" />{videoCount} video</span>
                    <span className="text-lime font-medium">{formatPrice(lesson.price || lesson.price_lifetime || 0)}</span>
                  </div>
                </div>

                {/* Tugmalar */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/admin/lessons/create?edit=${lesson.id}`} className="p-2 text-white/40 hover:text-lime rounded-lg hover:bg-lime/10 transition-colors" title="Tahrirlash">
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button onClick={() => handleDelete(lesson.id, lesson.title)} disabled={deleting === lesson.id}
                    className="p-2 text-white/40 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors" title="O'chirish">
                    {deleting === lesson.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
