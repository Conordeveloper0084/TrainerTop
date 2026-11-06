"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

// "Telegram orqali kirish" (birinchi, katta ko'k tugma). Oqim: POST /api/auth/telegram/start → telefonda tg:// havola ochiladi,
// kompyuterda QR kod + havola ko'rsatiladi → har 2 s GET /api/auth/telegram/status → tasdiqlangach sessiya
// supabase.auth.setSession bilan import qilinadi (boshqa kirish usullari bilan bir xil). Format: docs/telegram-login.md
// Ranglar inline: light mode'dagi global CSS override'lar tegmasin.

type Phase = "idle" | "starting" | "waiting" | "success" | "expired" | "cancelled" | "banned" | "error";
interface Started { login_id: string; poll_secret: string; expires_at: string; poll_interval_ms?: number; bot_url: string; tg_url: string }

const TG_BLUE = "#229ED9";
const MAX_NET_FAILS = 5;        // ketma-ket tarmoq xatosi — shundan keyin to'xtaymiz
const MAX_SESSION_RETRIES = 3;  // SESSION_FAILED (503) — server so'rovni qayta olishga qaytaradi

function deviceId(): string | undefined {
  try {
    let id = localStorage.getItem("tt_device_id");
    if (!id) { id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`) + "-web"; localStorage.setItem("tt_device_id", id); }
    return id;
  } catch { return undefined; }
}

function PlaneIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

const defaultNavigate = (url: string) => { window.location.href = url; };

// `navigate` — sahifani almashtirish (kirishdan keyingi yo'naltirish va telefonda tg:// ochish); testlar uchun almashtirilishi mumkin
export default function TelegramLoginButton({ redirect = "/", label = "Telegram orqali kirish", navigate = defaultNavigate }: { redirect?: string; label?: string; navigate?: (url: string) => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [started, setStarted] = useState<Started | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runId = useRef(0);   // eski (bekor qilingan) polling natijasini e'tiborsiz qoldirish uchun

  useEffect(() => { setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)); alive.current = true; return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);

  // Qolgan vaqt hisoblagichi
  useEffect(() => {
    if (phase !== "waiting" || !started) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((Date.parse(started.expires_at) - Date.now()) / 1000)));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [phase, started]);

  const stop = useCallback(() => { runId.current++; if (timer.current) clearTimeout(timer.current); }, []);
  const fail = useCallback((p: Phase, msg = "") => { stop(); if (alive.current) { setPhase(p); setErrorMsg(msg); } }, [stop]);

  const poll = useCallback((s: Started, id: number, fails = 0, sessionRetries = 0) => {
    const delay = s.poll_interval_ms ?? 2000;
    timer.current = setTimeout(async () => {
      if (!alive.current || id !== runId.current) return;
      if (Date.now() > Date.parse(s.expires_at) + 5000) return fail("expired");
      try {
        const res = await fetch(`/api/auth/telegram/status?login_id=${encodeURIComponent(s.login_id)}&poll_secret=${encodeURIComponent(s.poll_secret)}`, { cache: "no-store" });
        if (!alive.current || id !== runId.current) return;
        const d: any = await res.json().catch(() => ({}));
        if (res.status === 403 && d.code === "ACCOUNT_BANNED") return fail("banned", d.message || "");
        if (res.status === 503 && d.code === "SESSION_FAILED") {
          if (sessionRetries + 1 >= MAX_SESSION_RETRIES) return fail("error", "Sessiya yaratib bo'lmadi. Qayta urinib ko'ring");
          return poll(s, id, 0, sessionRetries + 1);
        }
        if (!res.ok) return fail("error", d.message || "Xatolik yuz berdi. Qayta urinib ko'ring");
        if (d.status === "pending") return poll(s, id, 0, sessionRetries);
        if (d.status === "expired") return fail("expired");
        if (d.status === "cancelled") return fail("cancelled");
        if (d.status === "consumed") return fail("error", "Bu so'rov allaqachon ishlatilgan. Qayta urinib ko'ring");
        if (d.status === "confirmed" && d.access_token && d.refresh_token) {
          const { error } = await createClient().auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
          if (error) return fail("error", "Kirishni yakunlab bo'lmadi. Qayta urinib ko'ring");
          stop(); if (alive.current) setPhase("success");
          toast.success("Muvaffaqiyatli kirdingiz!");
          setTimeout(() => navigate(redirect), 400);
          return;
        }
        return fail("error", "Kutilmagan javob. Qayta urinib ko'ring");
      } catch {
        if (!alive.current || id !== runId.current) return;
        if (fails + 1 >= MAX_NET_FAILS) return fail("error", "Aloqa uzildi. Internetni tekshirib, qayta urinib ko'ring");
        poll(s, id, fails + 1, sessionRetries);
      }
    }, delay);
  }, [fail, navigate, redirect, stop]);

  const start = useCallback(async () => {
    stop(); setPhase("starting"); setErrorMsg(""); setQr(null);
    const id = ++runId.current;
    try {
      const res = await fetch("/api/auth/telegram/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: "web", device_id: deviceId() }) });
      const d: any = await res.json().catch(() => ({}));
      if (id !== runId.current || !alive.current) return;
      if (!res.ok) return fail("error", res.status === 429 ? "Juda ko'p urinish. Bir necha daqiqadan keyin qayta urinib ko'ring" : res.status === 503 ? "Telegram orqali kirish hozircha mavjud emas. Email bilan kiring" : d.message || "Xatolik yuz berdi");
      const s: Started = d; setStarted(s); setPhase("waiting");
      // Kompyuterda QR; telefonda Telegram'ni to'g'ridan-to'g'ri ochamiz
      if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
        navigate(s.tg_url);   // telefonda Telegram ilovasini to'g'ridan-to'g'ri ochamiz (QR kutubxonasi yuklanmaydi)
      } else {
        // qrcode CJS modul: nomlangan eksport yoki default ichida bo'lishi mumkin
        import("qrcode").then((m: any) => (m.toDataURL ?? m.default?.toDataURL)(s.bot_url, { margin: 1, width: 192 })).then((url: string) => { if (alive.current && id === runId.current) setQr(url); }).catch(() => undefined);
      }
      poll(s, id);
    } catch { if (id === runId.current) fail("error", "Aloqa xatosi. Qayta urinib ko'ring"); }
  }, [fail, navigate, poll, stop]);

  const cancel = () => { stop(); setPhase("idle"); setStarted(null); };
  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const busy = phase === "starting" || phase === "success";

  return (
    <div>
      <button type="button" onClick={start} disabled={busy || phase === "waiting"} data-testid="tg-login-btn"
        style={{ backgroundColor: TG_BLUE, color: "#ffffff" }}
        className="w-full flex items-center justify-center gap-3 rounded-button px-6 py-4 text-base font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-70">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlaneIcon size={22} />}
        {phase === "success" ? "Kirilmoqda..." : label}
      </button>

      {phase === "waiting" && started && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center" data-testid="tg-waiting">
          <p className="text-sm font-medium mb-1">Telegram'da botni oching</p>
          <p className="text-xs text-white/50 mb-4">«Start» ni bosing, so'ng <b>«✅ Kirishni tasdiqlash»</b> tugmasini bosing. Tasdiqlangach shu sahifa o'zi kiradi.</p>
          {!isMobile && (
            <div className="flex justify-center mb-3" data-testid="tg-qr-box">
              {qr ? <img src={qr} alt="Telegram QR kod" width={192} height={192} className="rounded-lg bg-white p-1" data-testid="tg-qr" /> : <Loader2 className="h-5 w-5 animate-spin text-white/40" />}
            </div>
          )}
          <div className="flex flex-col gap-2 items-center">
            <a href={isMobile ? started.tg_url : started.bot_url} target={isMobile ? undefined : "_blank"} rel="noopener noreferrer" data-testid="tg-open-link"
              style={{ backgroundColor: TG_BLUE, color: "#fff" }} className="inline-flex items-center gap-2 rounded-button px-5 py-2.5 text-sm font-medium"><PlaneIcon size={16} />Telegram'ni ochish</a>
            <a href={started.bot_url} target="_blank" rel="noopener noreferrer" className="text-xs text-white/40 hover:text-lime break-all" data-testid="tg-bot-url">{started.bot_url}</a>
          </div>
          <p className="text-xs text-white/40 mt-3 flex items-center justify-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Kutilmoqda… <span data-testid="tg-timer">{mmss}</span></p>
          <button type="button" onClick={cancel} className="text-xs text-white/40 hover:text-white mt-2 underline" data-testid="tg-cancel">Bekor qilish</button>
        </div>
      )}

      {(phase === "expired" || phase === "cancelled" || phase === "error" || phase === "banned") && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center" role="alert" data-testid="tg-problem">
          <p className="text-sm text-red-300">
            {phase === "expired" ? "Vaqt tugadi. Qayta urinib ko'ring." : phase === "cancelled" ? "Kirish bekor qilindi." : errorMsg || "Xatolik yuz berdi."}
          </p>
          {phase !== "banned" && <button type="button" onClick={start} className="text-xs text-lime hover:underline mt-1" data-testid="tg-retry">Qayta urinish</button>}
        </div>
      )}
    </div>
  );
}
