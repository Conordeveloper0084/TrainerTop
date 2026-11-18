"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, Phone } from "lucide-react";
import { PlaneIcon, TG_BLUE } from "@/components/auth/telegram-shared";
import TelegramLinkPanel from "@/components/profile/TelegramLinkPanel";
import EmailAddForm from "@/components/profile/EmailAddForm";

// Profil → Sozlamalar → "Kirish usullari": Telegram (Ulangan / Ulash / Uzish) va Email (manzil / Email qo'shish).
// Ma'lumot: GET /api/profile → login_methods. Sintetik email HECH QACHON ko'rinmaydi.
interface Methods { telegram: { linked: boolean; username: string | null; can_unlink: boolean }; email: { set: boolean; address: string | null }; phone?: { verified: boolean; masked: string | null } }
const defaultConfirm = (m: string) => window.confirm(m);

export default function LoginMethods({ confirmFn = defaultConfirm, onEmailAdded, navigate }: { confirmFn?: (message: string) => boolean; onEmailAdded?: () => void; navigate?: (url: string) => void }) {
  const [methods, setMethods] = useState<Methods | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [panel, setPanel] = useState<"none" | "link" | "email">("none");
  const [note, setNote] = useState(""), [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" }); const d: any = await res.json().catch(() => ({}));
      if (!res.ok || !d.login_methods) throw new Error("x");
      setMethods(d.login_methods); setLoadError(false);
    } catch { setLoadError(true); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const unlink = async () => {
    if (!confirmFn("Telegram'ni akkauntdan uzmoqchimisiz? Keyin Telegram orqali bu akkauntga kira olmaysiz.")) return;
    setBusy(true); setNote("");
    try {
      const res = await fetch("/api/auth/telegram/link", { method: "DELETE" }); const d: any = await res.json().catch(() => ({}));
      if (!res.ok) setNote(d.message || "Xatolik yuz berdi"); else { setNote("Telegram uzildi."); await refresh(); }
    } catch { setNote("Aloqa xatosi. Qayta urinib ko'ring"); } finally { setBusy(false); }
  };

  return (
    <div className="card p-6" id="login-methods" data-testid="login-methods">
      <h3 className="font-semibold text-sm mb-4">Kirish usullari</h3>
      {!methods && !loadError && <p className="text-sm text-white/40 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Yuklanmoqda…</p>}
      {loadError && <p className="text-sm text-red-300" data-testid="lm-error">Yuklab bo'lmadi. <button type="button" className="underline" onClick={refresh}>Qayta urinish</button></p>}
      {methods && (
        <div className="space-y-5">
          {/* Telefon (asosiy identifikator): faqat maskalangan ko'rinish — raqamning o'zi boshqalarga ko'rsatilmaydi */}
          <div data-testid="lm-phone">
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-9 w-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center"><Phone className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="text-sm font-medium flex items-center gap-2">Telefon{methods.phone?.verified && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lime-muted text-lime font-semibold" data-testid="lm-phone-badge">Tasdiqlangan</span>}</p>
                <p className="text-xs text-white/50 truncate" data-testid="lm-phone-status">{methods.phone?.verified && methods.phone.masked ? methods.phone.masked : "Raqam ulanmagan"}</p>
              </div>
            </div>
            {!methods.phone?.verified && <p className="text-xs text-white/40 mt-2" data-testid="lm-phone-hint">Raqamni ulash uchun Telegram orqali kiring (botda «📱 Raqamni ulashish») yoki Telegram'ni shu akkauntga ulang.</p>}
          </div>

          {/* Telegram */}
          <div data-testid="lm-telegram">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center" style={{ backgroundColor: TG_BLUE, color: "#fff" }}><PlaneIcon size={18} /></span>
                <div className="min-w-0"><p className="text-sm font-medium">Telegram</p>
                  <p className="text-xs text-white/50 truncate" data-testid="lm-tg-status">{methods.telegram.linked ? `${methods.telegram.username ? "@" + methods.telegram.username + " · " : ""}Ulangan` : "Ulanmagan"}</p></div>
              </div>
              {methods.telegram.linked ? (
                <button type="button" onClick={unlink} disabled={busy || !methods.telegram.can_unlink} title={methods.telegram.can_unlink ? undefined : "Avval email qo'shing — Telegram hozir yagona kirish usuli"} className="btn-outline !py-1.5 !px-3 text-xs disabled:opacity-40" data-testid="lm-unlink">Uzish</button>
              ) : (
                <button type="button" onClick={() => { setPanel(panel === "link" ? "none" : "link"); setNote(""); }} className="btn-lime !py-1.5 !px-3 text-xs" data-testid="lm-link">Ulash</button>
              )}
            </div>
            {methods.telegram.linked && !methods.telegram.can_unlink && <p className="text-xs text-white/40 mt-2" data-testid="lm-tg-hint">Telegram hozir akkauntingizdagi yagona kirish usuli. Uzish uchun avval email qo'shing.</p>}
            {panel === "link" && <TelegramLinkPanel navigate={navigate} onLinked={() => { refresh(); }} onClose={() => { setPanel("none"); refresh(); }} />}
          </div>

          {/* Email */}
          <div data-testid="lm-email">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-9 w-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center"><Mail className="h-4 w-4" /></span>
                <div className="min-w-0"><p className="text-sm font-medium">Email</p><p className="text-xs text-white/50 truncate" data-testid="lm-email-status">{methods.email.set ? methods.email.address : "Qo'shilmagan"}</p></div>
              </div>
              {!methods.email.set && <button type="button" onClick={() => { setPanel(panel === "email" ? "none" : "email"); setNote(""); }} className="btn-lime !py-1.5 !px-3 text-xs" data-testid="lm-email-add">Email qo'shish</button>}
            </div>
            {panel === "email" && !methods.email.set && <EmailAddForm onCancel={() => setPanel("none")} onDone={onEmailAdded} />}
          </div>
          {note && <p className="text-xs text-white/60" role="status" data-testid="lm-note">{note}</p>}
        </div>
      )}
    </div>
  );
}
