// ===== MEDIA UPLOAD YORDAMCHILARI (faqat brauzerda ishlaydi) =====
//
// Rasm  → siqiladi (max 1600px, JPEG) → /api/upload  (Vercel limiti 4MB)
// Video → /api/upload/init dan presigned URL'lar olinadi → bo'laklar TO'G'RIDAN-TO'G'RI R2'ga
//         yuboriladi (Vercel'dan o'tmaydi) → /api/upload/complete
//
// MUHIM: video yuklash ishlashi uchun R2 bucket'da CORS sozlangan bo'lishi shart
// (AllowedMethods: PUT, ExposeHeaders: ETag). Sozlash ko'rsatmasi: docs/video-post.md

import {
  ACCEPTED_VIDEO_TYPES,
  UPLOAD_PART_SIZE,
  VIDEO_POST_MAX_BYTES,
  VIDEO_POST_MAX_SECONDS,
} from "@/lib/constants";

export class UploadError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type VideoMeta = { duration: number; width: number; height: number };

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// Fayl turi va hajmini tekshiradi. Xato bo'lsa matn, yaxshi bo'lsa null.
export function validateVideoFile(file: File, maxBytes: number = VIDEO_POST_MAX_BYTES): string | null {
  const okType = (ACCEPTED_VIDEO_TYPES as readonly string[]).includes(file.type);
  if (!okType) return "Faqat MP4, MOV yoki WebM video yuklash mumkin";
  if (file.size > maxBytes) return `Video juda katta (${formatBytes(file.size)}). Maksimum ${formatBytes(maxBytes)}`;
  return null;
}

// Videoning davomiyligi va o'lchamini o'qiydi. Brauzer o'qiy olmasa xato tashlaydi.
export function getVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      fn();
    };
    const timer = setTimeout(
      () => done(() => reject(new UploadError("META_TIMEOUT", "Videoni o'qib bo'lmadi"))),
      15000
    );

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        done(() => reject(new UploadError("META_INVALID", "Video davomiyligini aniqlab bo'lmadi")));
        return;
      }
      const meta = { duration, width: video.videoWidth, height: video.videoHeight };
      done(() => resolve(meta));
    };
    video.onerror = () =>
      done(() =>
        reject(
          new UploadError(
            "META_ERROR",
            "Brauzer bu videoni o'qiy olmadi. Videoni MP4 (H.264) formatida saqlab qayta urinib ko'ring"
          )
        )
      );
    video.src = url;
  });
}

// Videodan muqova (poster) kadr oladi. Muvaffaqiyatsiz bo'lsa null (post muqovasiz ham ishlaydi).
export function captureVideoPoster(file: File, maxWidth = 720): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    let finished = false;
    const finish = (blob: Blob | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      video.onerror = null;
      video.onloadeddata = null;
      video.onseeked = null;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(blob);
    };
    const timer = setTimeout(() => finish(null), 8000);

    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      const target = Math.min(1, (video.duration || 1) / 2);
      video.currentTime = target;
    };
    video.onseeked = () => {
      try {
        const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round((video.videoWidth || maxWidth) * scale);
        canvas.height = Math.round((video.videoHeight || maxWidth) * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => finish(b), "image/jpeg", 0.8);
      } catch {
        finish(null);
      }
    };
    video.src = url;
  });
}

// Rasmni siqadi (max 1600px, JPEG). O'qib bo'lmasa asl faylni qaytaradi.
export async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    // Kichik va yengil rasmni qayta siqib o'tirmaymiz
    if (scale === 1 && file.size <= 1.5 * 1024 * 1024 && file.type === "image/jpeg") {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) return file;
    if (blob.size >= file.size && file.type === "image/jpeg") return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // masalan, Chrome'da HEIC — serverga yuboramiz, u aniq xabar beradi
  }
}

// Rasmni yuklaydi va public URL qaytaradi.
export async function uploadImage(file: File, folder: string = "posts"): Promise<string> {
  const prepared = await compressImage(file);
  if (prepared.size > 4 * 1024 * 1024) {
    throw new UploadError("IMAGE_TOO_BIG", "Rasm juda katta. Kichikroq rasm tanlang");
  }
  const formData = new FormData();
  formData.append("file", prepared);
  formData.append("bucket", folder);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new UploadError("IMAGE_UPLOAD_FAILED", data.message || "Rasmni yuklab bo'lmadi");
  }
  const { url } = await res.json();
  return url as string;
}

// Muqova (Blob) ni yuklaydi
export async function uploadPoster(blob: Blob, folder: string = "posts"): Promise<string | null> {
  try {
    return await uploadImage(new File([blob], "poster.jpg", { type: "image/jpeg" }), folder);
  } catch {
    return null; // muqovasiz ham davom etamiz
  }
}

// ===== To'g'ridan-to'g'ri R2'ga multipart yuklash =====

function putPart(
  url: string,
  blob: Blob,
  onLoaded: (loaded: number) => void,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new UploadError("ABORTED", "Yuklash bekor qilindi")); return; }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onLoaded(e.loaded); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (etag) resolve(etag);
        else {
          console.error("[upload] ETag o'qilmadi — R2 CORS'da ExposeHeaders: [\"ETag\"] bo'lishi kerak (docs/video-post.md)");
          reject(new UploadError("NO_ETAG", "Yuklash sozlamasida xatolik. Administratorga xabar bering"));
        }
      } else {
        reject(new UploadError("HTTP_" + xhr.status, "Yuklashda xatolik (" + xhr.status + ")"));
      }
    };
    xhr.onerror = () => {
      console.error("[upload] Tarmoq xatosi. Agar bu doim takrorlansa — R2 bucket CORS sozlanmagan bo'lishi mumkin (docs/video-post.md)");
      reject(new UploadError("NETWORK", "Internet aloqasi uzildi. Qayta urinib ko'ring"));
    };
    xhr.onabort = () => reject(new UploadError("ABORTED", "Yuklash bekor qilindi"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

async function putPartWithRetry(
  url: string,
  blob: Blob,
  onLoaded: (loaded: number) => void,
  signal?: AbortSignal,
  attempts = 3
): Promise<string> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      onLoaded(0);
      return await putPart(url, blob, onLoaded, signal);
    } catch (e: any) {
      lastError = e;
      if (e?.code === "ABORTED" || e?.code === "NO_ETAG") throw e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastError;
}

export async function uploadVideoDirect(
  file: File,
  opts: { folder?: "posts" | "lessons" | "chat" | "channel"; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}
): Promise<string> {
  const { folder = "posts", onProgress, signal } = opts;

  // 1. Boshlash + presigned URL'lar
  const initRes = await fetch("/api/upload/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, fileType: file.type, folder, size: file.size }),
    signal,
  });
  if (!initRes.ok) {
    const data = await initRes.json().catch(() => ({}));
    throw new UploadError("INIT_FAILED", data.message || "Yuklashni boshlab bo'lmadi");
  }
  const init = await initRes.json();
  const partSize: number = init.partSize || UPLOAD_PART_SIZE;
  const parts: { partNumber: number; url: string }[] = init.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new UploadError("INIT_INVALID", "Server yuklash havolalarini bermadi");
  }

  // 2. Bo'laklarni 3 tadan parallel yuborish
  const loaded: number[] = new Array(parts.length).fill(0);
  const report = () => onProgress?.(Math.min(1, loaded.reduce((a, b) => a + b, 0) / file.size));
  const results: { partNumber: number; etag: string }[] = [];
  let next = 0;
  let failure: unknown = null;

  const worker = async () => {
    while (!failure) {
      const i = next++;
      if (i >= parts.length) return;
      const start = i * partSize;
      const blob = file.slice(start, Math.min(start + partSize, file.size));
      try {
        const etag = await putPartWithRetry(
          parts[i].url,
          blob,
          (l) => { loaded[i] = l; report(); },
          signal
        );
        loaded[i] = blob.size;
        report();
        results.push({ partNumber: parts[i].partNumber, etag });
      } catch (e) {
        failure = failure || e;
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, parts.length) }, worker));
  if (failure) throw failure;

  // 3. Yakunlash
  const completeRes = await fetch("/api/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId: init.uploadId, key: init.key, parts: results }),
    signal,
  });
  if (!completeRes.ok) {
    const data = await completeRes.json().catch(() => ({}));
    throw new UploadError("COMPLETE_FAILED", data.message || "Yuklashni yakunlab bo'lmadi");
  }
  const done = await completeRes.json().catch(() => ({}));
  onProgress?.(1);
  return (done.url as string) || (init.publicUrl as string);
}

export { VIDEO_POST_MAX_SECONDS };
