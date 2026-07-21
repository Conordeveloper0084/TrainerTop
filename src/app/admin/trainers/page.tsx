"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Loader2, ArrowUpRight, MapPin, Phone, Calendar, CreditCard, Wallet, BookOpen, Star } from "lucide-react";
import { getInitials, formatPrice, cn } from "@/lib/utils";

export default function AdminTrainersPage() {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchTrainers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ role: "trainer" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/trainers?${params}`);
      if (res.ok) setTrainers(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(fetchTrainers, 400);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold mb-1">Trenerlar</h1>
        <p className="text-sm text-white/40">{trainers.length} ta trener</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ism yoki email bo'yicha qidiring..." className="input-field pl-9" />
      </div>

      {/* Ro'yxat */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>
      ) : trainers.length === 0 ? (
        <div className="card p-8 text-center"><p className="text-white/40 text-sm">Trener topilmadi</p></div>
      ) : (
        <div className="space-y-3">
          {trainers.map((t) => (
            <div key={t.id} className="card">
              <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} className="w-full p-4 flex items-center gap-3 text-left">
                <div className="w-12 h-12 rounded-full bg-dark-card flex items-center justify-center shrink-0 overflow-hidden">
                  {t.avatar_url ? <img src={t.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(t.full_name)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{t.full_name}</p>
                  <p className="text-xs text-white/40 truncate">{t.email}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-white/30">
                    {t.trainer_profile?.experience_years > 0 && <span>{t.trainer_profile.experience_years} yil tajriba</span>}
                    {t.trainer_profile?.city && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{t.trainer_profile.city}</span>}
                    {t.trainer_profile?.rating > 0 && <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 text-lime fill-lime" />{t.trainer_profile.rating}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-lime">{formatPrice(t.trainer_profile?.balance || 0)}</p>
                  <p className="text-[9px] text-white/30">balans</p>
                </div>
              </button>

              {expanded === t.id && (
                <div className="px-4 pb-4 pt-2 border-t border-white/[0.04] space-y-3 animate-fade-in-up">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Field label="Ro'yxatdan o'tdi" value={new Date(t.created_at).toLocaleDateString("uz-UZ")} icon={Calendar} />
                    <Field label="Telefon" value={t.phone || "Yo'q"} icon={Phone} />
                    <Field label="Yosh" value={t.trainer_profile?.age ? `${t.trainer_profile.age} yosh` : "Yo'q"} />
                    <Field label="Tajriba" value={`${t.trainer_profile?.experience_years || 0} yil`} />
                    <Field label="Shogirdlar" value={`${t.trainer_profile?.total_students || 0} ta`} />
                    <Field label="Sotuvlar" value={`${t.lessons_count || 0} darslik`} icon={BookOpen} />
                  </div>

                  {/* Karta */}
                  {t.trainer_profile?.card_number ? (
                    <div className="bg-lime/[0.04] border border-lime/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="h-3.5 w-3.5 text-lime" />
                        <p className="text-[10px] text-lime/70 font-semibold">Karta ma'lumotlari</p>
                      </div>
                      <p className="text-xs font-mono text-white/80">{t.trainer_profile.card_number}</p>
                      {t.trainer_profile.card_holder && <p className="text-[10px] text-white/40 mt-0.5">{t.trainer_profile.card_holder}</p>}
                    </div>
                  ) : (
                    <div className="bg-yellow-500/[0.04] border border-yellow-500/20 rounded-lg p-3">
                      <p className="text-[10px] text-yellow-500">⚠ Karta raqami kiritilmagan</p>
                    </div>
                  )}

                  {/* Daromad */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-dark-card rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Wallet className="h-3 w-3 text-lime" />
                        <p className="text-[9px] text-white/40">Hozirgi balans</p>
                      </div>
                      <p className="text-sm font-bold text-lime">{formatPrice(t.trainer_profile?.balance || 0)}</p>
                    </div>
                    <div className="bg-dark-card rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <BookOpen className="h-3 w-3 text-white/40" />
                        <p className="text-[9px] text-white/40">Jami daromad</p>
                      </div>
                      <p className="text-sm font-bold">{formatPrice(t.trainer_profile?.total_earned || 0)}</p>
                    </div>
                  </div>

                  <Link href={`/trainers/${t.id}`} target="_blank" className="flex items-center justify-center gap-2 w-full py-2 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg text-xs text-white/60 hover:text-white transition-colors">
                    Profilini ko'rish <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
