"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Mic, Paperclip, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CHAT_CAPTION_MAX, CHAT_TEXT_MAX } from "@/lib/constants";
import { useVoiceRecorder, isVoiceSupported } from "@/lib/voice-recorder";
import { uploadChatImage, uploadChatVideo, uploadChatVoice, type MediaPayload } from "@/lib/chat-upload";
import { formatVoiceTime } from "@/lib/chat-client";

export type OutgoingPayload = { type: "text"; content: string } | (MediaPayload & { content?: string });

interface Props {
  onSend: (payload: OutgoingPayload, tempId?: string) => Promise<boolean>;
  onOptimistic?: (preview: { type: "image" | "video" | "voice"; localUrl: string; duration?: number }) => string;
  onOptimisticFailed?: (tempId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Xabar yozish paneli: matn, rasm/video biriktirish, ovoz yozish (mikrofon).
export function Composer({ onSend, onOptimistic, onOptimisticFailed, disabled, placeholder = "Xabar yozing..." }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);   // Telegram uslubi: qisqa bosib qo'yilgach "qulflangan" (qo'lsiz) yozish holati
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const deliver = async (payload: OutgoingPayload, tempId?: string) => {
    const ok = await onSend(payload, tempId);
    if (ok) setText("");
    return ok;
  };

  const recorder = useVoiceRecorder({
    onLimit: (r) => { if (r) void sendVoice(r); },
  });
  // Yozish tugagan (yuborilgan/bekor qilingan/limitga yetgan) zahoti "qulflangan" holat ham tozalanadi
  useEffect(() => { if (!recorder.recording) setLocked(false); }, [recorder.recording]);

  const sendVoice = async (r: { blob: Blob; mime: string; duration: number }) => {
    setBusy(true);
    // Darhol chatda ko'rinsin (mahalliy audio bilan), keyin yuklanadi — Telegram'dagi kabi
    const localUrl = URL.createObjectURL(r.blob);
    const tempId = onOptimistic?.({ type: "voice", localUrl, duration: r.duration });
    try {
      const media = await uploadChatVoice(r.blob, r.mime, r.duration);
      await onSend(media, tempId);
    } catch (e: any) {
      toast.error(e?.message || "Ovozli xabarni yuborib bo'lmadi");
      if (tempId) onOptimisticFailed?.(tempId);
    } finally { setBusy(false); URL.revokeObjectURL(localUrl); }
  };

  const sendText = async () => {
    const t = text.trim();
    if (!t || busy || disabled) return;
    if (t.length > CHAT_TEXT_MAX) { toast.error(`Xabar juda uzun (maksimum ${CHAT_TEXT_MAX} belgi)`); return; }
    await deliver({ type: "text", content: t });
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || busy || disabled) return;
    const caption = text.trim().slice(0, CHAT_CAPTION_MAX);
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) { toast.error("Faqat rasm yoki video yuborish mumkin"); return; }
    setBusy(true);
    // Darhol chatda mahalliy fayl bilan ko'rinsin, yuklanayotganda pufak ustida "yuklanmoqda" belgisi turadi
    const localUrl = URL.createObjectURL(file);
    const tempId = onOptimistic?.({ type: isVideo ? "video" : "image", localUrl });
    try {
      let media: MediaPayload;
      if (isVideo) {
        const ctrl = new AbortController(); abortRef.current = ctrl;
        setProgress(0);
        media = await uploadChatVideo(file, setProgress, ctrl.signal);
      } else {
        media = await uploadChatImage(file);
      }
      await deliver({ ...media, ...(caption ? { content: caption } : {}) }, tempId);
    } catch (err: any) {
      if (err?.code !== "ABORTED") toast.error(err?.message || "Faylni yuborib bo'lmadi");
      if (tempId) onOptimisticFailed?.(tempId);
    } finally { setBusy(false); setProgress(null); abortRef.current = null; URL.revokeObjectURL(localUrl); }
  };

  // ---- Bosib turib yozish (Telegram uslubida) ----
  // Qisqa bosib qo'ysa (~350ms dan tez qo'yib yuborsa): yozish DAVOM ETADI ("qulflangan" holat) — pastdagi
  // Bekor qilish/Yuborish tugmalari bilan davom etiladi. Uzoqroq ushlab tursa: qo'yib yuborgan zahoti
  // avtomatik TO'XTAYDI va YUBORILADI — qo'lni qo'yib yuborish "jo'nat" degani.
  const HOLD_MS = 350;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHolding = useRef(false);
  const pressStarted = useRef(false);

  const onMicPress = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (busy || disabled || recorder.recording || pressStarted.current) return;
    pressStarted.current = true;
    isHolding.current = false;
    const err = await recorder.start();
    if (err) { toast.error(err); pressStarted.current = false; return; }
    holdTimer.current = setTimeout(() => { isHolding.current = true; }, HOLD_MS);
  };

  const onMicRelease = () => {
    if (!pressStarted.current) return;
    pressStarted.current = false;
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (isHolding.current) void finishRecording();   // ushlab turgandan keyin qo'yib yubordi — jo'nat
    else setLocked(true);   // qisqa bosish edi — yozish "qulflangan" holatga o'tadi, pastdagi tugmalar bilan boshqariladi
  };

  const finishRecording = async () => {
    const r = await recorder.stop();
    if (r) await sendVoice(r);
  };

  // ---- Yozib olish rejimi ----
  if (recorder.recording && locked) {
    return (
      <div className="p-3 sm:p-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => recorder.cancel()} aria-label="Bekor qilish" className="p-2.5 rounded-full text-white/50 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-5 w-5" /></button>
          <div className="flex-1 flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono tabular-nums" data-testid="rec-timer">{formatVoiceTime(recorder.seconds)}</span>
            <span className="text-[11px] text-white/30">/ {formatVoiceTime(recorder.maxSeconds)}</span>
          </div>
          <button type="button" onClick={finishRecording} aria-label="Yuborish" className="p-2.5 rounded-full bg-lime text-black"><Send className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }

  const hasText = text.trim().length > 0;
  const holding = recorder.recording && !locked;   // bosib turilgan, hali "qulflanmagan" (gesture hal qilinmagan)
  return (
    <div className="p-3 sm:p-4 border-t border-white/[0.06]">
      {progress !== null && (
        <div className="mb-2 flex items-center gap-2" data-testid="upload-progress">
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-lime transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <span className="text-[11px] text-white/40 tabular-nums w-9 text-right">{Math.round(progress * 100)}%</span>
          <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Yuklashni bekor qilish" className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={onPickFile} data-testid="file-input" />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || disabled} aria-label="Rasm yoki video biriktirish"
          className="p-2.5 rounded-full text-white/40 hover:text-lime hover:bg-lime/10 disabled:opacity-30"><Paperclip className="h-5 w-5" /></button>
        {holding ? (
          <div className="input-field !py-2.5 flex-1 flex items-center gap-2 text-sm" data-testid="hold-indicator">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="font-mono tabular-nums" data-testid="rec-timer">{formatVoiceTime(recorder.seconds)}</span>
            <span className="text-[11px] text-white/30 truncate">Ushlab tursangiz jo'natiladi, qo'yib yuboring</span>
          </div>
        ) : (
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} rows={1} disabled={disabled} placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendText(); } }}
            className="input-field !py-2.5 resize-none flex-1 text-sm" style={{ maxHeight: "120px" }}
          />
        )}
        {hasText && !holding ? (
          <button type="button" onClick={sendText} disabled={busy || disabled} aria-label="Yuborish" className="btn-lime !p-2.5 rounded-button disabled:opacity-30">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        ) : (
          <button type="button" onMouseDown={onMicPress} onMouseUp={onMicRelease} onMouseLeave={onMicRelease}
            onTouchStart={onMicPress} onTouchEnd={onMicRelease} onContextMenu={(e) => e.preventDefault()}
            disabled={busy || disabled || !isVoiceSupported()} aria-label="Ovozli xabar yozish" data-testid="mic-button" data-holding={holding}
            title={isVoiceSupported() ? "Ovozli xabar — bosib qo'ysangiz yozadi, ushlab tursangiz qo'yib yuborganda jo'natadi" : "Bu brauzer ovoz yozishni qo'llamaydi"}
            className={cn("!p-2.5 rounded-button select-none", holding ? "bg-red-500 text-white animate-pulse" : busy ? "opacity-30" : "btn-lime", "disabled:opacity-30")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

