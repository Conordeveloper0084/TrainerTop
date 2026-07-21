"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Settings, BookOpen, TrendingUp, LogOut, Plus, Star, Users, Clock, ChevronRight, Loader2, Save, Dumbbell, MapPin, Camera, CreditCard, Eye, ShoppingBag, Play, DollarSign, Image as ImageIcon, Trash2, CheckCircle, X, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { createClient } from "@/lib/supabase/client";
import { SPECIALIZATIONS, CITIES, WORK_TYPES } from "@/lib/constants";

type Tab = "overview" | "lessons" | "settings" | "billing" | "earnings";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const user = useAuthStore((s) => s.user);
  const trainerProfile = useAuthStore((s) => s.trainerProfile);
  const router = useRouter();

  useEffect(() => { if (!user) router.push("/login"); }, [user, router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    useAuthStore.getState().logout();
    toast.success("Chiqdingiz");
    window.location.href = "/";
  };

  if (!user) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;

  const isTrainer = user.role === "trainer";
  const tabs: { key: Tab; label: string; icon: any }[] = isTrainer
    ? [{ key: "overview", label: "Umumiy", icon: User }, { key: "lessons", label: "Darsliklarim", icon: BookOpen }, { key: "earnings", label: "Daromad", icon: TrendingUp }, { key: "settings", label: "Sozlamalar", icon: Settings }]
    : [{ key: "overview", label: "Umumiy", icon: User }, { key: "lessons", label: "Darsliklarim", icon: ShoppingBag }, { key: "billing", label: "To'lovlar", icon: CreditCard }, { key: "settings", label: "Sozlamalar", icon: Settings }];

  return (
    <div className="container-main py-8">
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="flex flex-col items-center gap-2">
            <AvatarUpload user={user} />
            <button onClick={() => document.getElementById("avatar-input")?.click()}
              className="flex items-center gap-1.5 text-[11px] text-lime/60 hover:text-lime transition-colors">
              <Camera className="h-3 w-3" />Rasm o'zgartirish
            </button>
          </div>
          <div className="flex-1 pt-1">
            <h1 className="text-lg font-bold">{user.full_name}</h1>
            <p className="text-sm text-white/40">{user.email}</p>
            <span className={cn("badge text-[10px] mt-1.5", isTrainer ? "badge-lime" : "badge-neutral")}>{isTrainer ? "Trener" : "Foydalanuvchi"}</span>
          </div>
          {!isTrainer && <Link href="/become-trainer" className="btn-soft !py-2 !px-4 text-xs flex items-center gap-1.5"><Dumbbell className="h-3 w-3" />Trener bo'lish</Link>}
        </div>
      </div>

      {isTrainer && trainerProfile && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <SC icon={Star} label="Reyting" value={trainerProfile.rating > 0 ? `${trainerProfile.rating}` : "Yangi"} accent />
          <SC icon={Users} label="Obunachilar" value={`${trainerProfile.followers_count || 0}`} />
          <SC icon={BookOpen} label="Sharhlar" value={`${trainerProfile.total_reviews}`} />
          <SC icon={Clock} label="Tajriba" value={`${trainerProfile.experience_years} yil`} />
        </div>
      )}

      <div className="flex gap-1 border-b border-white/[0.06] mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
              activeTab === t.key ? "text-lime border-lime" : "text-white/40 border-transparent hover:text-white/60")}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      <div className="animate-fade-in">
        {activeTab === "overview" && <OverviewTab isTrainer={isTrainer} />}
        {activeTab === "lessons" && (isTrainer ? <TrainerLessonsTab userId={user.id} /> : <UserLessonsTab />)}
        {activeTab === "billing" && <BillingTab />}
        {activeTab === "earnings" && <EarningsTab />}
        {activeTab === "settings" && <SettingsTab user={user} trainerProfile={trainerProfile} isTrainer={isTrainer} onLogout={handleLogout} />}
      </div>
    </div>
  );
}

function AvatarUpload({ user }: { user: any }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(user.avatar_url || "");
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("5MB dan katta"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Faqat rasm"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "avatars");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Yuklash xatosi");
      const { url } = await res.json();
      // Profile API orqali yangilash
      await fetch("/api/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      });
      setPreview(url);
      useAuthStore.getState().setUser({ ...user, avatar_url: url });
      toast.success("Rasm yangilandi!");
    } catch (err) {
      toast.error("Rasm yuklashda xatolik");
    } finally { setUploading(false); }
  };
  return (
    <div className="relative group">
      <div className="w-20 h-20 rounded-2xl bg-lime/20 flex items-center justify-center overflow-hidden ring-2 ring-white/[0.06]">
        {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl font-bold text-lime">{getInitials(user.full_name)}</span>}
      </div>
      {/* Camera icon — doim ko'rinadi */}
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-lime flex items-center justify-center shadow-lg shadow-lime/30 hover:bg-lime/80 transition-colors">
        {uploading ? <Loader2 className="h-3.5 w-3.5 text-black animate-spin" /> : <Camera className="h-3.5 w-3.5 text-black" />}
      </button>
      <input ref={fileRef} id="avatar-input" type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </div>
  );
}

function SC({ icon: I, label, value, accent }: any) { return <div className="card p-4"><div className="flex items-center gap-2 mb-2"><I className={cn("h-4 w-4", accent ? "text-lime" : "text-white/30")} /><span className="text-[11px] text-white/30">{label}</span></div><p className={cn("text-lg font-bold", accent && "text-lime")}>{value}</p></div>; }

function OverviewTab({ isTrainer }: { isTrainer: boolean }) {
  return (
    <div className="space-y-6">
      {isTrainer ? (
        <div className="card p-6"><h3 className="font-semibold text-sm mb-4">Tezkor harakatlar</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/lessons/create" className="card-hover p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-lime-muted flex items-center justify-center"><Plus className="h-4 w-4 text-lime" /></div><div><p className="text-sm font-medium">Darslik yaratish</p></div><ChevronRight className="h-4 w-4 text-white/20 ml-auto" /></Link>
            <Link href="/posts" className="card-hover p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-lime-muted flex items-center justify-center"><Plus className="h-4 w-4 text-lime" /></div><div><p className="text-sm font-medium">Post yaratish</p></div><ChevronRight className="h-4 w-4 text-white/20 ml-auto" /></Link>
          </div>
        </div>
      ) : (
        <div className="card p-6"><h3 className="font-semibold text-sm mb-4">Platformani kashf eting</h3>
          <div className="space-y-2">
            <Link href="/trainers" className="card-hover p-3 flex items-center gap-3 rounded-lg"><Users className="h-4 w-4 text-white/30" /><span className="text-sm text-white/60">Trenerlar</span><ChevronRight className="h-3.5 w-3.5 text-white/15 ml-auto" /></Link>
            <Link href="/lessons" className="card-hover p-3 flex items-center gap-3 rounded-lg"><BookOpen className="h-4 w-4 text-white/30" /><span className="text-sm text-white/60">Darsliklar</span><ChevronRight className="h-3.5 w-3.5 text-white/15 ml-auto" /></Link>
            <Link href="/posts" className="card-hover p-3 flex items-center gap-3 rounded-lg"><Star className="h-4 w-4 text-white/30" /><span className="text-sm text-white/60">Postlar</span><ChevronRight className="h-3.5 w-3.5 text-white/15 ml-auto" /></Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Trainer darsliklarini database'dan oladi
function TrainerLessonsTab({ userId }: { userId: string }) {
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/lessons?trainer_id=${userId}`);
        const data = await res.json();
        setLessons(Array.isArray(data) ? data : []);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [userId]);

  const handleDelete = async (id: string) => {
    if (!confirm("O'chirishni xohlaysizmi?")) return;
    const res = await fetch(`/api/lessons/${id}`, { method: "DELETE" });
    if (res.ok) { setLessons((p) => p.filter((l) => l.id !== id)); toast.success("O'chirildi"); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 text-lime animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6"><p className="text-xs text-white/30">{lessons.length} ta darslik</p><Link href="/lessons/create" className="btn-lime !py-2.5 !px-5 text-sm flex items-center gap-2"><Plus className="h-4 w-4" />Yangi darslik</Link></div>
      {lessons.length === 0 ? (
        <div className="card p-12 text-center"><BookOpen className="h-10 w-10 text-white/10 mx-auto mb-4" /><p className="text-sm text-white/40 mb-4">Hali darslik yo'q</p><Link href="/lessons/create" className="btn-lime text-sm inline-flex items-center gap-2"><Plus className="h-4 w-4" />Darslik yaratish</Link></div>
      ) : (
        <div className="space-y-3">{lessons.map((l) => (
          <div key={l.id} className="card p-4 flex items-start gap-4">
            <div className="w-24 h-16 rounded-lg bg-dark-card flex items-center justify-center shrink-0"><BookOpen className="h-6 w-6 text-white/[0.08]" /></div>
            <div className="flex-1 min-w-0"><h4 className="text-sm font-medium truncate">{l.title}</h4><p className="text-lime font-semibold text-sm mt-1">{formatPrice(l.price)}</p></div>
            <button onClick={() => handleDelete(l.id)} className="p-2 rounded-lg text-red-400/30 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}</div>
      )}
    </div>
  );
}

function UserLessonsTab() {
  return <div className="card p-12 text-center"><ShoppingBag className="h-10 w-10 text-white/10 mx-auto mb-4" /><p className="text-sm text-white/40">Hali darslik sotib olinmagan</p><Link href="/lessons" className="btn-lime !py-2 !px-5 text-sm mt-3 inline-block">Darsliklar</Link></div>;
}

function BillingTab() { return <div className="card p-12 text-center"><CreditCard className="h-8 w-8 text-white/10 mx-auto mb-3" /><p className="text-sm text-white/40">Hali to'lov yo'q</p></div>; }
function EarningsTab() {
  const [trainerData, setTrainerData] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, pRes] = await Promise.all([
        fetch("/api/trainer-profile"),
        fetch("/api/payouts"),
      ]);
      if (tRes.ok) setTrainerData(await tRes.json());
      if (pRes.ok) setPayouts(await pRes.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 text-lime animate-spin" /></div>;

  const balance = trainerData?.balance || 0;
  const totalEarned = trainerData?.total_earned || 0;
  const totalLessonsSold = trainerData?.total_lessons_sold || 0;
  const lessonsCount = trainerData?.lessons_count || 0;
  const hasCard = !!trainerData?.card_number;
  const hasPending = payouts.some((p: any) => p.status === "pending");

  // Payouts statistika
  const completedPayouts = payouts.filter((p: any) => p.status === "completed");
  const totalWithdrawn = completedPayouts.reduce((s: number, p: any) => s + p.amount, 0);
  const pendingPayouts = payouts.filter((p: any) => p.status === "pending");
  const pendingAmount = pendingPayouts.reduce((s: number, p: any) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      {/* ASOSIY: joriy balans */}
      <div className="card p-6 bg-gradient-to-br from-lime/[0.08] to-lime/[0.02] border-lime/20">
        <div className="flex items-start justify-between mb-1">
          <p className="text-xs text-lime/70">Yechishga tayyor balans</p>
          <Wallet className="h-4 w-4 text-lime/60" />
        </div>
        <p className="text-3xl font-bold text-lime">{formatPrice(balance)}</p>
        <p className="text-[11px] text-white/40 mt-2">Bu pul kartangizga o'tkazilishi mumkin</p>
      </div>

      {/* Sotuv statistikasi */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-lime/10 flex items-center justify-center">
              <ShoppingBag className="h-3.5 w-3.5 text-lime" />
            </div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Sotilgan</p>
          </div>
          <p className="text-xl font-bold">{totalLessonsSold}</p>
          <p className="text-[10px] text-white/30 mt-1">{lessonsCount} ta darslikdan</p>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-lime/10 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-lime" />
            </div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Jami daromad</p>
          </div>
          <p className="text-xl font-bold">{formatPrice(totalEarned)}</p>
          <p className="text-[10px] text-white/30 mt-1">10% komissiyadan keyin</p>
        </div>
      </div>

      {/* Yechish statistikasi - faqat agar yechgan bo'lsa */}
      {(totalWithdrawn > 0 || pendingAmount > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {totalWithdrawn > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <CheckCircle className="h-3.5 w-3.5 text-white/60" />
                </div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Yechib olingan</p>
              </div>
              <p className="text-xl font-bold text-white/80">{formatPrice(totalWithdrawn)}</p>
              <p className="text-[10px] text-white/30 mt-1">{completedPayouts.length} marta</p>
            </div>
          )}
          {pendingAmount > 0 && (
            <div className="card p-4 border-yellow-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-yellow-500" />
                </div>
                <p className="text-[10px] text-yellow-500/70 uppercase tracking-wider">Kutilmoqda</p>
              </div>
              <p className="text-xl font-bold text-yellow-500">{formatPrice(pendingAmount)}</p>
              <p className="text-[10px] text-white/30 mt-1">Admin ko'rib chiqmoqda</p>
            </div>
          )}
        </div>
      )}

      {/* Komissiya info — kichik va aniq */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-lime/10 flex items-center justify-center shrink-0 mt-0.5">
          <DollarSign className="h-3.5 w-3.5 text-lime" />
        </div>
        <p className="text-[11px] text-white/50 leading-relaxed">
          Har bir sotuvdan platforma <span className="text-lime font-semibold">10% komissiya</span> oladi. Misol: 100,000 so'mlik darslik sotilsa — sizga avtomatik <span className="text-lime font-semibold">90,000 so'm</span> tushadi.
        </p>
      </div>

      {/* Pul yechish tugmasi */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">Pul yechish</h3>
            <p className="text-[11px] text-white/40 mt-0.5">Minimum 100,000 so'm</p>
          </div>
          {hasPending && <span className="badge bg-yellow-500/10 text-yellow-500 text-[10px]">Kutilmoqda</span>}
        </div>
        {!hasCard ? (
          <div className="text-[11px] text-yellow-500 bg-yellow-500/[0.06] border border-yellow-500/20 rounded-lg p-3 mb-3">
            Avval "Sozlamalar" bo'limida karta raqami kiriting
          </div>
        ) : null}
        <button onClick={() => setShowModal(true)} disabled={!hasCard || balance < 100000 || hasPending}
          className="btn-lime w-full text-sm !py-2.5 disabled:opacity-30 disabled:cursor-not-allowed">
          {hasPending ? "Request kutilmoqda" : balance < 100000 ? "Yetarli mablag' yo'q" : "Pul yechish"}
        </button>
      </div>

      {/* Tarix - chek uslubida */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Pul yechish tarixi</h3>
          {payouts.length > 0 && <span className="text-[10px] text-white/30">{payouts.length} ta operatsiya</span>}
        </div>
        {payouts.length === 0 ? (
          <div className="card p-10 text-center">
            <TrendingUp className="h-8 w-8 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40">Hali pul yechib olmagan</p>
            <p className="text-[10px] text-white/20 mt-1">Yechgan pullaringiz tarixi shu yerda chiqadi</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payouts.map((p: any) => (
              <button key={p.id} onClick={() => setSelectedPayout(p)} className="card w-full p-4 text-left hover:border-lime/20 transition-all group">
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    p.status === "completed" ? "bg-lime/10" :
                    p.status === "rejected" ? "bg-red-500/10" : "bg-yellow-500/10")}>
                    {p.status === "completed" ? <CheckCircle className="h-5 w-5 text-lime" /> :
                     p.status === "rejected" ? <X className="h-5 w-5 text-red-400" /> :
                     <Clock className="h-5 w-5 text-yellow-500" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold">{formatPrice(p.amount)}</p>
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-semibold",
                        p.status === "completed" ? "bg-lime-muted text-lime" :
                        p.status === "rejected" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-500")}>
                        {p.status === "completed" ? "O'tkazildi" : p.status === "rejected" ? "Rad etildi" : "Kutilmoqda"}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40 truncate">
                      {p.card_number?.replace(/(\d{4})/g, "$1 ").trim()} · {new Date(p.requested_at).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-lime transition-colors shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showModal && <PayoutModal balance={balance} trainerData={trainerData} onClose={() => setShowModal(false)} onDone={() => { setShowModal(false); load(); }} />}
      {selectedPayout && <PayoutDetailsModal payout={selectedPayout} onClose={() => setSelectedPayout(null)} />}
    </div>
  );
}

// Pul yechish chek/details modali
function PayoutDetailsModal({ payout, onClose }: any) {
  const statusInfo = {
    completed: { label: "O'tkazildi", color: "text-lime", bg: "bg-lime/10", icon: CheckCircle },
    rejected: { label: "Rad etildi", color: "text-red-400", bg: "bg-red-500/10", icon: X },
    pending: { label: "Kutilmoqda", color: "text-yellow-500", bg: "bg-yellow-500/10", icon: Clock },
  }[payout.status as "completed" | "rejected" | "pending"];

  const StatusIcon = statusInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3", statusInfo.bg)}>
              <StatusIcon className={cn("h-8 w-8", statusInfo.color)} />
            </div>
            <p className={cn("text-xs font-semibold uppercase tracking-wider", statusInfo.color)}>{statusInfo.label}</p>
            <p className="text-3xl font-bold mt-2">{formatPrice(payout.amount)}</p>
          </div>

          {/* Detail rows - chek kabi */}
          <div className="space-y-0 border-y border-dashed border-white/[0.08] py-4 mb-4">
            <DetailRow label="Operatsiya ID" value={payout.id.slice(0, 8).toUpperCase()} mono />
            <DetailRow label="Karta raqami" value={payout.card_number?.replace(/(\d{4})/g, "$1 ").trim()} mono />
            {payout.card_holder && <DetailRow label="Karta egasi" value={payout.card_holder} />}
            <DetailRow label="Yuborilgan sana" value={new Date(payout.requested_at).toLocaleString("uz-UZ", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} />
            {payout.completed_at && (
              <DetailRow label={payout.status === "completed" ? "O'tkazilgan sana" : "Rad etilgan sana"} value={new Date(payout.completed_at).toLocaleString("uz-UZ", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} />
            )}
          </div>

          {/* Admin note */}
          {payout.admin_note && (
            <div className={cn("rounded-lg p-3 mb-4 border", payout.status === "rejected" ? "bg-red-500/[0.04] border-red-500/20" : "bg-white/[0.02] border-white/[0.06]")}>
              <p className="text-[10px] text-white/40 mb-1 uppercase tracking-wider">Admin xabari</p>
              <p className="text-xs text-white/70">{payout.admin_note}</p>
            </div>
          )}

          {/* Status info */}
          {payout.status === "pending" && (
            <div className="bg-yellow-500/[0.04] border border-yellow-500/20 rounded-lg p-3 mb-4">
              <p className="text-[11px] text-yellow-500/80 leading-relaxed">
                Sizning so'rovingiz admin tomonidan ko'rib chiqilmoqda. Odatda 1-3 ish kuni ichida bajariladi.
              </p>
            </div>
          )}

          {payout.status === "completed" && (
            <div className="bg-lime/[0.04] border border-lime/20 rounded-lg p-3 mb-4">
              <p className="text-[11px] text-lime/80 leading-relaxed">
                Pul kartangizga muvaffaqiyatli o'tkazildi. Agar pul kelmagan bo'lsa support bilan bog'laning.
              </p>
            </div>
          )}

          <button onClick={onClose} className="btn-outline w-full text-sm">Yopish</button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2">
      <p className="text-[11px] text-white/40 shrink-0 mr-3">{label}</p>
      <p className={cn("text-xs text-white/80 text-right", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function PayoutModal({ balance, trainerData, onClose, onDone }: any) {
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [useCustomCard, setUseCustomCard] = useState(false);
  const [customCard, setCustomCard] = useState("");
  const [customHolder, setCustomHolder] = useState("");

  const handleSubmit = async () => {
    const num = parseInt(amount);
    if (!num || num < 100000) { toast.error("Minimum 100,000 so'm"); return; }
    if (num > balance) { toast.error("Balansdan ko'p"); return; }

    // Custom karta validation
    if (useCustomCard) {
      if (customCard.length !== 16) { toast.error("Karta 16 raqam bo'lishi kerak"); return; }
      if (!customHolder.trim()) { toast.error("Karta egasini kiriting"); return; }
    }

    setSending(true);
    try {
      const body: any = { amount: num };
      if (useCustomCard) {
        body.card_number = customCard;
        body.card_holder = customHolder.trim().toUpperCase();
      }
      const res = await fetch("/api/payouts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { toast.success("Request yuborildi"); onDone(); }
      else { const d = await res.json(); toast.error(d.message || "Xatolik"); }
    } catch { toast.error("Xatolik"); } finally { setSending(false); }
  };

  // Komissiya hisoblash (trener pulini yechganda komissiya YO'Q — chunki balans allaqachon sof)
  const num = parseInt(amount) || 0;
  const fee = 0; // Pul yechishda komissiya yo'q — sotuvda allaqachon ushlab qolingan
  const willReceive = num - fee;

  const cardNumber = useCustomCard ? customCard : (trainerData?.card_number || "");
  const cardHolder = useCustomCard ? customHolder : (trainerData?.card_holder || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-1">Pul yechish</h2>
          <p className="text-xs text-white/40 mb-5">Balansda: <span className="text-lime font-semibold">{formatPrice(balance)}</span></p>

          {/* Miqdor */}
          <div className="mb-3">
            <label className="block text-xs text-white/60 mb-2">Miqdor (so'm)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100000" className="input-field" />
            <p className="text-[10px] text-white/30 mt-1.5">Minimum 100,000 so'm</p>
          </div>

          {/* Hammasi tugma */}
          <button onClick={() => setAmount(balance.toString())}
            className="w-full mb-4 px-3 py-2 rounded-lg bg-lime/10 border border-lime/30 text-xs text-lime font-semibold hover:bg-lime/20 transition-all">
            Hammasini yechish ({formatPrice(balance)})
          </button>

          {/* Yechiladigan miqdor */}
          {num > 0 && num >= 100000 && num <= balance && (
            <div className="bg-lime/[0.04] border border-lime/20 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-white/60">Kartangizga tushadi:</p>
                <p className="text-sm font-bold text-lime">{formatPrice(willReceive)}</p>
              </div>
            </div>
          )}

          {/* Karta */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-white/60">Karta raqami</label>
              <button onClick={() => setUseCustomCard(!useCustomCard)} className="text-[10px] text-lime hover:underline">
                {useCustomCard ? "Saqlangan kartani ishlatish" : "Boshqa karta"}
              </button>
            </div>

            {useCustomCard ? (
              <div className="space-y-2 animate-fade-in-up">
                <input type="text" value={customCard} onChange={(e) => setCustomCard(e.target.value.replace(/\D/g, "").slice(0, 16))} placeholder="8600 1234 5678 9012" className="input-field font-mono text-sm" />
                <input type="text" value={customHolder} onChange={(e) => setCustomHolder(e.target.value.toUpperCase())} placeholder="KARTA EGASI ISMI" className="input-field uppercase text-sm" />
                <p className="text-[10px] text-white/30">Bu pul boshqa kartaga yuboriladi. Saqlangan kartangiz o'zgarmaydi.</p>
              </div>
            ) : (
              <div className="bg-dark-card rounded-lg p-3 border border-white/[0.06]">
                {cardNumber ? (
                  <>
                    <p className="font-mono text-sm">{cardNumber.replace(/(\d{4})/g, "$1 ").trim()}</p>
                    {cardHolder && <p className="text-[10px] text-white/40 mt-1">{cardHolder}</p>}
                  </>
                ) : (
                  <p className="text-xs text-white/30">Karta saqlanmagan</p>
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 mb-5">
            <p className="text-[10px] text-white/50 leading-relaxed">
              Request 1-3 ish kuni ichida ko'rib chiqiladi. Pul yechishda komissiya yo'q — barcha komissiyalar sotuvda allaqachon ushlab qolingan.
            </p>
          </div>

          {/* Tugmalar */}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-outline flex-1 !py-2.5 text-sm">Bekor qilish</button>
            <button onClick={handleSubmit} disabled={sending} className="btn-lime flex-1 !py-2.5 text-sm disabled:opacity-30">
              {sending ? "Yuborilmoqda..." : "Yuborish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ user, trainerProfile, isTrainer, onLogout }: any) {
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(user.full_name || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [bio, setBio] = useState(trainerProfile?.bio || "");
  const [age, setAge] = useState(trainerProfile?.age?.toString() || "");
  const [exp, setExp] = useState(trainerProfile?.experience_years?.toString() || "0");
  const [specs, setSpecs] = useState<string[]>(trainerProfile?.specializations || []);
  const [workType, setWorkType] = useState(trainerProfile?.work_type || "both");
  const [city, setCity] = useState(trainerProfile?.city || "");
  const [hasGym, setHasGym] = useState(!!(trainerProfile?.gym_name));
  const [gymName, setGymName] = useState(trainerProfile?.gym_name || "");
  const [gymAddr, setGymAddr] = useState(trainerProfile?.gym_address || "");
  const [monthlyPrice, setMonthlyPrice] = useState(trainerProfile?.monthly_price?.toString() || "");
  const [students, setStudents] = useState(trainerProfile?.total_students?.toString() || "0");
  const [gymPhotos, setGymPhotos] = useState<string[]>(trainerProfile?.gym_photos || []);
  const [cardNumber, setCardNumber] = useState(trainerProfile?.card_number || "");
  const [cardHolder, setCardHolder] = useState(trainerProfile?.card_holder || "");
  const gymFileRef = useRef<HTMLInputElement>(null);
  const toggleSpec = (s: string) => setSpecs((p) => p.includes(s) ? p.filter((x) => x !== s) : p.length >= 5 ? (toast.error("Max 5"), p) : [...p, s]);

  const handleGymPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (gymPhotos.length >= 5) { toast.error("Max 5 rasm"); return; }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", "gyms");
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      setGymPhotos((p) => [...p, url]);
      toast.success("Rasm yuklandi");
    } else {
      toast.error("Yuklash xatosi");
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) { toast.error("Ism kerak"); return; }
    setSaving(true);
    try {
      const body: any = { full_name: fullName.trim(), phone: phone.trim() || null };
      if (isTrainer) body.trainer_data = {
        bio: bio.trim() || null, age: age ? parseInt(age) : null, experience_years: exp ? parseInt(exp) : 0,
        specializations: specs, work_type: workType, city: city || null,
        gym_name: hasGym ? gymName.trim() || null : null, gym_address: hasGym ? gymAddr.trim() || null : null,
        gym_photos: hasGym ? gymPhotos : [],
        monthly_price: monthlyPrice ? parseInt(monthlyPrice) : null,
        total_students: students ? parseInt(students) : 0,
        card_number: cardNumber.trim() || null,
        card_holder: cardHolder.trim() || null,
      };
      const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Xatolik");
      toast.success("Saqlandi!");
      const supabase = createClient();
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (p) useAuthStore.getState().setUser(p);
      if (isTrainer) { const { data: tp } = await supabase.from("trainer_profiles").select("*").eq("user_id", user.id).single(); if (tp) useAuthStore.getState().setTrainerProfile(tp); }
    } catch (e: any) { toast.error(e.message || "Xatolik"); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Profil rasmi */}
      <div className="card p-6">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Camera className="h-4 w-4 text-lime" />Profil rasmi</h3>
        <SettingsAvatar user={user} />
      </div>

      <div className="card p-6"><h3 className="font-semibold text-sm mb-4">Asosiy</h3><div className="space-y-4">
        <div><label className="block text-xs text-white/40 mb-2">Ism</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" /></div>
        <div><label className="block text-xs text-white/40 mb-2">Email</label><input value={user.email} disabled className="input-field opacity-50" /></div>
        <div><label className="block text-xs text-white/40 mb-2">Telefon</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998901234567" className="input-field" /></div>
      </div></div>

      {isTrainer && (<>
        <div className="card p-6"><h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Dumbbell className="h-4 w-4 text-lime" />Trener</h3><div className="space-y-4">
          <div><label className="block text-xs text-white/40 mb-2">Bio</label><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={500} className="input-field resize-none" /><p className="text-[10px] text-white/20 mt-1 text-right">{bio.length}/500</p></div>
          <div className="grid grid-cols-3 gap-4"><div><label className="block text-xs text-white/40 mb-2">Yosh</label><input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="input-field" /></div><div><label className="block text-xs text-white/40 mb-2">Tajriba (yil)</label><input type="number" value={exp} onChange={(e) => setExp(e.target.value)} className="input-field" /></div><div><label className="block text-xs text-white/40 mb-2">Shogirdlar soni</label><input type="number" value={students} onChange={(e) => setStudents(e.target.value)} className="input-field" placeholder="0" /></div></div>
          <div><label className="block text-xs text-white/40 mb-2">Yo'nalishlar ({specs.length}/5)</label><div className="flex flex-wrap gap-2">{SPECIALIZATIONS.map((s) => <button key={s.value} type="button" onClick={() => toggleSpec(s.value)} className={cn("px-3 py-1.5 rounded-full text-xs border", specs.includes(s.value) ? "border-lime bg-lime-muted text-lime" : "border-white/10 text-white/40")}>{s.label}</button>)}</div></div>
          <div><label className="block text-xs text-white/40 mb-2">Ish turi</label><div className="grid grid-cols-3 gap-2">{WORK_TYPES.map((w) => <button key={w.value} type="button" onClick={() => setWorkType(w.value)} className={cn("py-2.5 rounded-input border text-xs", workType === w.value ? "border-lime bg-lime-muted text-lime" : "border-white/10 text-white/40")}>{w.label}</button>)}</div></div>
        </div></div>

        <div className="card p-6"><h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><DollarSign className="h-4 w-4 text-lime" />Narx</h3><div className="space-y-4">
          <div><label className="block text-xs text-white/40 mb-2">Oylik mashq narxi (so'm)</label><input type="number" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} placeholder="500000" className="input-field" />{monthlyPrice && <p className="text-xs text-lime mt-1.5">{formatPrice(parseInt(monthlyPrice))}</p>}<p className="text-[10px] text-white/20 mt-1">Shaxsiy mashg'ulot oylik narxi</p></div>
        </div></div>

        <div className="card p-6">
          <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><CreditCard className="h-4 w-4 text-lime" />Pul olish uchun karta</h3>
          <p className="text-[10px] text-white/30 mb-4">Darsliklar sotilganda va pul yechganda shu kartaga tushadi</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/40 mb-2">Karta raqami (16 raqam)</label>
              <input type="text" value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))} placeholder="8600 1234 5678 9012" className="input-field font-mono" />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-2">Karta egasi</label>
              <input type="text" value={cardHolder} onChange={(e) => setCardHolder(e.target.value.toUpperCase())} placeholder="SARDOR MUHAMMEDOV" className="input-field uppercase" />
            </div>
          </div>
        </div>

        <div className="card p-6"><h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><MapPin className="h-4 w-4 text-lime" />Lokatsiya</h3><div className="space-y-4">
          <div><label className="block text-xs text-white/40 mb-2">Shahar</label><select value={city} onChange={(e) => setCity(e.target.value)} className="input-field"><option value="">Tanlang</option>{CITIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06]"><div><p className="text-sm">Zalingiz bormi?</p></div><button onClick={() => setHasGym(!hasGym)} className={cn("w-10 h-6 rounded-full relative", hasGym ? "bg-lime" : "bg-dark-card")}><div className={cn("w-4 h-4 bg-white rounded-full absolute top-1", hasGym ? "left-5" : "left-1")} /></button></div>
          {hasGym && (<div className="space-y-4 animate-fade-in">
            <div><label className="block text-xs text-white/40 mb-2">Zal nomi</label><input type="text" value={gymName} onChange={(e) => setGymName(e.target.value)} className="input-field" /></div>
            <div><label className="block text-xs text-white/40 mb-2">Manzil</label><input type="text" value={gymAddr} onChange={(e) => setGymAddr(e.target.value)} className="input-field" /></div>
            <div><label className="block text-xs text-white/40 mb-2">Zal rasmlari ({gymPhotos.length}/5)</label>
              <div className="grid grid-cols-5 gap-2">
                {gymPhotos.map((url, i) => (<div key={i} className="relative aspect-square rounded-lg overflow-hidden group"><img src={url} alt="" className="w-full h-full object-cover" /><button onClick={() => setGymPhotos((p) => p.filter((_, idx) => idx !== i))} className="absolute inset-0 bg-dark/70 opacity-0 group-hover:opacity-100 flex items-center justify-center"><Trash2 className="h-4 w-4 text-red-400" /></button></div>))}
                {gymPhotos.length < 5 && <button onClick={() => gymFileRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-white/10 hover:border-lime/30 flex items-center justify-center"><ImageIcon className="h-4 w-4 text-white/20" /></button>}
              </div>
              <input ref={gymFileRef} type="file" accept="image/*" onChange={handleGymPhoto} className="hidden" />
            </div>
          </div>)}
        </div></div>
      </>)}

      <button onClick={handleSave} disabled={saving} className="btn-lime flex items-center gap-2 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Saqlanmoqda..." : "Saqlash"}</button>
      <div className="card p-6 mt-4"><h3 className="font-semibold text-sm mb-3 text-red-400">Xavfli zona</h3><button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"><LogOut className="h-4 w-4" />Chiqish</button></div>
    </div>
  );
}

// Settings ichidagi avatar upload
function SettingsAvatar({ user }: { user: any }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(user.avatar_url || "");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("5MB dan katta"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "avatars");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Xatolik");
      const { url } = await res.json();
      await fetch("/api/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      });
      setPreview(url);
      useAuthStore.getState().setUser({ ...user, avatar_url: url });
      toast.success("Rasm yangilandi!");
    } catch (err) { toast.error("Xatolik"); } finally { setUploading(false); }
  };

  return (
    <div className="flex items-center gap-5">
      <div className="w-20 h-20 rounded-2xl bg-lime/20 flex items-center justify-center overflow-hidden ring-2 ring-white/[0.06]">
        {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl font-bold text-lime">{getInitials(user.full_name)}</span>}
      </div>
      <div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-lime/30 bg-lime-subtle text-lime text-xs hover:bg-lime/10 transition-colors disabled:opacity-50">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {uploading ? "Yuklanmoqda..." : "Rasm yuklash"}
        </button>
        <p className="text-[10px] text-white/20 mt-2">JPG, PNG · 5MB gacha</p>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </div>
  );
}
