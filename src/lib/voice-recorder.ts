"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_VOICE_BITRATE, CHAT_VOICE_MAX_SECONDS } from "@/lib/constants";

// Brauzer qo'llaydigan formatni tanlaydi: WebM/Opus — Chrome/Firefox/Android'ning ASL, eng barqaror formati
// (shuning uchun birinchi sinaladi). Safari WebM'ni umuman qo'llamaydi (shu yerda "yo'q" javobini beradi),
// shuning uchun faqat SHU holatda MP4/AAC'ga o'tiladi — bu iPhone'da ham ishlashi uchun yetarli.
// MUHIM: MP4/AAC'ni Chrome uchun BIRINCHI qilib qo'ymang — Chrome "qo'llayman" deb javob bersa ham (isTypeSupported
// true), ba'zi Mac+Chrome kombinatsiyalarida uning apparat kodlagichi beqaror bo'lib, yozishni sababsiz to'xtatib,
// hatto butun brauzerni qulatib yuborishi ma'lum. Shu sababli WebM doim birinchi bo'lishi kerak.
export function pickAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

export function isVoiceSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

export interface VoiceResult { blob: Blob; mime: string; duration: number }

export function friendlyMicError(e: any): string {
  const name = e?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Mikrofonga ruxsat berilmagan. Brauzer sozlamalarida ruxsat bering";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Mikrofon topilmadi";
  if (name === "NotReadableError") return "Mikrofon boshqa ilova tomonidan band";
  return "Ovoz yozishni boshlab bo'lmadi";
}

interface Opts { maxSeconds?: number; onLimit?: (r: VoiceResult | null) => void }

// Ovoz yozish: start() → (soniyalar hisoblanadi) → stop() natijani qaytaradi, cancel() tashlab yuboradi.
// Maksimal davomiylikka yetganda o'zi to'xtaydi va onLimit chaqiriladi.
export function useVoiceRecorder({ maxSeconds = CHAT_VOICE_MAX_SECONDS, onLimit }: Opts = {}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelled = useRef(false);
  const autoStopped = useRef(false);
  const resolver = useRef<((r: VoiceResult | null) => void) | null>(null);
  const onLimitRef = useRef(onLimit);
  onLimitRef.current = onLimit;

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    setRecording(false);
    setSeconds(0);
  }, []);

  const finish = useCallback(() => {
    const mime = (recRef.current?.mimeType || chunksRef.current[0]?.type || "audio/webm").split(";")[0];
    const duration = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const blob = new Blob(chunksRef.current, { type: mime });
    const ok = !cancelled.current && blob.size > 0;
    cleanup();
    const result = ok ? { blob, mime, duration: Math.min(duration, maxSeconds) } : null;
    resolver.current?.(result);
    resolver.current = null;
    return result;
  }, [cleanup, maxSeconds]);

  // Muvaffaqiyatli bo'lsa null, aks holda foydalanuvchiga ko'rsatiladigan xato matni
  const start = useCallback(async (): Promise<string | null> => {
    setError(null);
    if (!isVoiceSupported()) { const m = "Bu brauzer ovoz yozishni qo'llamaydi"; setError(m); return m; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickAudioMimeType();
      const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: CHAT_VOICE_BITRATE });
      chunksRef.current = [];
      cancelled.current = false;
      rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const r = finish();
        if (autoStopped.current) { autoStopped.current = false; onLimitRef.current?.(r); }
      };
      recRef.current = rec;
      startedAt.current = Date.now();
      rec.start();
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAt.current) / 1000);
        setSeconds(s);
        if (s >= maxSeconds && recRef.current && recRef.current.state !== "inactive") {
          autoStopped.current = true;
          recRef.current.stop();
        }
      }, 250);
      return null;
    } catch (e) {
      cleanup();
      const m = friendlyMicError(e);
      setError(m);
      return m;
    }
  }, [cleanup, finish, maxSeconds]);

  const stop = useCallback((): Promise<VoiceResult | null> => {
    const rec = recRef.current;
    if (!rec || rec.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => { resolver.current = resolve; rec.stop(); });
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else cleanup();
  }, [cleanup]);

  // Sahifadan chiqib ketsa mikrofon o'chadi
  useEffect(() => () => { cancelled.current = true; try { recRef.current?.stop(); } catch {} cleanup(); }, [cleanup]);

  return { recording, seconds, error, start, stop, cancel, maxSeconds };
}
