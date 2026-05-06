"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, MapPin, CheckCircle, Clock, Users, BookOpen, MessageCircle, ChevronLeft, Share2, Dumbbell, UserPlus, UserCheck, Play, Heart, Loader2, Settings, Edit } from "lucide-react";
import { toast } from "sonner";
import { getInitials, getSpecializationLabel, getCategoryColor, getWorkTypeLabel, formatRating, formatPrice, cn, timeAgo } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { useParams } from "next/navigation";

export default function TrainerProfilePage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"about" | "lessons" | "posts" | "reviews">("about");
  const [following, setFollowing] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isOwnProfile = user?.id === params.id;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/trainers/${params.id}`);
        const d = await res.json();
        setData(d);
        setFollowing(d.isFollowing || false);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [params.id]);

  const handleFollow = async () => {
    if (!user) { window.location.href = "/login"; return; }
    setFollowing(!following);
    await fetch("/api/follows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainer_id: params.id }) });
    toast.success(following ? "Bekor qilindi" : "Obuna bo'ldingiz!");
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/trainers/${params.id}`;
    if (navigator.share) { try { await navigator.share({ title: data?.profiles?.full_name, url }); } catch {} }
    else { await navigator.clipboard.writeText(url); toast.success("Havola nusxalandi!"); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;
  if (!data) return <div className="container-main py-8"><p className="text-white/40">Trener topilmadi</p></div>;

  const tp = data;
  const name = tp.profiles?.full_name || "";
  const tabs = [{ key: "about", label: "Haqida" }, { key: "lessons", label: "Darsliklar", count: tp.lessons?.length }, { key: "posts", label: "Postlar", count: tp.posts?.length }, { key: "reviews", label: "Sharhlar", count: tp.total_reviews }];

  return (
    <div className="container-main py-6">
      <Link href="/trainers" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white mb-6"><ChevronLeft className="h-4 w-4" />Trenerlar</Link>

      {/* Header */}
      <div className="card p-6 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-dark-card flex items-center justify-center overflow-hidden shrink-0">
            {tp.profiles?.avatar_url ? <img src={tp.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-4xl font-bold text-white/[0.08]">{getInitials(name)}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-bold">{name}</h1>
                  {isOwnProfile && <span className="text-[10px] bg-lime-muted text-lime px-2 py-0.5 rounded-full">Siz</span>}
                </div>
                <div className="flex items-center gap-3 text-sm text-white/40 mb-3">
                  {tp.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{tp.city}</span>}
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{tp.experience_years} yil</span>
                </div>
              </div>
              <button onClick={handleShare} className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-lime shrink-0"><Share2 className="h-4 w-4" /></button>
            </div>

            <div className="flex items-center gap-5 mb-4">
              {tp.rating > 0 && <div className="flex items-center gap-1.5"><Star className="h-4 w-4 text-lime fill-lime" /><span className="font-semibold text-sm">{formatRating(tp.rating)}</span><span className="text-xs text-white/30">({tp.total_reviews})</span></div>}
              <div className="flex items-center gap-1.5 text-white/50"><Users className="h-4 w-4" /><span className="text-sm">{tp.total_students} shogird</span></div>
              <div className="flex items-center gap-1.5 text-white/50"><UserPlus className="h-4 w-4" /><span className="text-sm">{tp.followers_count || 0} obunachilar</span></div>
            </div>

            {tp.monthly_price && (
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-lime-subtle border border-lime/10 rounded-lg px-3 py-1.5"><p className="text-[10px] text-white/40">Oylik mashq</p><p className="text-sm font-bold text-lime">{formatPrice(tp.monthly_price)}</p></div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-5">{(tp.specializations || []).map((s: string) => <span key={s} className={cn("badge text-xs", getCategoryColor(s))}>{getSpecializationLabel(s)}</span>)}<span className="badge-lime text-xs">{getWorkTypeLabel(tp.work_type)}</span></div>

            {/* O'z profilimi yoki boshqaning */}
            {isOwnProfile ? (
              <div className="flex gap-3">
                <Link href="/profile" className="btn-lime flex items-center gap-2 !py-2.5 text-sm"><Settings className="h-4 w-4" />Profilni sozlash</Link>
                <Link href="/lessons/create" className="flex items-center gap-2 !py-2.5 text-sm rounded-button px-6 border border-white/20 text-white hover:border-lime/30"><BookOpen className="h-4 w-4" />Darslik yaratish</Link>
              </div>
            ) : (
              <div className="flex gap-3">
                <Link href={`/chat?trainer=${params.id}`} className="btn-lime flex items-center gap-2 !py-2.5 text-sm"><MessageCircle className="h-4 w-4" />Xabar yozish</Link>
                <button onClick={handleFollow} className={cn("flex items-center gap-2 !py-2.5 text-sm rounded-button px-6 border", following ? "bg-lime-muted border-lime/30 text-lime" : "border-white/20 text-white hover:border-lime/30")}>{following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{following ? "Obuna" : "Obuna bo'lish"}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.06] mb-6"><div className="flex gap-1 overflow-x-auto">{tabs.map((t: any) => <button key={t.key} onClick={() => setTab(t.key)} className={cn("px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2", tab === t.key ? "text-lime border-lime" : "text-white/40 border-transparent hover:text-white/60")}>{t.label}{t.count > 0 && <span className="ml-1.5 text-xs text-white/20">{t.count}</span>}</button>)}</div></div>

      {/* Tab content */}
      {tab === "about" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {tp.bio && <div className="card p-6"><h3 className="font-semibold text-sm mb-3">Haqida</h3><p className="text-sm text-white/60 leading-relaxed">{tp.bio}</p></div>}
            {tp.gym_name && <div className="card p-6"><h3 className="font-semibold text-sm mb-4">Mashg'ulot joyi</h3><div className="flex items-start gap-3"><div className="w-10 h-10 rounded-lg bg-lime-muted flex items-center justify-center"><Dumbbell className="h-4 w-4 text-lime" /></div><div><p className="font-medium text-sm">{tp.gym_name}</p>{tp.gym_address && <p className="text-xs text-white/40">{tp.gym_address}</p>}</div></div>
              {tp.gym_photos?.length > 0 && <div className="grid grid-cols-3 gap-2 mt-4">{tp.gym_photos.map((url: string, i: number) => <img key={i} src={url} alt="" className="aspect-video rounded-lg object-cover" />)}</div>}
            </div>}
          </div>
          <div className="card p-5"><h3 className="font-semibold text-xs text-white/40 uppercase tracking-wider mb-4">Ma'lumotlar</h3><div className="space-y-3">
            {tp.age && <R l="Yosh" v={`${tp.age} yosh`} />}<R l="Tajriba" v={`${tp.experience_years} yil`} /><R l="Ish turi" v={getWorkTypeLabel(tp.work_type)} />{tp.city && <R l="Shahar" v={tp.city} />}<R l="Shogirdlar" v={`${tp.total_students}`} /><R l="Obunachilar" v={`${tp.followers_count || 0}`} />
          </div></div>
        </div>
      )}

      {/* Darsliklar — professional card */}
      {tab === "lessons" && (
        tp.lessons?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tp.lessons.map((l: any) => (
              <Link key={l.id} href={`/lessons/${l.id}`} className="card-hover group overflow-hidden">
                <div className="w-full aspect-video bg-dark-card flex items-center justify-center">
                  {l.cover_url || l.cover_image_url ? (
                    <img src={l.cover_url || l.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="h-10 w-10 text-white/[0.06]" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {l.category && <span className={cn("badge text-[10px] px-2 py-0.5", getCategoryColor(l.category))}>{getSpecializationLabel(l.category)}</span>}
                    {l.difficulty && <span className="badge-neutral text-[10px] px-2 py-0.5">{l.difficulty === "beginner" ? "Boshlang'ich" : l.difficulty === "intermediate" ? "O'rta" : "Professional"}</span>}
                  </div>
                  <h3 className="font-semibold text-sm mb-2 group-hover:text-lime transition-colors">{l.title}</h3>
                  {l.description && <p className="text-xs text-white/40 mb-3 line-clamp-2">{l.description}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-lime font-bold text-sm">{formatPrice(l.price)}</span>
                    {l.rating > 0 && <div className="flex items-center gap-0.5"><Star className="h-3 w-3 text-lime fill-lime" /><span className="text-xs text-white/50">{l.rating}</span></div>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center"><BookOpen className="h-8 w-8 text-white/10 mx-auto mb-3" /><p className="text-sm text-white/40">Hali darslik yo'q</p></div>
        )
      )}

      {tab === "posts" && (tp.posts?.length > 0 ? <div className="max-w-xl mx-auto space-y-4">{tp.posts.map((p: any) => <div key={p.id} className="card overflow-hidden">{p.images?.length > 0 && <img src={p.images[0]} alt="" className="w-full aspect-square object-cover" />}<div className="p-4">{p.caption && <p className="text-sm text-white/60">{p.caption}</p>}<div className="flex items-center gap-4 mt-3 text-xs text-white/30"><span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{p.likes_count || 0}</span><span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{p.comments_count || 0}</span></div></div></div>)}</div> : <div className="card p-8 text-center"><p className="text-sm text-white/40">Hali post yo'q</p></div>)}

      {tab === "reviews" && (
        <div className="space-y-6">
          {/* Sharh yozish formasi */}
          {user && !isOwnProfile && <ReviewForm trainerId={params.id as string} onDone={() => window.location.reload()} />}

          {/* Sharhlar ro'yxati */}
          {tp.reviews?.length > 0 ? (
            <div className="space-y-4">{tp.reviews.map((r: any) => (
              <div key={r.id} className="card p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center overflow-hidden">
                      {r.profiles?.avatar_url ? <img src={r.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(r.profiles?.full_name || "")}</span>}
                    </div>
                    <div><p className="text-sm font-medium">{r.profiles?.full_name}</p><p className="text-[10px] text-white/30">{new Date(r.created_at).toLocaleDateString("uz-UZ")}</p></div>
                  </div>
                  <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("h-3.5 w-3.5", i < r.rating ? "text-lime fill-lime" : "text-white/10")} />)}</div>
                </div>
                {r.comment && <p className="text-sm text-white/60 mt-3">{r.comment}</p>}
              </div>
            ))}</div>
          ) : (
            <div className="card p-8 text-center"><p className="text-sm text-white/40">Hali sharh yo'q</p>{!user && <p className="text-xs text-white/20 mt-1">Sharh yozish uchun tizimga kiring</p>}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewForm({ trainerId, onDone }: { trainerId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) { toast.error("Reyting tanlang"); return; }
    setSending(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainer_id: trainerId, rating, comment: comment.trim() || null }),
      });
      if (res.ok) { toast.success("Sharh qo'shildi!"); onDone(); }
      else { const d = await res.json(); toast.error(d.message || "Xatolik"); }
    } catch { toast.error("Xatolik"); } finally { setSending(false); }
  };

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-sm mb-4">Sharh yozing</h3>
      <div className="flex gap-1 mb-4">
        {[1,2,3,4,5].map((s) => (
          <button key={s} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} onClick={() => setRating(s)}>
            <Star className={cn("h-6 w-6 transition-colors cursor-pointer", (hover || rating) >= s ? "text-lime fill-lime" : "text-white/15")} />
          </button>
        ))}
        {rating > 0 && <span className="text-xs text-white/40 ml-2 self-center">{rating}/5</span>}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Fikringizni yozing (ixtiyoriy)..." rows={3} className="input-field resize-none text-sm mb-3" maxLength={500} />
      <button onClick={handleSubmit} disabled={rating === 0 || sending} className="btn-lime !py-2 !px-5 text-sm disabled:opacity-30">
        {sending ? "Yuborilmoqda..." : "Yuborish"}
      </button>
    </div>
  );
}

function R({ l, v }: { l: string; v: string }) { return <div className="flex justify-between"><span className="text-xs text-white/30">{l}</span><span className="text-sm text-white/70">{v}</span></div>; }
