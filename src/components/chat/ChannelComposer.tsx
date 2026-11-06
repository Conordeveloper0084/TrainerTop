"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Video, Loader2, Send, X, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import {
  uploadImage, uploadPoster, uploadVideoDirect, validateVideoFile, getVideoMeta, captureVideoPoster, formatDuration,
} from "@/lib/upload";
import { VIDEO_POST_MAX_BYTES, VIDEO_POST_MAX_SECONDS } from "@/lib/constants";
import { ANNOUNCE_BODY_MAX } from "@/lib/announcements";

const newToken = () => (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));

interface VideoState { file: File; url: string; meta: { duration: number }; poster: Blob | null; posterUrl?: string }
export interface EditingPost { id: string; title: string | null; body: string | null; image_url: string | null; video_url: string | null; video_thumbnail_url: string | null; video_duration: number | null }

// Chat ichida: admin uchun rasmiy kanalga to'g'ridan-to'g'ri yozish (matn + rasm YOKI video). Har doim "hammaga" (kind=all).
// `editing` berilsa — shu postni TAHRIRLASH rejimi (POST o'rniga PATCH, "Bekor qilish" banneri bilan).
export function ChannelComposer({ onSent, editing, onCancelEdit }: { onSent?: () => void; editing?: EditingPost | null; onCancelEdit?: () => void }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [video, setVideo] = useState<VideoState | null>(null);
  // Tahrirlashda mavjud (eski) video — yangisi tanlanmasa shu saqlanib qoladi
  const [existingVideo, setExistingVideo] = useState<{ url: string; thumb: string | null; duration: number | null } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const token = useRef(newToken());
  const posterPromiseRef = useRef<Promise<Blob | null> | null>(null);
  const editingTitle = useRef<string | null>(null);

  useEffect(() => {
    if (editing) {
      setText(editing.body || ""); setImage(editing.image_url || null);
      setExistingVideo(editing.video_url ? { url: editing.video_url, thumb: editing.video_thumbnail_url, duration: editing.video_duration } : null);
      setVideo(null); editingTitle.current = editing.title;
    } else {
      setText(""); setImage(null); setExistingVideo(null); setVideo(null); editingTitle.current = null;
    }
  }, [editing]);

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    if (video || existingVideo) { toast.error("Rasm va video birga bo'lmaydi"); return; }
    setPreparing(true);
    try { setImage(await uploadImage(f, "channel")); } catch (err: any) { toast.error(err?.message || "Rasmni yuklab bo'lmadi"); } finally { setPreparing(false); }
  };

  const pickVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    if (image) { toast.error("Rasm va video birga bo'lmaydi"); return; }
    const err = validateVideoFile(f, VIDEO_POST_MAX_BYTES);
    if (err) { toast.error(err); return; }
    setPreparing(true);
    try {
      const meta = await getVideoMeta(f);
      if (meta.duration > VIDEO_POST_MAX_SECONDS + 0.5) { toast.error(`Video ${formatDuration(meta.duration)} — maksimum ${formatDuration(VIDEO_POST_MAX_SECONDS)}`); return; }
      setExistingVideo(null); setVideo({ file: f, url: URL.createObjectURL(f), meta, poster: null });
      const pending = captureVideoPoster(f); posterPromiseRef.current = pending;
      pending.then((blob) => { if (blob) setVideo((v) => (v && v.file === f ? { ...v, poster: blob, posterUrl: URL.createObjectURL(blob) } : v)); });
    } catch (err: any) { toast.error(err?.message || "Videoni o'qib bo'lmadi"); } finally { setPreparing(false); }
  };

  const removeMedia = () => { setImage(null); setExistingVideo(null); if (video) { URL.revokeObjectURL(video.url); if (video.posterUrl) URL.revokeObjectURL(video.posterUrl); } posterPromiseRef.current = null; setVideo(null); };

  const cancelEdit = () => { removeMedia(); setText(""); token.current = newToken(); onCancelEdit?.(); };

  const canSend = (!!text.trim() || !!image || !!video || !!existingVideo) && !uploading && !preparing;

  const send = async () => {
    if (!canSend) return;
    setUploading(true); setProgress(0);
    try {
      const payload: Record<string, any> = { kind: "all", title: editingTitle.current || undefined, body: text.trim() || undefined, client_token: token.current };
      if (video) {
        const videoUrl = await uploadVideoDirect(video.file, { folder: "channel", onProgress: setProgress });
        const posterBlob = video.poster ?? (await posterPromiseRef.current);
        const thumb = posterBlob ? await uploadPoster(posterBlob, "channel") : null;
        payload.video_url = videoUrl; payload.video_thumbnail_url = thumb; payload.video_duration = Math.round(video.meta.duration);
      } else if (existingVideo) {
        payload.video_url = existingVideo.url; payload.video_thumbnail_url = existingVideo.thumb; payload.video_duration = existingVideo.duration;
      } else if (image) {
        payload.image_url = image;
      }
      const url = editing ? `/api/admin/announcements/${editing.id}` : "/api/admin/announcements";
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Yuborilmadi"); return; }
      setText(""); removeMedia(); token.current = newToken();
      if (editing) onCancelEdit?.();
      onSent?.();
    } catch { toast.error("Yuborilmadi"); } finally { setUploading(false); setProgress(0); }
  };

  return (
    <div className="p-3 border-t border-white/[0.06]" data-testid="channel-composer">
      {editing && (
        <div className="flex items-center gap-2 mb-2 text-xs text-lime bg-lime/[0.08] rounded-lg px-3 py-2" data-testid="edit-banner">
          <Pencil className="h-3.5 w-3.5 shrink-0" /><span className="flex-1">Postni tahrirlash</span>
          <button onClick={cancelEdit} aria-label="Tahrirlashni bekor qilish" className="text-white/50 hover:text-white">Bekor qilish</button>
        </div>
      )}
      {(image || video || existingVideo) && (
        <div className="relative inline-block mb-2">
          {image ? <img src={image} alt="" className="h-20 rounded-lg" /> : <video src={video?.url || existingVideo?.url} className="h-20 rounded-lg" muted />}
          <button onClick={removeMedia} aria-label="Media olib tashlash" className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"><X className="h-3 w-3" /></button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={pickImage} data-testid="channel-image-input" />
        <input ref={vidRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={pickVideo} data-testid="channel-video-input" />
        <button onClick={() => imgRef.current?.click()} disabled={preparing || uploading || !!video || !!existingVideo} aria-label="Rasm biriktirish" className="!p-2.5 rounded-button text-white/40 hover:text-lime disabled:opacity-30"><ImagePlus className="h-4 w-4" /></button>
        <button onClick={() => vidRef.current?.click()} disabled={preparing || uploading || !!image} aria-label="Video biriktirish" className="!p-2.5 rounded-button text-white/40 hover:text-lime disabled:opacity-30"><Video className="h-4 w-4" /></button>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={ANNOUNCE_BODY_MAX} rows={1} placeholder="Kanalga xabar yozing..." aria-label="Kanalga xabar"
          className="input-field !py-2.5 resize-none flex-1 text-sm" style={{ maxHeight: "120px" }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        <button onClick={send} disabled={!canSend} aria-label={editing ? "Saqlash" : "Yuborish"} className="!p-2.5 rounded-button bg-lime text-black disabled:opacity-30 shrink-0">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      {uploading && video && <p className="text-[10px] text-white/30 mt-1">Video yuklanmoqda: {Math.round(progress * 100)}%</p>}
    </div>
  );
}
