"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { getDeviceId, isMobileUA, PlaneIcon, TG_BLUE } from "@/components/auth/telegram-shared";

// "Telegram'ni ulash" (LOGIN qilgan foydalanuvchi): POST /api/auth/telegram/link/start → Telegram'da "✅ Ulash" → status polling.
// Sessiya BERILMAYDI. Natijalar: linked (ulandi), conflict (boshqa akkauntga ulangan — xabar serverdan), expired, cancelled.
type Phase = "starting" | "waiting" | "linked" | "conflict" | "expired" | "cancelled" | "error";
interface Started { login_id: string; poll_secret: string; expires_at: string; poll_interval_ms?: number; bot_url: string; tg_url: string }
const MAX_NET_FAILS = 5;
const defaultNavigate = (url: string) => { window.location.href = url; };

export default function TelegramLinkPanel({ onLinked, onClose, navigate = defaultNavigate }: { onLinked: (info: { username: string | null; merged: boolean }) => void; onClose: () => void; navigate?: (url: string) => void }) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [started, setStarted] = useState<Started | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [merged, setMerged] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runId = useRef(0);

  useEffect(() => { alive.current = true; setIsMobile(isMobileUA()); return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);
  useEffect(() => {
    if (phase !== "waiting" || !started) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((Date.parse(started.expires_at) - Date.now()) / 1000)));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [phase, started]);

  const stop = useCallback(() => { runId.current++; if (timer.current) clearTimeout(timer.current); }, []);
  const end = useCallback((p: Phase, m = "") => { stop(); if (alive.current) { setPhase(p); setMsg(m); } }, [stop]);

  const poll = useCallback((s: Started, id: number, fails = 0) => {
    timer.current = setTimeout(async () => {
      if (!alive.current || id !== runId.current) return;
      if (Date.now() > Date.parse(s.expires_at) + 5000) return end("expired");
      try {
        const res = await fetch(`/api/auth/telegram/link/status?login_id=${encodeURIComponent(s.login_id)}&poll_secret=${encodeURIComponent(s.poll_secret)}`, { cache: "no-store" });
        if (!alive.current || id !== runId.current) return;
        const d: any = await res.json().catch(() => ({}));
        if (res.status === 401) return end("error", "Seans tugagan. Qayta kiring");
        if (!res.ok) return end("error", d.message || "Xatolik yuz berdi. Qayta urinib ko'ring");
        if (d.status === "pending") return poll(s, id, 0);
        if (d.status === "expired") return end("expired");
        if (d.status === "cancelled") return end("cancelled");
        if (d.status === "conflict") return end("conflict", d.message || "Bu Telegram boshqa akkauntga ulangan. Yordam xizmatiga yozing.");
        if (d.status === "linked") { stop(); setMerged(!!d.merged_empty_account); if (alive.current) setPhase("linked"); onLinked({ username: d.telegram?.username ?? null, merged: !!d.merged_empty_account }); return; }
        return end("error", "Kutilmagan javob. Qayta urinib ko'ring");
      } catch {
        if (!alive.current || id !== runId.current) return;
        if (fails + 1 >= MAX_NET_FAILS) return end("error", "Aloqa uzildi. Internetni tekshirib, qayta urinib ko'ring");
        poll(s, id, fails + 1);
      }
    }, s.poll_interval_ms ?? 2000);
  }, [end, onLinked, stop]);

  const start = useCallback(async () => {
    stop(); setPhase("starting"); setMsg(""); setQr(null);
    const id = ++runId.current;
    try {
      const res = await fetch("/api/auth/telegram/link/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: "web", device_id: getDeviceId() }) });
      const d: any = await res.json().catch(() => ({}));
      if (id !== runId.current || !alive.current) return;
      if (res.status === 409 && d.code === "ALREADY_LINKED") { end("error", d.message || "Akkauntingizga Telegram allaqachon ulangan"); onLinked({ username: d.telegram?.username ?? null, merged: false }); return; }
      if (!res.ok) return end("error", res.status === 429 ? "Juda ko'p urinish. Bir necha daqiqadan keyin qayta urinib ko'ring" : res.status === 401 ? "Seans tugagan. Qayta kiring" : res.status === 503 ? "Telegram hozircha mavjud emas" : d.message || "Xatolik yuz berdi");
      const s: Started = d; setStarted(s); setPhase("waiting");
      if (isMobileUA()) navigate(s.tg_url);
      else import("qrcode").then((m: any) => (m.toDataURL ?? m.default?.toDataURL)(s.bot_url, { margin: 1, width: 192 })).then((url: string) => { if (alive.current && id === runId.current) setQr(url); }).catch(() => undefined);
      poll(s, id);
    } catch { if (id === runId.current) end("error", "Aloqa xatosi. Qayta urinib ko'ring"); }
  }, [end, navigate, onLinked, poll, stop]);

  useEffect(() => { start(); /* panel ochilganda bir marta */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const close = () => { stop(); onClose(); };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center" data-testid="tg-link-panel">
      {phase === "starting" && <p className="text-sm text-white/50 flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Tayyorlanmoqda…</p>}
      {phase === "waiting" && started && (
        <>
          <p className="text-sm font-medium mb-1">Telegram'da botni oching</p>
          <p className="text-xs text-white/50 mb-4">«Start» ni bosing, so'ng <b>«✅ Ulash»</b> tugmasini bosing.</p>
          {!isMobile && <div className="flex justify-center mb-3" data-testid="tg-link-qr-box">{qr ? <img src={qr} alt="Telegram QR kod" width={192} height={192} className="rounded-lg bg-white p-1" data-testid="tg-link-qr" /> : <Loader2 className="h-5 w-5 animate-spin text-white/40" />}</div>}
          <a href={isMobile ? started.tg_url : started.bot_url} target={isMobile ? undefined : "_blank"} rel="noopener noreferrer" data-testid="tg-link-open" style={{ backgroundColor: TG_BLUE, color: "#fff" }} className="inline-flex items-center gap-2 rounded-button px-5 py-2.5 text-sm font-medium"><PlaneIcon size={16} />Telegram'ni ochish</a>
          <p className="text-xs text-white/40 mt-3">Kutilmoqda… <span data-testid="tg-link-timer">{mmss}</span></p>
        </>
      )}
      {phase === "linked" && <p className="text-sm text-lime" role="status" data-testid="tg-link-ok">✅ Telegram ulandi.{merged ? " Telegram orqali ochilgan bo'sh akkaunt o'chirildi." : ""}</p>}
      {(phase === "conflict" || phase === "error") && <p className="text-sm text-red-300" role="alert" data-testid="tg-link-problem">{msg}</p>}
      {phase === "expired" && <p className="text-sm text-red-300" role="alert" data-testid="tg-link-problem">Vaqt tugadi. Qayta urinib ko'ring.</p>}
      {phase === "cancelled" && <p className="text-sm text-red-300" role="alert" data-testid="tg-link-problem">Ulash bekor qilindi.</p>}
      <div className="mt-3 flex items-center justify-center gap-4 text-xs">
        {(phase === "expired" || phase === "cancelled" || phase === "error") && <button type="button" onClick={start} className="text-lime hover:underline" data-testid="tg-link-retry">Qayta urinish</button>}
        <button type="button" onClick={close} className="text-white/40 hover:text-white underline" data-testid="tg-link-close">{phase === "linked" || phase === "conflict" ? "Yopish" : "Bekor qilish"}</button>
      </div>
    </div>
  );
}
