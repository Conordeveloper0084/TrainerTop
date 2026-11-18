"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

// Telegram orqali ochilgan akkauntga email + parol qo'shish: 1) POST /api/account/email/start (kod emailga yuboriladi)
// 2) POST /api/account/email/verify (kod to'g'ri bo'lsa email almashadi va parol o'rnatiladi).
const MESSAGES: Record<string, string> = {
  BAD_EMAIL: "Email noto'g'ri",
  EMAIL_TAKEN: "Bu email boshqa akkauntda band. Agar bu sizning akkauntingiz bo'lsa — shu email bilan kiring va u yerda «Kirish usullari → Telegram'ni ulash» ni bosing.",
  EMAIL_ALREADY_SET: "Akkauntingizda email allaqachon bor",
  EMAIL_NOT_CONFIGURED: "Email qo'shish hozircha mavjud emas",
  RATE_LIMITED: "Juda ko'p urinish. Keyinroq qayta urinib ko'ring",
  CODE_EXPIRED: "Kod eskirgan. Yangi kod so'rang",
  TOO_MANY_ATTEMPTS: "Juda ko'p noto'g'ri urinish. Yangi kod so'rang",
  NO_PENDING_REQUEST: "Avval kod so'rang",
  UNAUTHORIZED: "Seans tugagan. Qayta kiring",
};
const defaultReload = () => window.location.reload();

export default function EmailAddForm({ onCancel, onDone = defaultReload }: { onCancel: () => void; onDone?: () => void }) {
  const [step, setStep] = useState<"form" | "code" | "done">("form");
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [code, setCode] = useState("");
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [info, setInfo] = useState("");

  const call = async (url: string, body: any) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { res, d: (await res.json().catch(() => ({}))) as any };
  };
  const fail = (d: any, fallback: string) => setError(d.code === "BAD_CODE" ? `Kod noto'g'ri${typeof d.attempts_left === "number" ? ` (${d.attempts_left} ta urinish qoldi)` : ""}` : MESSAGES[d.code] || d.message || fallback);

  const sendCode = async () => {
    setBusy(true); setError(""); setInfo("");
    try {
      const { res, d } = await call("/api/account/email/start", { email: email.trim(), password });
      if (!res.ok) return fail(d, "Xatolik yuz berdi");
      setStep("code"); setInfo(`Kod ${d.email || email.trim()} manziliga yuborildi (10 daqiqa amal qiladi).`);
    } catch { setError("Aloqa xatosi. Qayta urinib ko'ring"); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError("");
    try {
      const { res, d } = await call("/api/account/email/verify", { email: email.trim(), code: code.trim() });
      if (!res.ok) return fail(d, "Xatolik yuz berdi");
      setStep("done"); setTimeout(onDone, 800);
    } catch { setError("Aloqa xatosi. Qayta urinib ko'ring"); } finally { setBusy(false); }
  };

  if (step === "done") return <p className="mt-3 text-sm text-lime" role="status" data-testid="email-done">✅ Email qo'shildi. Endi email va parol bilan ham kira olasiz.</p>;
  return (
    <div className="mt-3 space-y-3" data-testid="email-add-form">
      {step === "form" ? (
        <>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" autoComplete="email" className="input-field" data-testid="email-input" />
          <div className="relative">
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Yangi parol (kamida 6 ta belgi)" autoComplete="new-password" className="input-field pr-12" data-testid="password-input" />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={sendCode} disabled={busy || !email.trim() || password.length < 6} className="btn-lime !py-2 !px-4 text-sm flex items-center gap-2 disabled:opacity-50" data-testid="send-code">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Kod yuborish</button>
            <button type="button" onClick={onCancel} className="btn-outline !py-2 !px-4 text-sm" data-testid="email-cancel">Bekor qilish</button>
          </div>
        </>
      ) : (
        <>
          {info && <p className="text-xs text-white/50" data-testid="email-info">{info}</p>}
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6 xonali kod" className="input-field tracking-widest text-center" data-testid="code-input" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={verify} disabled={busy || code.length !== 6} className="btn-lime !py-2 !px-4 text-sm flex items-center gap-2 disabled:opacity-50" data-testid="verify-code">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Tasdiqlash</button>
            <button type="button" onClick={sendCode} disabled={busy} className="btn-outline !py-2 !px-4 text-sm" data-testid="resend-code">Kodni qayta yuborish</button>
            <button type="button" onClick={() => { setStep("form"); setCode(""); setError(""); setInfo(""); }} className="text-xs text-white/40 hover:text-white underline" data-testid="change-email">Emailni o'zgartirish</button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-300" role="alert" data-testid="email-error">{error}</p>}
    </div>
  );
}
