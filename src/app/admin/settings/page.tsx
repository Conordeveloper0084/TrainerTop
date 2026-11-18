"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Percent, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AthleteBadge } from "@/components/ui/AthleteBadge";
import { formatPrice } from "@/lib/utils";

interface Rule { min: number; max: number; integer: boolean; label: string }

const FIELDS: { key: string; label: string; hint: string; suffix?: string; step?: number }[] = [
  { key: "default_commission_percent", label: "Umumiy komissiya", hint: "Maxsus foizi belgilanmagan barcha trenerlar uchun. Faqat KEYINGI sotuvlarga ta'sir qiladi.", suffix: "%", step: 0.5 },
  { key: "min_payout_amount", label: "Minimal yechish summasi", hint: "Trener bir so'rovda kamida shuncha yecha oladi.", suffix: "so'm", step: 1000 },
  { key: "badge_min_followers", label: "Nishon: obunachilar soni", hint: "Avtomatik nishon uchun kamida shuncha obunachi (platformadagi).", step: 1 },
  { key: "badge_min_rating", label: "Nishon: minimal reyting", hint: "O'rtacha baho (1–5). Tavsiya: 4.5", step: 0.1 },
  { key: "badge_min_reviews", label: "Nishon: minimal sharhlar soni", hint: "Reyting ishonchli bo'lishi uchun kamida shuncha sharh. Tavsiya: 10", step: 1 },
  { key: "athlete_badge_min_followers", label: "Atlet nishoni: obunachilar soni", hint: "Oddiy foydalanuvchi (atlet) shuncha obunachiga yetganda \"TrainerTop Athlete\" nishoni avtomatik beriladi. Tavsiya: 5000", step: 1 },
];

export default function AdminSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<Record<string, Rule>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (!res.ok) throw new Error();
        const d = await res.json();
        const v: Record<string, string> = {};
        for (const [k, n] of Object.entries(d.values as Record<string, number>)) v[k] = String(n);
        setValues(v); setInitial(v); setRules(d.rules || {});
      } catch { toast.error("Sozlamalarni yuklab bo'lmadi"); } finally { setLoading(false); }
    })();
  }, []);

  const changed = Object.keys(values).filter((k) => values[k] !== initial[k]);

  const validate = (): string | null => {
    for (const k of changed) {
      const r = rules[k]; const n = Number(values[k]);
      if (!r) continue;
      if (values[k].trim() === "" || !Number.isFinite(n) || n < r.min || n > r.max || (r.integer && !Number.isInteger(n))) {
        return `${r.label}: ${r.min} dan ${r.max} gacha${r.integer ? " (butun son)" : ""} bo'lishi kerak`;
      }
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const body: Record<string, number> = {};
      for (const k of changed) body[k] = Number(values[k]);
      const res = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Xatolik");
      toast.success("Saqlandi");
      setInitial({ ...values });
    } catch (e: any) { toast.error(e.message || "Xatolik"); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;

  const f = Number(values.badge_min_followers), r = Number(values.badge_min_rating), rv = Number(values.badge_min_reviews);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold mb-1">Sozlamalar</h1>
        <p className="text-sm text-white/40">Komissiya, yechish va nishon qoidalari. O'zgarish darhol kuchga kiradi — kodni qayta yuklash shart emas.</p>
      </div>

      <div className="card p-5 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold"><Percent className="h-4 w-4 text-lime" />Komissiya</div>
        <Field {...FIELDS[0]} value={values[FIELDS[0].key] ?? ""} onChange={(v) => setValues({ ...values, [FIELDS[0].key]: v })} />
        <p className="text-[11px] text-white/40">Alohida trener uchun foizni "Trenerlar" sahifasidan o'zgartirasiz (masalan, birinchi athlet trenerlar uchun 0%).</p>
      </div>

      <div className="card p-5 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4 text-lime" />Pul yechish</div>
        <Field {...FIELDS[1]} value={values[FIELDS[1].key] ?? ""} onChange={(v) => setValues({ ...values, [FIELDS[1].key]: v })} />
      </div>

      <div className="card p-5 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold"><AthleteBadge size={18} kind="athlete" />TrainerTop Athlete nishoni — atletlar uchun (avtomatik)</div>
        {FIELDS.slice(5).map((fd) => (
          <Field key={fd.key} {...fd} value={values[fd.key] ?? ""} onChange={(v) => setValues({ ...values, [fd.key]: v })} />
        ))}
        <p className="text-[11px] text-white/40">Faqat oddiy foydalanuvchilarga. Nishon faqat BERILADI; olib tashlash — Foydalanuvchilar bo'limida admin qo'lida.</p>
      </div>

      <div className="card p-5 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold"><AthleteBadge size={18} />TrainerTop Trener nishoni — trenerlar uchun (avtomatik)</div>
        {FIELDS.slice(2, 5).map((fd) => (
          <Field key={fd.key} {...fd} value={values[fd.key] ?? ""} onChange={(v) => setValues({ ...values, [fd.key]: v })} />
        ))}
        <div className="bg-lime/[0.04] border border-lime/20 rounded-lg p-3">
          <p className="text-[11px] text-white/70 leading-relaxed">
            Trener quyidagilarning <span className="text-lime font-semibold">hammasiga</span> javob bersa nishon avtomatik beriladi:{" "}
            kamida <b>{f.toLocaleString("en-US")}</b> obunachi, reyting <b>{r}+</b>, kamida <b>{rv}</b> ta sharh.
          </p>
          <p className="text-[10px] text-white/40 mt-1.5">Avtomatik nishon faqat beriladi — uni faqat siz olib tashlay olasiz. O'zingiz taklif qilgan trenerlarga "Trenerlar" sahifasidan qo'lda berasiz. Chegara o'zgargach, mos trenerlar darhol tekshiriladi.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving || changed.length === 0} className="btn-lime !py-2.5 !px-6 text-sm flex items-center gap-2 disabled:opacity-30">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Saqlash
        </button>
        {changed.length > 0 && <span className="text-[11px] text-white/40">{changed.length} ta o'zgarish saqlanmagan</span>}
      </div>
      {values.min_payout_amount && <p className="text-[10px] text-white/25">Hozirgi minimal yechish: {formatPrice(Number(initial.min_payout_amount || 0))}</p>}
    </div>
  );
}

function Field({ label, hint, suffix, step, value, onChange }: { label: string; hint: string; suffix?: string; step?: number; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-white/70 mb-1.5">{label}</label>
      <div className="flex items-center gap-2 max-w-xs">
        <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} className="input-field" />
        {suffix && <span className="text-xs text-white/40 shrink-0">{suffix}</span>}
      </div>
      <p className="text-[10px] text-white/30 mt-1.5">{hint}</p>
    </div>
  );
}
