"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Loader2, ArrowUpRight, MapPin, Phone, Calendar, Wallet, BookOpen, Star, Percent, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { getInitials, formatPrice, cn } from "@/lib/utils";
import { AthleteBadge } from "@/components/ui/AthleteBadge";

const BADGE_SOURCE_LABEL: Record<string, string> = {
  auto: "Avtomatik berilgan",
  admin: "Admin bergan",
  revoked: "Admin olib tashlagan",
};

export default function AdminTrainersPage() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [commissionFor, setCommissionFor] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchTrainers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/trainers?${params}`);
      if (res.ok) setTrainers(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(fetchTrainers, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const badgeAction = async (t: any, action: "grant" | "revoke" | "auto") => {
    const texts = {
      grant: `${t.full_name} ga "TrainerTop Trener" nishonini berasizmi? (Obunachi soniga qaramay, doimiy beriladi)`,
      revoke: `${t.full_name} dan nishonni olib tashlaysizmi? Avtomatik qayta berilmaydi.`,
      auto: `${t.full_name} nishonini avtomatik qoidaga qaytarasizmi? Shartlarga mos bo'lsa nishon beriladi, aks holda olinadi.`,
    };
    if (!confirm(texts[action])) return;
    setBusy(t.id);
    try {
      const res = await fetch(`/api/admin/trainers/${t.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ badge: action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Xatolik");
      toast.success(action === "grant" ? "Nishon berildi" : action === "revoke" ? "Nishon olib tashlandi" : "Avtomatik qoidaga qaytarildi");
      fetchTrainers();
    } catch (e: any) { toast.error(e.message || "Xatolik"); } finally { setBusy(null); }
  };

  const [blurbDraft, setBlurbDraft] = useState<Record<string, string>>({});
  const featuredList = trainers.filter((x) => x.trainer_profile?.is_featured_home).sort((a, b) => (a.trainer_profile.featured_order || 0) - (b.trainer_profile.featured_order || 0));

  const featuredAction = async (t: any, action: "add" | "remove" | "blurb") => {
    setBusy(t.id);
    try {
      const res = await fetch(`/api/admin/trainers/${t.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ featured: action, featured_blurb: blurbDraft[t.id] ?? t.trainer_profile?.featured_blurb ?? null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Xatolik");
      toast.success(action === "add" ? "Bosh sahifaga qo'shildi" : action === "remove" ? "Bosh sahifadan olib tashlandi" : "Matn saqlandi");
      fetchTrainers();
    } catch (e: any) { toast.error(e.message || "Xatolik"); } finally { setBusy(null); }
  };

  const reorderFeatured = async (a: string, b: string) => {
    try {
      const res = await fetch("/api/admin/trainers/featured-reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainer_a: a, trainer_b: b }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Xatolik"); return; }
      fetchTrainers();
    } catch { toast.error("Xatolik"); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold mb-1">Trenerlar</h1>
        <p className="text-sm text-white/40">{trainers.length} ta trener</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ism yoki email bo'yicha qidiring..." className="input-field pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>
      ) : trainers.length === 0 ? (
        <div className="card p-8 text-center"><p className="text-white/40 text-sm">Trener topilmadi</p></div>
      ) : (
        <div className="space-y-3">
          {trainers.map((t) => {
            const tp = t.trainer_profile || {};
            const isOpen = expanded === t.id;
            const customRate = tp.commission_rate !== null && tp.commission_rate !== undefined;
            return (
              <div key={t.id} className="card">
                <button onClick={() => setExpanded(isOpen ? null : t.id)} className="w-full p-4 flex items-center gap-3 text-left">
                  <div className="w-12 h-12 rounded-full bg-dark-card flex items-center justify-center shrink-0 overflow-hidden">
                    {t.avatar_url ? <img src={t.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(t.full_name)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                      <span className="truncate">{t.full_name}</span>
                      {tp.is_verified && <AthleteBadge size={16} />}
                      {t.is_banned && <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full font-semibold shrink-0">BAN</span>}
                    </p>
                    <p className="text-xs text-white/40 truncate">{t.email}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-white/30">
                      {tp.rating > 0 && <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 text-lime fill-lime" />{Number(tp.rating).toFixed(1)}</span>}
                      <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{tp.followers_count || 0}</span>
                      <span className={cn("flex items-center gap-0.5", customRate && "text-lime")}>
                        <Percent className="h-2.5 w-2.5" />{t.effective_commission}%{customRate ? " (maxsus)" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-lime">{formatPrice(tp.balance || 0)}</p>
                    <p className="text-[9px] text-white/30">balans</p>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-2 border-t border-white/[0.04] space-y-4 animate-fade-in-up">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <Field label="Ro'yxatdan o'tdi" value={new Date(t.created_at).toLocaleDateString("uz-UZ")} icon={Calendar} />
                      <Field label="Telefon" value={t.phone || "Yo'q"} icon={Phone} />
                      <Field label="Shahar" value={tp.city || "Yo'q"} icon={MapPin} />
                      <Field label="Tajriba" value={`${tp.experience_years || 0} yil`} />
                      <Field label="Shogirdlar" value={`${tp.total_students || 0} ta (o'zi kiritgan: ${tp.manual_students || 0})`} />
                      <Field label="Darsliklar" value={`${t.lessons_count || 0} ta`} icon={BookOpen} />
                      <Field label="Obunachilar" value={`${tp.followers_count || 0}`} />
                      <Field label="Sharhlar" value={`${tp.total_reviews || 0} ta`} />
                    </div>

                    {/* Moliya */}
                    <div className="grid grid-cols-3 gap-2">
                      <Money icon={Wallet} label="Balans" value={tp.balance || 0} accent />
                      <Money icon={Clock} label="Kutilmoqda" value={t.pending_payout || 0} />
                      <Money icon={BookOpen} label="Jami sof daromad" value={tp.total_earned || 0} />
                    </div>

                    {/* Komissiya */}
                    <div className="bg-dark-card rounded-xl p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Platforma komissiyasi</p>
                          <p className="text-xl font-bold">
                            {t.effective_commission}%
                            <span className="text-[11px] font-normal text-white/40 ml-2">
                              {customRate ? "maxsus foiz" : `umumiy foiz (${t.default_commission}%)`}
                            </span>
                          </p>
                        </div>
                        <button onClick={() => setCommissionFor(t)} className="btn-outline !py-2 !px-4 text-xs shrink-0">O'zgartirish</button>
                      </div>
                    </div>

                    {/* Nishon */}
                    <div className="bg-dark-card rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {tp.is_verified ? <AthleteBadge size={26} /> : <div className="w-[26px] h-[26px] rounded-md border border-dashed border-white/15" />}
                        <div>
                          <p className="text-sm font-semibold">{tp.is_verified ? "TrainerTop Trener" : "Nishon yo'q"}</p>
                          <p className="text-[10px] text-white/40">{tp.badge_source ? BADGE_SOURCE_LABEL[tp.badge_source] : "Avtomatik qoida bo'yicha kutilmoqda"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!tp.is_verified && <button disabled={busy === t.id} onClick={() => badgeAction(t, "grant")} className="btn-lime !py-2 !px-4 text-xs disabled:opacity-40">Nishon berish</button>}
                        {tp.is_verified && <button disabled={busy === t.id} onClick={() => badgeAction(t, "revoke")} className="px-4 py-2 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40">Nishonni olib tashlash</button>}
                        {tp.badge_source && <button disabled={busy === t.id} onClick={() => badgeAction(t, "auto")} className="btn-outline !py-2 !px-4 text-xs disabled:opacity-40">Avtomatikka qaytarish</button>}
                      </div>
                    </div>

                    {/* Bosh sahifa "Top trenerlar" */}
                    <div className="bg-dark-card rounded-xl p-4" data-testid="featured-section">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-sm font-semibold">Bosh sahifada ko'rsatish</p>
                        {tp.is_featured_home
                          ? <button disabled={busy === t.id} onClick={() => featuredAction(t, "remove")} className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40">Olib tashlash</button>
                          : <button disabled={busy === t.id} onClick={() => featuredAction(t, "add")} className="btn-lime !py-1.5 !px-3 text-xs disabled:opacity-40">Qo'shish</button>}
                      </div>
                      {tp.is_featured_home && (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <input value={blurbDraft[t.id] ?? tp.featured_blurb ?? ""} onChange={(e) => setBlurbDraft((p) => ({ ...p, [t.id]: e.target.value }))} maxLength={120}
                              placeholder="Qo'shimcha matn (ixtiyoriy, masalan: yo'nalish tavsifi)" aria-label="Qo'shimcha matn" className="input-field !py-2 text-xs flex-1" />
                            <button disabled={busy === t.id} onClick={() => featuredAction(t, "blurb")} className="btn-outline !py-2 !px-3 text-xs shrink-0">Saqlash</button>
                          </div>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const pos = featuredList.findIndex((x) => x.id === t.id);
                              const prev = pos > 0 ? featuredList[pos - 1] : null;
                              const next = pos >= 0 && pos < featuredList.length - 1 ? featuredList[pos + 1] : null;
                              return (
                                <>
                                  <button disabled={!prev} onClick={() => prev && reorderFeatured(t.id, prev.id)} aria-label="Yuqoriga" className="px-3 py-1.5 rounded-lg text-xs border border-white/[0.08] text-white/50 hover:bg-white/5 disabled:opacity-30">↑</button>
                                  <button disabled={!next} onClick={() => next && reorderFeatured(t.id, next.id)} aria-label="Pastga" className="px-3 py-1.5 rounded-lg text-xs border border-white/[0.08] text-white/50 hover:bg-white/5 disabled:opacity-30">↓</button>
                                  <span className="text-[10px] text-white/30">Tartib: {pos + 1}/{featuredList.length}</span>
                                </>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </div>

                    <Link href={`/trainers/${t.id}`} target="_blank" className="flex items-center justify-center gap-2 w-full py-2 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg text-xs text-white/60 hover:text-white transition-colors">
                      Profilini ko'rish <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {commissionFor && (
        <CommissionModal
          trainer={commissionFor}
          onClose={() => setCommissionFor(null)}
          onDone={() => { setCommissionFor(null); fetchTrainers(); }}
        />
      )}
    </div>
  );
}

function CommissionModal({ trainer, onClose, onDone }: { trainer: any; onClose: () => void; onDone: () => void }) {
  const current = trainer.effective_commission as number;
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const num = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(num) && num >= 0 && num <= 100;
  const hasCustom = trainer.trainer_profile?.commission_rate !== null && trainer.trainer_profile?.commission_rate !== undefined;

  const save = async (rate: number | null) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/trainers/${trainer.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commission_rate: rate }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Xatolik");
      toast.success(rate === null ? "Umumiy foizga qaytarildi" : `Komissiya ${rate}% qilindi`);
      onDone();
    } catch (e: any) { toast.error(e.message || "Xatolik"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-base font-bold mb-1">Komissiya foizi</h2>
          <p className="text-xs text-white/40 mb-5">{trainer.full_name}</p>

          <label className="block text-xs text-white/60 mb-2">Platforma oladigan foiz (0–100)</label>
          <div className="flex items-center gap-2 mb-3">
            <input type="number" min={0} max={100} step={0.5} value={value} onChange={(e) => setValue(e.target.value)} className="input-field text-lg font-bold" autoFocus />
            <span className="text-lg text-white/40">%</span>
          </div>
          <div className="flex gap-2 mb-4">
            {[0, 5, 10].map((p) => (
              <button key={p} onClick={() => setValue(String(p))} className={cn("px-3 py-1.5 rounded-lg text-xs border", Number(value) === p ? "border-lime bg-lime-muted text-lime" : "border-white/10 text-white/50 hover:bg-white/5")}>{p}%</button>
            ))}
          </div>

          <div className="bg-lime/[0.04] border border-lime/20 rounded-lg p-3 mb-4">
            <p className="text-[11px] text-white/70 leading-relaxed">
              {valid ? (
                <>100 000 so'mlik sotuvdan trenerga <span className="text-lime font-semibold">{formatPrice(100000 - Math.round((100000 * num) / 100))}</span> tushadi, platformaga {formatPrice(Math.round((100000 * num) / 100))}.</>
              ) : "0 dan 100 gacha son kiriting"}
            </p>
            <p className="text-[10px] text-white/40 mt-1.5">Faqat KEYINGI sotuvlarga ta'sir qiladi — oldingi sotuvlar o'zgarmaydi. Trenerga xabar boradi.</p>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="btn-outline flex-1 !py-2.5 text-sm">Bekor qilish</button>
            <button onClick={() => save(Math.round(num * 100) / 100)} disabled={saving || !valid || (hasCustom && num === current)} className="btn-lime flex-1 !py-2.5 text-sm disabled:opacity-30">
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
          {hasCustom && (
            <button onClick={() => save(null)} disabled={saving} className="w-full mt-3 text-[11px] text-white/40 hover:text-lime">
              Maxsus foizni olib tashlash (umumiy {trainer.default_commission}% ga qaytarish)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, icon: Icon }: any) {
  return (
    <div>
      <div className="flex items-center gap-1 text-white/30 mb-0.5">
        {Icon && <Icon className="h-2.5 w-2.5" />}
        <span className="text-[9px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xs text-white/80">{value}</p>
    </div>
  );
}

function Money({ icon: Icon, label, value, accent }: any) {
  return (
    <div className="bg-dark-card rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("h-3 w-3", accent ? "text-lime" : "text-white/40")} />
        <p className="text-[9px] text-white/40">{label}</p>
      </div>
      <p className={cn("text-xs font-bold", accent && "text-lime")}>{formatPrice(value)}</p>
    </div>
  );
}
