"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Star, BookOpen, Play, ChevronRight, Plus, Edit, Trash2, Eye, Folder, Loader2, DollarSign, Users, Dumbbell } from "lucide-react";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { cn, formatPrice, getSpecializationLabel, getCategoryColor, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "sonner";

type ViewMode = "catalog" | "my" | "purchased";

export default function LessonsPage() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [myLessons, setMyLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("catalog");
  const user = useAuthStore((s) => s.user);
  const isTrainer = user?.role === "trainer";

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const res = await fetch("/api/lessons");
      const data = await res.json();
      setCatalog(Array.isArray(data) ? data : []);
      if (isTrainer && user) {
        const res2 = await fetch(`/api/lessons?trainer_id=${user.id}`);
        const data2 = await res2.json();
        setMyLessons(Array.isArray(data2) ? data2 : []);
      }
    } catch (e) {} finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("O'chirishni xohlaysizmi?")) return;
    const res = await fetch(`/api/lessons/${id}`, { method: "DELETE" });
    if (res.ok) { setMyLessons((p) => p.filter((l) => l.id !== id)); setCatalog((p) => p.filter((l) => l.id !== id)); toast.success("O'chirildi"); }
  };

  const handleToggle = async (id: string, status: string) => {
    const ns = status === "published" ? "draft" : "published";
    const res = await fetch(`/api/lessons/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: ns }) });
    if (res.ok) { setMyLessons((p) => p.map((l) => l.id === id ? { ...l, status: ns } : l)); toast.success(ns === "published" ? "E'lon qilindi" : "Yashirildi"); }
  };

  const filtered = catalog.filter((l) => {
    if (search && !l.title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (category && l.category !== category) return false;
    if (difficulty && l.difficulty !== difficulty) return false;
    return true;
  });

  if (loading) return <div className="container-main py-8"><SkeletonGrid count={6} type="lesson" /></div>;

  return (
    <div className="container-main py-8">
      <div className="mb-8"><h1 className="text-h1 mb-2">Darsliklar</h1><p className="text-white/40 text-sm">Professional darsliklarni sotib oling yoki yarating</p></div>
      {user && (
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <TBtn active={viewMode === "catalog"} onClick={() => setViewMode("catalog")} icon={BookOpen} label="Katalog" />
          {isTrainer && <TBtn active={viewMode === "my"} onClick={() => setViewMode("my")} icon={Folder} label="Mening darsliklarim" />}
          <TBtn active={viewMode === "purchased"} onClick={() => setViewMode("purchased")} icon={Play} label="Video darsliklar" />
        </div>
      )}

      {/* KATALOG */}
      {viewMode === "catalog" && (<>
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidirish..." className="input-field !pl-11" /></div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field sm:w-44"><option value="">Kategoriya</option><option value="fitness">Fitness</option><option value="bodybuilding">Bodybuilding</option><option value="yoga">Yoga</option><option value="diet">Dieta</option></select>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="input-field sm:w-44"><option value="">Daraja</option><option value="beginner">Boshlang'ich</option><option value="intermediate">O'rta</option><option value="advanced">Professional</option></select>
        </div>
        {filtered.length === 0 ? <div className="card p-12 text-center"><BookOpen className="h-10 w-10 text-white/10 mx-auto mb-4" /><p className="text-sm text-white/40">Darsliklar yo'q</p></div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filtered.map((l) => <LessonCard key={l.id} lesson={l} />)}</div>
        )}
      </>)}

      {/* MENING DARSLIKLARIM */}
      {viewMode === "my" && isTrainer && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs text-white/30">{myLessons.length} ta darslik · {myLessons.filter((l) => l.status === "published").length} ta e'lon qilingan</p>
            </div>
            <Link href="/lessons/create" className="btn-lime !py-2.5 !px-5 text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Darslik yaratish</Link>
          </div>

          {myLessons.length === 0 ? (
            <div className="card p-12 text-center">
              <BookOpen className="h-10 w-10 text-white/10 mx-auto mb-4" />
              <p className="text-sm text-white/40 mb-2">Hali darslik yo'q</p>
              <p className="text-xs text-white/20 mb-4">Birinchi darsligingizni yarating va sotishni boshlang</p>
              <Link href="/lessons/create" className="btn-lime !py-2.5 text-sm inline-flex items-center gap-2"><Plus className="h-4 w-4" />Darslik yaratish</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myLessons.map((l) => (
                <div key={l.id} className="card group overflow-hidden">
                  {/* Rasm */}
                  <div className="relative w-full aspect-video bg-dark-card flex items-center justify-center">
                    {l.cover_url || l.cover_image_url ? (
                      <img src={l.cover_url || l.cover_image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-lime/[0.04] to-dark-card flex items-center justify-center">
                        <Dumbbell className="h-8 w-8 text-lime/15" />
                      </div>
                    )}
                    {/* Status badge */}
                    <div className="absolute top-2 right-2">
                      <span className={cn("text-[10px] px-2.5 py-1 rounded-full font-medium backdrop-blur-sm",
                        l.status === "published" ? "bg-lime/20 text-lime" : "bg-dark/70 text-white/50")}>
                        {l.status === "published" ? "E'lon" : "Qoralama"}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {l.category && <span className={cn("badge text-[10px] px-2 py-0.5", getCategoryColor(l.category))}>{getSpecializationLabel(l.category)}</span>}
                      {l.difficulty && <span className="badge-neutral text-[10px] px-2 py-0.5">{l.difficulty === "beginner" ? "Boshlang'ich" : l.difficulty === "intermediate" ? "O'rta" : "Pro"}</span>}
                    </div>
                    <h3 className="font-semibold text-sm mb-2">{l.title}</h3>
                    {l.description && <p className="text-xs text-white/40 mb-3 line-clamp-2">{l.description}</p>}
                    <p className="text-lime font-bold text-sm mb-3">{formatPrice(l.price)}</p>

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-xs text-white/30 mb-3 pt-3 border-t border-white/[0.04]">
                      {l.total_sales > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{l.total_sales} sotildi</span>}
                      {l.rating > 0 && <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-lime fill-lime" />{l.rating}</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggle(l.id, l.status)} title={l.status === "published" ? "Yashirish" : "E'lon qilish"}
                        className={cn("flex-1 py-2 rounded-lg text-xs text-center transition-colors",
                          l.status === "published" ? "bg-lime-subtle text-lime hover:bg-lime/10" : "bg-white/[0.04] text-white/40 hover:text-lime")}>
                        <Eye className="h-3.5 w-3.5 inline mr-1" />{l.status === "published" ? "Yashirish" : "E'lon qilish"}
                      </button>
                      <Link href={`/lessons/create?edit=${l.id}`} className="py-2 px-3 rounded-lg bg-white/[0.04] text-white/40 hover:text-white text-xs" title="Tahrirlash">
                        <Edit className="h-3.5 w-3.5" />
                      </Link>
                      <button onClick={() => handleDelete(l.id)} className="py-2 px-3 rounded-lg bg-white/[0.04] text-red-400/40 hover:text-red-400 text-xs" title="O'chirish">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === "purchased" && <div className="card p-12 text-center"><Play className="h-10 w-10 text-white/10 mx-auto mb-4" /><p className="text-sm text-white/40">Hali video darslik yo'q</p><p className="text-xs text-white/20 mt-1">Darslik sotib olganingizda bu yerda ko'rinadi</p></div>}
    </div>
  );
}

// Katalog uchun lesson card
function LessonCard({ lesson: l }: { lesson: any }) {
  return (
    <Link href={`/lessons/${l.id}`} className="card-hover group overflow-hidden">
      <div className="w-full aspect-video bg-dark-card flex items-center justify-center overflow-hidden">
        {l.cover_url || l.cover_image_url ? <img src={l.cover_url || l.cover_image_url} alt="" className="w-full h-full object-cover" /> : (
          <div className="w-full h-full bg-gradient-to-br from-lime/[0.04] to-dark-card flex items-center justify-center">
            <Dumbbell className="h-8 w-8 text-lime/15" />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex gap-2 mb-2">
          {l.category && <span className={cn("badge text-[10px]", getCategoryColor(l.category))}>{getSpecializationLabel(l.category)}</span>}
          {l.difficulty && <span className="badge-neutral text-[10px] px-2 py-0.5">{l.difficulty === "beginner" ? "Boshlang'ich" : l.difficulty === "intermediate" ? "O'rta" : "Pro"}</span>}
        </div>
        <h3 className="font-semibold text-sm mb-2 group-hover:text-lime transition-colors">{l.title}</h3>
        {l.description && <p className="text-xs text-white/40 mb-3 line-clamp-2">{l.description}</p>}
        {l.profiles && <div className="flex items-center gap-2 mb-3"><div className="w-5 h-5 rounded-full bg-dark-elevated flex items-center justify-center"><span className="text-[8px] font-bold text-white/20">{getInitials(l.profiles.full_name)}</span></div><span className="text-[11px] text-white/40">{l.profiles.full_name}</span></div>}
        <div className="flex justify-between items-center">
          <span className="text-lime font-bold text-sm">{formatPrice(l.price)}</span>
          {l.rating > 0 && <div className="flex items-center gap-0.5"><Star className="h-3 w-3 text-lime fill-lime" /><span className="text-xs text-white/50">{l.rating}</span></div>}
        </div>
      </div>
    </Link>
  );
}

function TBtn({ active, onClick, icon: I, label }: any) {
  return <button onClick={onClick} className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm whitespace-nowrap", active ? "bg-lime-muted text-lime" : "text-white/40 hover:text-white")}><I className="h-4 w-4" />{label}</button>;
}
