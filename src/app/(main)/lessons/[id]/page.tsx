"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Star, Users, BookOpen, ShoppingCart, Play, Lock, Clock, Loader2, MessageCircle, Send, Dumbbell } from "lucide-react";
import { formatPrice, getSpecializationLabel, getCategoryColor, getInitials, cn, timeAgo } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { useParams } from "next/navigation";
import { toast } from "sonner";

export default function LessonDetailPage() {
  const params = useParams();
  const [lesson, setLesson] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.id === lesson?.trainer_id;

  const loadData = async () => {
    try {
      const [lRes, qRes, rRes] = await Promise.all([
        fetch(`/api/lessons/${params.id}`),
        fetch(`/api/lessons/${params.id}/questions`),
        fetch(`/api/lessons/${params.id}/reviews`),
      ]);
      if (lRes.ok) setLesson(await lRes.json());
      if (qRes.ok) setQuestions(await qRes.json());
      if (rRes.ok) setReviews(await rRes.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [params.id]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;
  if (!lesson) return <div className="container-main py-8"><p className="text-white/40">Darslik topilmadi</p></div>;

  const sections = lesson.content?.sections || [];
  const trainer = lesson.profiles;
  // Video kirish huquqi: trener o'zi yoki sotib olgan
  const hasAccess = isOwner || lesson.is_purchased;

  return (
    <div className="container-main py-6 max-w-4xl mx-auto">
      <Link href="/lessons" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white mb-6"><ChevronLeft className="h-4 w-4" />Darsliklar</Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asosiy */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cover */}
          <div className="w-full aspect-video rounded-2xl bg-dark-card overflow-hidden flex items-center justify-center">
            {lesson.cover_image_url ? <img src={lesson.cover_image_url} alt="" className="w-full h-full object-cover" /> : (
              <div className="w-full h-full bg-gradient-to-br from-lime/[0.06] to-dark-card flex flex-col items-center justify-center">
                <Dumbbell className="h-12 w-12 text-lime/20 mb-2" />
                <p className="text-xs text-white/20">{lesson.category ? getSpecializationLabel(lesson.category) : "Darslik"}</p>
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex gap-2 mb-3">
              {lesson.category && <span className={cn("badge text-xs", getCategoryColor(lesson.category))}>{getSpecializationLabel(lesson.category)}</span>}
              {lesson.difficulty && <span className="badge-neutral text-xs">{lesson.difficulty === "beginner" ? "Boshlang'ich" : lesson.difficulty === "intermediate" ? "O'rta" : "Professional"}</span>}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-3">{lesson.title}</h1>
            {lesson.description && <p className="text-sm text-white/60 leading-relaxed">{lesson.description}</p>}
            <div className="flex items-center gap-4 mt-4 text-xs text-white/40">
              {lesson.total_sales > 0 && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{lesson.total_sales} sotib olgan</span>}
              {lesson.rating > 0 && <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-lime fill-lime" />{lesson.rating}</span>}
            </div>
          </div>

          {/* Modullar */}
          {sections.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm">Modullar ({sections.length})</h2>
                {isOwner && (
                  <span className="text-[10px] bg-lime/10 text-lime px-2 py-1 rounded-full font-semibold">SIZNIKI</span>
                )}
              </div>
              <div className="space-y-4">
                {sections.map((s: any, i: number) => (
                  <div key={i} className="space-y-2">
                    {/* Modul sarlavhasi */}
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="w-7 h-7 rounded-lg bg-lime/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-lime">{i + 1}</span>
                      </div>
                      <p className="text-sm font-semibold flex-1">{s.title || `${i + 1}-modul`}</p>
                      {s.videos?.length > 0 && (
                        <span className="text-[10px] text-white/30">{s.videos.length} ta video</span>
                      )}
                    </div>

                    {/* Videolar — agar bor bo'lsa */}
                    {s.videos?.length > 0 && (
                      <div className="space-y-1.5 pl-10">
                        {s.videos.map((v: any, vi: number) => (
                          <div key={vi} className="flex items-center gap-3 p-3 rounded-lg bg-dark-card/50 hover:bg-dark-card transition-colors group">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              hasAccess ? "bg-lime/10 group-hover:bg-lime/20" : "bg-white/[0.04]")}>
                              {hasAccess ? <Play className="h-3.5 w-3.5 text-lime" /> : <Lock className="h-3.5 w-3.5 text-white/30" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{v.title || `Video ${vi + 1}`}</p>
                              {v.description && <p className="text-[10px] text-white/30 truncate">{v.description}</p>}
                            </div>
                            {hasAccess ? (
                              <button className="text-[10px] text-lime opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                                Ko'rish →
                              </button>
                            ) : (
                              <span className="text-[10px] text-white/20">Sotib oling</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bo'sh modul — faqat trener uchun "video qo'shing" */}
                    {(!s.videos || s.videos.length === 0) && isOwner && (
                      <div className="pl-10">
                        <Link href={`/lessons/create?edit=${lesson.id}`} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-white/10 hover:border-lime/30 hover:bg-lime/5 transition-all text-[11px] text-white/40 hover:text-lime">
                          <Play className="h-3 w-3" />
                          Video qo'shish
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Savollar bo'limi */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-sm">Savollar</h2>
                <p className="text-[10px] text-white/30 mt-0.5">Darslik haqida savol bering</p>
              </div>
              <MessageCircle className="h-4 w-4 text-white/20" />
            </div>

            {/* Savol yozish */}
            {user ? (
              <QuestionForm lessonId={lesson.id} onDone={() => loadData()} />
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-white/40 mb-2">Savol berish uchun tizimga kiring</p>
                <Link href="/login" className="text-xs text-lime hover:underline">Kirish →</Link>
              </div>
            )}

            {/* Savollar ro'yxati */}
            {questions?.length > 0 ? (
              <div className="mt-4 space-y-3 border-t border-white/[0.04] pt-4">
                {questions.map((q: any) => (
                  <div key={q.id} className="bg-dark-card/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-lime/10 flex items-center justify-center text-[9px] font-bold text-lime overflow-hidden">
                        {q.user?.avatar_url ? <img src={q.user.avatar_url} alt="" className="w-full h-full object-cover" /> : getInitials(q.user?.full_name || "?")}
                      </div>
                      <span className="text-[11px] font-medium">{q.user?.full_name}</span>
                      <span className="text-[9px] text-white/20">{timeAgo(q.created_at)}</span>
                    </div>
                    <p className="text-xs text-white/60">{q.question}</p>
                    {q.answer && (
                      <div className="mt-2 ml-4 pl-3 border-l-2 border-lime/30">
                        <p className="text-[10px] text-lime/70 mb-1">Trener javobi:</p>
                        <p className="text-xs text-white/60">{q.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-white/20 mt-3 text-center">Hali savol yo'q</p>
            )}
          </div>

          {/* Sharhlar bo'limi */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-sm">Sharhlar va reyting</h2>
                <p className="text-[10px] text-white/30 mt-0.5">Faqat sotib olganlar sharh qoldirishi mumkin</p>
              </div>
              {lesson.rating > 0 && (
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-lime fill-lime" />
                  <span className="text-sm font-bold">{lesson.rating}</span>
                  <span className="text-[10px] text-white/30">({lesson.total_reviews || 0})</span>
                </div>
              )}
            </div>

            {/* Sharh yozish — faqat sotib olganlar */}
            {hasAccess && !isOwner ? (
              <ReviewForm lessonId={lesson.id} onDone={() => loadData()} />
            ) : !isOwner ? (
              <div className="bg-dark-card/50 rounded-lg p-4 text-center mb-4">
                <Lock className="h-5 w-5 text-white/20 mx-auto mb-2" />
                <p className="text-xs text-white/40">Sharh qoldirish uchun darslikni sotib oling</p>
              </div>
            ) : null}

            {/* Sharhlar ro'yxati */}
            {reviews?.length > 0 ? (
              <div className="space-y-3 mt-4 border-t border-white/[0.04] pt-4">
                {reviews.map((r: any) => (
                  <div key={r.id} className="bg-dark-card/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-lime/10 flex items-center justify-center text-[9px] font-bold text-lime overflow-hidden">
                        {r.user?.avatar_url ? <img src={r.user.avatar_url} alt="" className="w-full h-full object-cover" /> : getInitials(r.user?.full_name || "?")}
                      </div>
                      <span className="text-[11px] font-medium">{r.user?.full_name}</span>
                      <div className="flex items-center gap-0.5 ml-auto">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("h-3 w-3", i < r.rating ? "text-lime fill-lime" : "text-white/10")} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-white/60">{r.comment}</p>
                    <p className="text-[9px] text-white/20 mt-2">{timeAgo(r.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-white/20 mt-3 text-center">Hali sharh yo'q</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-6 sticky top-20">
            <PricingDisplay lesson={lesson} isOwner={isOwner} />

            {/* Trener */}
            {trainer && (
              <Link href={`/trainers/${lesson.trainer_id}`} className="flex items-center gap-3 mt-5 pt-5 border-t border-white/[0.06] group">
                <div className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center overflow-hidden">
                  {trainer.avatar_url ? <img src={trainer.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(trainer.full_name)}</span>}
                </div>
                <div>
                  <p className="text-sm font-medium group-hover:text-lime transition-colors">{trainer.full_name}</p>
                  <p className="text-[10px] text-white/40">Trener</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// PRICING DISPLAY COMPONENT — oylik / umrbod / ikkalasi
function PricingDisplay({ lesson, isOwner }: any) {
  const [selected, setSelected] = useState<"lifetime" | "monthly">(
    lesson.pricing_model === "monthly" ? "monthly" : "lifetime"
  );

  // Backwards compatibility: agar yangi fieldlar yo'q bo'lsa, eski 'price' ishlatamiz
  const priceLifetime = lesson.price_lifetime || lesson.price || 0;
  const priceMonthly = lesson.price_monthly || 0;
  const model = lesson.pricing_model || "lifetime";

  if (isOwner) {
    return (
      <>
        <div className="space-y-2 mb-5">
          {(model === "lifetime" || model === "both") && priceLifetime > 0 && (
            <div className="flex items-center justify-between bg-dark-card rounded-lg p-3">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Bir umrlik</p>
                <p className="text-base font-bold text-lime">{formatPrice(priceLifetime)}</p>
              </div>
              <span className="text-[9px] text-white/30">∞</span>
            </div>
          )}
          {(model === "monthly" || model === "both") && priceMonthly > 0 && (
            <div className="flex items-center justify-between bg-dark-card rounded-lg p-3">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Oyiga</p>
                <p className="text-base font-bold text-lime">{formatPrice(priceMonthly)}</p>
              </div>
              <span className="text-[9px] text-white/30">/oy</span>
            </div>
          )}
        </div>
        <Link href={`/lessons/create?edit=${lesson.id}`} className="btn-lime w-full text-center !py-3 text-sm block">Tahrirlash</Link>
      </>
    );
  }

  // User uchun — pricing tanlovi
  if (model === "both" && priceLifetime > 0 && priceMonthly > 0) {
    return (
      <>
        <p className="text-xs text-white/60 mb-3">Variantni tanlang:</p>
        <div className="space-y-2 mb-4">
          <button
            onClick={() => setSelected("monthly")}
            className={cn("w-full text-left p-3 rounded-lg border transition-all",
              selected === "monthly" ? "border-lime bg-lime/[0.08]" : "border-white/[0.06] bg-dark-card hover:border-white/20")}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">Oylik obuna</span>
              {selected === "monthly" && <div className="w-4 h-4 rounded-full bg-lime flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-black" /></div>}
            </div>
            <p className="text-base font-bold text-lime">{formatPrice(priceMonthly)} <span className="text-[10px] font-normal text-white/40">/oy</span></p>
            <p className="text-[10px] text-white/40 mt-0.5">Har oy yangilanadi</p>
          </button>

          <button
            onClick={() => setSelected("lifetime")}
            className={cn("w-full text-left p-3 rounded-lg border transition-all relative",
              selected === "lifetime" ? "border-lime bg-lime/[0.08]" : "border-white/[0.06] bg-dark-card hover:border-white/20")}>
            <span className="absolute -top-2 right-3 text-[8px] bg-lime text-black px-2 py-0.5 rounded-full font-bold">TEJAYDI</span>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">Bir umrlik</span>
              {selected === "lifetime" && <div className="w-4 h-4 rounded-full bg-lime flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-black" /></div>}
            </div>
            <p className="text-base font-bold text-lime">{formatPrice(priceLifetime)}</p>
            <p className="text-[10px] text-white/40 mt-0.5">Bir marta to'lab umrbod kirish</p>
          </button>
        </div>

        <button onClick={() => toast.info("To'lov tizimi tez orada!")} className="btn-lime w-full !py-3 text-sm flex items-center justify-center gap-2">
          <ShoppingCart className="h-4 w-4" />Sotib olish
        </button>
      </>
    );
  }

  // Faqat bir variant
  const isMonthlyOnly = model === "monthly";
  const price = isMonthlyOnly ? priceMonthly : priceLifetime;
  return (
    <>
      <p className="text-2xl font-bold text-lime mb-1">
        {formatPrice(price)}
        {isMonthlyOnly && <span className="text-sm font-normal text-white/40"> /oy</span>}
      </p>
      <p className="text-[10px] text-white/30 mb-5">
        {isMonthlyOnly ? "Oylik obuna · Har oy yangilanadi" : "Bir martalik to'lov · Umrbod kirish"}
      </p>
      <button onClick={() => toast.info("To'lov tizimi tez orada!")} className="btn-lime w-full !py-3 text-sm flex items-center justify-center gap-2">
        <ShoppingCart className="h-4 w-4" />Sotib olish
      </button>
    </>
  );
}

// ====== SAVOL FORM ======
function QuestionForm({ lessonId, onDone }: { lessonId: string; onDone: () => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) { toast.error("Savol yozing"); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/questions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text.trim() }),
      });
      if (res.ok) { toast.success("Savol yuborildi"); setText(""); onDone(); }
      else { const d = await res.json(); toast.error(d.message || "Xatolik"); }
    } catch { toast.error("Xatolik"); } finally { setSending(false); }
  };

  return (
    <div className="flex gap-2">
      <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Savolingizni yozing..."
        className="input-field flex-1 text-sm" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
      <button onClick={handleSubmit} disabled={sending || !text.trim()}
        className="btn-lime !px-4 !py-2 shrink-0 disabled:opacity-30">
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ====== SHARH/REVIEW FORM ======
function ReviewForm({ lessonId, onDone }: { lessonId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) { toast.error("Reyting tanlang (1-5 yulduz)"); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/reviews`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      if (res.ok) { toast.success("Sharh qo'shildi!"); setRating(0); setComment(""); onDone(); }
      else { const d = await res.json(); toast.error(d.message || "Xatolik"); }
    } catch { toast.error("Xatolik"); } finally { setSending(false); }
  };

  return (
    <div className="bg-dark-card/50 rounded-lg p-4 space-y-3">
      {/* Yulduzlar */}
      <div>
        <p className="text-xs text-white/40 mb-2">Baholang:</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(n)} className="p-0.5">
              <Star className={cn("h-6 w-6 transition-colors",
                n <= (hoverRating || rating) ? "text-lime fill-lime" : "text-white/15 hover:text-white/30")} />
            </button>
          ))}
          {rating > 0 && <span className="text-xs text-white/40 ml-2 self-center">{rating}/5</span>}
        </div>
      </div>

      {/* Izoh */}
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Fikringizni yozing (ixtiyoriy)..."
        rows={2} className="input-field resize-none text-sm" />

      <button onClick={handleSubmit} disabled={sending || rating === 0}
        className="btn-lime w-full !py-2 text-sm disabled:opacity-30 flex items-center justify-center gap-2">
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sending ? "Yuborilmoqda..." : "Sharh qoldirish"}
      </button>
    </div>
  );
}
