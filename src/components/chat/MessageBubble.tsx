"use client";

import { Trash2, Ban, Loader2, Play, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat-client";
import { formatVoiceTime } from "@/lib/chat-client";
import { VoicePlayer } from "./VoicePlayer";

interface Props {
  msg: ChatMessage;
  mine: boolean;
  isGroup?: boolean;
  ownerId?: string;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
  onReport?: (id: string) => void;
  onOpenImage?: (url: string) => void;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });

// Bitta xabar pufagi: matn, rasm, ovoz, video yoki "o'chirildi".
export function MessageBubble({ msg, mine, isGroup, ownerId, canDelete, onDelete, onReport, onOpenImage }: Props) {
  const deleted = !!msg.deleted_at;
  const isOwnerMsg = !!ownerId && msg.sender_id === ownerId;

  return (
    <div className={cn("flex group", mine ? "justify-end" : "justify-start")} data-testid="message">
      <div className={cn("max-w-[80%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5", mine ? "bg-lime text-black rounded-br-md" : "bg-dark-card text-white/80 rounded-bl-md")}>
        {isGroup && !mine && !deleted && (
          <p className="text-[11px] font-semibold mb-1 text-lime/90 flex items-center gap-1.5">
            {msg.sender?.full_name || "Foydalanuvchi"}
            {isOwnerMsg && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-lime/15 text-lime font-bold">Trener</span>}
          </p>
        )}

        {deleted ? (
          <p className={cn("text-xs italic flex items-center gap-1.5", mine ? "text-black/50" : "text-white/30")}><Ban className="h-3 w-3" />Xabar o'chirildi</p>
        ) : (
          <>
            {msg.type !== "text" && (
              <div className="relative">
                {msg.type === "image" && (msg.media_url || msg.image_url) && (
                  <button type="button" onClick={() => onOpenImage?.((msg.media_url || msg.image_url) as string)} className="block mb-1.5 -mx-1 -mt-0.5" aria-label="Rasmni ochish" disabled={msg.pending}>
                    <img src={(msg.media_url || msg.image_url) as string} alt="" loading="lazy" className="rounded-xl max-h-72 w-auto max-w-full object-cover" />
                  </button>
                )}
                {msg.type === "video" && msg.media_url && (
                  <div className="mb-1.5 -mx-1 -mt-0.5">
                    <video src={msg.media_url} poster={msg.thumb_url || undefined} controls={!msg.pending} playsInline preload="metadata" className="rounded-xl max-h-72 w-full bg-black" />
                    {msg.media_duration ? <p className={cn("text-[10px] mt-1 flex items-center gap-1", mine ? "text-black/50" : "text-white/30")}><Play className="h-2.5 w-2.5" />{formatVoiceTime(msg.media_duration)}</p> : null}
                  </div>
                )}
                {msg.type === "voice" && msg.media_url && <VoicePlayer src={msg.media_url} duration={msg.media_duration} mine={mine} />}
                {msg.pending && (
                  <div data-testid="media-uploading" className="absolute inset-0 rounded-xl bg-black/45 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-white" aria-label="Yuklanmoqda" />
                  </div>
                )}
              </div>
            )}
            {msg.content && <p className="text-sm leading-relaxed whitespace-pre-line break-words">{msg.content}</p>}
          </>
        )}

        <div className={cn("flex items-center justify-end gap-2 mt-1", mine ? "text-black/40" : "text-white/20")}>
          {onReport && !mine && !deleted && !msg.pending && (
            <button type="button" onClick={() => onReport(msg.id)} aria-label="Xabarga shikoyat qilish" title="Shikoyat qilish"
              className="opacity-60 sm:opacity-0 group-hover:opacity-70 hover:!opacity-100 focus:opacity-100 transition-opacity">
              <Flag className="h-3 w-3" />
            </button>
          )}
          {canDelete && !deleted && !msg.pending && (
            <button type="button" onClick={() => onDelete?.(msg.id)} aria-label="Xabarni o'chirish" title="Xabarni o'chirish"
              className="opacity-60 sm:opacity-0 group-hover:opacity-70 hover:!opacity-100 focus:opacity-100 transition-opacity">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          {msg.pending && msg.type === "text" && <Loader2 className="h-3 w-3 animate-spin" aria-label="Yuborilmoqda" />}
          <span className="text-[10px]">{time(msg.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
