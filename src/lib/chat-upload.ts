"use client";

import {
  CHAT_VIDEO_MAX_BYTES, CHAT_VIDEO_MAX_SECONDS, CHAT_VOICE_MAX_BYTES,
} from "@/lib/constants";
import {
  UploadError, uploadImage, uploadPoster, uploadVideoDirect, validateVideoFile, getVideoMeta, captureVideoPoster, formatBytes,
} from "@/lib/upload";
import type { MessageType } from "@/lib/chat-client";

// Xabar yuborish uchun tayyor ma'lumot (API'ga shu ko'rinishda ketadi)
export interface MediaPayload {
  type: Exclude<MessageType, "text">;
  media_url: string;
  media_mime?: string;
  media_duration?: number;
  media_size?: number;
  thumb_url?: string;
}

export async function uploadChatImage(file: File): Promise<MediaPayload> {
  const url = await uploadImage(file, "chat");
  return { type: "image", media_url: url, media_mime: "image/jpeg" };
}

export async function uploadChatVoice(blob: Blob, mime: string, duration: number): Promise<MediaPayload> {
  if (blob.size > CHAT_VOICE_MAX_BYTES) throw new UploadError("VOICE_TOO_BIG", "Ovozli xabar juda katta. Qisqaroq yozing");
  const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
  const fd = new FormData();
  fd.append("file", new File([blob], `voice.${ext}`, { type: mime }));
  fd.append("bucket", "chat");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new UploadError("VOICE_UPLOAD_FAILED", d.message || "Ovozli xabarni yuklab bo'lmadi");
  }
  const { url } = await res.json();
  return { type: "voice", media_url: url, media_mime: mime, media_duration: duration, media_size: blob.size };
}

export async function uploadChatVideo(file: File, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<MediaPayload> {
  const bad = validateVideoFile(file, CHAT_VIDEO_MAX_BYTES);
  if (bad) throw new UploadError("VIDEO_INVALID", bad);
  const meta = await getVideoMeta(file);
  if (meta.duration > CHAT_VIDEO_MAX_SECONDS) {
    throw new UploadError("VIDEO_TOO_LONG", `Video ${Math.round(CHAT_VIDEO_MAX_SECONDS / 60)} daqiqadan oshmasligi kerak (sizniki ${Math.round(meta.duration)} soniya)`);
  }
  const posterBlob = await captureVideoPoster(file);
  const thumb = posterBlob ? await uploadPoster(posterBlob, "chat") : null;
  const url = await uploadVideoDirect(file, { folder: "chat", onProgress, signal });
  return {
    type: "video", media_url: url, media_mime: file.type, media_duration: Math.max(1, Math.round(meta.duration)),
    media_size: file.size, ...(thumb ? { thumb_url: thumb } : {}),
  };
}

export { formatBytes };
