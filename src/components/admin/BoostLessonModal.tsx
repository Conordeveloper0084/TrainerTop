"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { AnnouncementCard } from "@/components/chat/AnnouncementCard";
import { BOOST_TEXT_MAX } from "@/lib/announcements";

const DEFAULT_BODY = "Yangi darslik — ko'rib chiqing";
const newToken = () => (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));

// Darslikni BOOST qilish: rasmiy TrainerTop kanalida hamma foydalanuvchiga darslik kartochkasi. Cheklov: 7 kunda 2 ta; bir darslik 30 kunda bir marta.
export function BoostLessonModal({ lesson, onClose, onDone }: { lesson: any; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState<{ used_7d: number; limit_7d: number; last_boost_at: string | null; cooldown_days: number } | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const token = useRef(newToken());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/lessons/${lesson.id}/boost`);
        if (!alive) return;
        if (res.ok) setStatus(await res.json()); else setStatusFailed(true);
      } catch { if (alive) setStatusFailed(true); }
    })();
    return () => { alive = false; };
  }, [lesson.id]);

  const limitReached = !!status && status.used_7d >= status.limit_7d;
  const recent = !!status?.last_boost_at && Date.now() - new Date(status.last_boost_at).getTime() < status.cooldown_days * 86400000;
  const canSend = !!status && !limitReached && !recent && !sending;
  const trainerName = lesson.is_platform ? "TrainerTop" : lesson.profiles?.full_name || "Trener";

  const send = async () => {
    if (!canSend) return;
    const ask = `«${lesson.title}» darsligi hamma foydalanuvchining rasmiy kanalida ko'rsatiladi${lesson.is_platform ? "" : `, trenerga (${trainerName}) qo'ng'iroqchada xabar boradi`}. Davom etasizmi?`;
    if (!window.confirm(ask)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/lessons/${lesson.id}/boost`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.trim() || undefined, client_token: token.current }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Boost qilinmadi"); return; }
      toast.success(d.duplicate ? "Bu boost allaqachon qilingan" : "Boost qilindi");
      onDone();
    } catch { toast.error("Boost qilinmadi"); } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-label="Darslikni boost qilish">
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-sm flex items-center gap-2"><Rocket className="h-4 w-4 text-lime" />Darslikni boost qilish</h2>
          <button onClick={onClose} aria-label="Yopish" className="text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-xs text-white/40">Darslik rasmiy «TrainerTop» kanalida <b className="text-white/70">hamma</b> foydalanuvchiga kartochka bo'lib chiqadi.</p>

          {!status && !statusFailed && <div className="text-center py-2"><Loader2 className="h-4 w-4 animate-spin text-lime mx-auto" /></div>}
          {statusFailed && <p className="text-xs text-red-400">Boost holatini yuklab bo'lmadi. Sahifani yangilang.</p>}
          {status && <p className="text-[11px] text-white/50" data-testid="boost-usage">Oxirgi 7 kunda: {status.used_7d}/{status.limit_7d} boost ishlatilgan</p>}
          {limitReached && <p className="text-xs text-yellow-500 bg-yellow-500/[0.07] rounded-lg p-2.5" data-testid="boost-limit">7 kunlik limit tugagan: reklama charchamasligi uchun ko'pi bilan {status!.limit_7d} ta boost. Keyinroq urinib ko'ring.</p>}
          {recent && !limitReached && <p className="text-xs text-yellow-500 bg-yellow-500/[0.07] rounded-lg p-2.5" data-testid="boost-recent">Bu darslik {new Date(status!.last_boost_at!).toLocaleDateString("uz-UZ")} da boost qilingan. Bir darslikni {status!.cooldown_days} kunda bir marta boost qilish mumkin.</p>}

          <div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={BOOST_TEXT_MAX} rows={3} aria-label="Qisqa matn" placeholder={`Qisqa matn (ixtiyoriy). Bo'sh qolsa: «${DEFAULT_BODY}»`} className="input-field text-sm resize-none" />
            <p className="text-[10px] text-white/30 text-right mt-0.5">{text.length}/{BOOST_TEXT_MAX}</p>
          </div>

          <div>
            <p className="text-[11px] text-white/30 mb-2">Foydalanuvchida shunday ko'rinadi:</p>
            <AnnouncementCard preview item={{
              kind: "all", title: lesson.title, body: text.trim() || DEFAULT_BODY, image_url: null, link_url: `/lessons/${lesson.id}`, link_label: "Darslikni ko'rish", created_at: new Date().toISOString(),
              lesson: { id: lesson.id, title: lesson.title, cover_image_url: lesson.cover_image_url || null, price: lesson.price, price_lifetime: lesson.price_lifetime, price_monthly: lesson.price_monthly, pricing_model: lesson.pricing_model, trainer_name: trainerName },
            }} />
          </div>

          <button onClick={send} disabled={!canSend} className="btn-lime w-full !py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-40">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}Hammaga boost qilish
          </button>
        </div>
      </div>
    </div>
  );
}
