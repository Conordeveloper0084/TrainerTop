"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronLeft, Loader2, Trash2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { Carousel } from "@/components/posts/PostMedia";
import {
  uploadImage, uploadPoster, uploadVideoDirect, validateVideoFile, getVideoMeta, captureVideoPoster,
  formatDuration, formatBytes, type VideoMeta,
} from "@/lib/upload";
import { VIDEO_POST_MAX_SECONDS, VIDEO_POST_MAX_BYTES } from "@/lib/constants";
import { MAX_POST_IMAGES, MAX_CAPTION, captionRows, canSubmitPost } from "@/lib/post-create";

// Post yaratish sahifasi — tartib Android/iOS bilan BIR XIL:
//   sarlavha + izoh → tanlangan rasm/video ko'rinishi (kesilmaydi) → "Rasm" / "Video" plitkalari → ENG PASTDA "Matn" → "Joylash".
// Rasm va video birga bo'lmaydi (server ham rad etadi). Faqat matnli post ham joylanadi.

export default function CreatePostPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);

  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<{ file: File; url: string }[]>([]);
  const [video, setVideo] = useState<{ file: File; url: string; meta: VideoMeta; poster: Blob | null; posterUrl?: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const posterPromiseRef = useRef<Promise<Blob | null> | null>(null);

  // Mehmon — kirish sahifasiga (qaytib shu yerga keladi)
  useEffect(() => { if (ready && !user) router.replace("/login?redirect=/posts/create"); }, [ready, user, router]);

  // Yuklash paytida sahifani yopmaslik haqida ogohlantirish; chiqishda yuklash to'xtatiladi
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const hasMedia = images.length > 0 || !!video;
  const canSubmit = canSubmitPost(caption, hasMedia, uploading || preparing);
  const imagesFull = images.length >= MAX_POST_IMAGES;

  const addImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    const room = MAX_POST_IMAGES - images.length;
    if (files.length > room) toast.info(`Ko'pi bilan ${MAX_POST_IMAGES} ta rasm`);
    const picked = files.slice(0, Math.max(0, room));
    if (picked.length > 0) setImages((p) => [...p, ...picked.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
  };
  const removeImage = (i: number) => setImages((p) => { URL.revokeObjectURL(p[i].url); return p.filter((_, idx) => idx !== i); });

  const pickVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateVideoFile(file, VIDEO_POST_MAX_BYTES);
    if (err) { toast.error(err); return; }
    setPreparing(true);
    try {
      const meta = await getVideoMeta(file);
      if (meta.duration > VIDEO_POST_MAX_SECONDS + 0.5) {
        toast.error(`Video ${formatDuration(meta.duration)} — maksimum ${formatDuration(VIDEO_POST_MAX_SECONDS)} bo'lishi kerak`);
        return;
      }
      if (video) { URL.revokeObjectURL(video.url); if (video.posterUrl) URL.revokeObjectURL(video.posterUrl); }
      setVideo({ file, url: URL.createObjectURL(file), meta, poster: null });
      // Muqova orqa fonda olinadi — foydalanuvchi kutib o'tirmaydi
      const pending = captureVideoPoster(file);
      posterPromiseRef.current = pending;
      pending.then((blob) => { if (blob) setVideo((v) => (v && v.file === file ? { ...v, poster: blob, posterUrl: URL.createObjectURL(blob) } : v)); });
    } catch (e: any) {
      toast.error(e?.message || "Videoni o'qib bo'lmadi");
    } finally {
      setPreparing(false);
    }
  };
  const removeVideo = () => {
    if (video) { URL.revokeObjectURL(video.url); if (video.posterUrl) URL.revokeObjectURL(video.posterUrl); }
    posterPromiseRef.current = null;
    setVideo(null);
  };

  const submit = async () => {
    if (!canSubmit) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setUploading(true);
    setProgress(0);
    try {
      const payload: Record<string, any> = { caption: caption.trim() };
      if (video) {
        setStage("Video yuklanmoqda");
        payload.video_url = await uploadVideoDirect(video.file, { folder: "posts", onProgress: setProgress, signal: ctrl.signal });
        const posterBlob = video.poster ?? (await posterPromiseRef.current);
        payload.video_thumbnail_url = posterBlob ? await uploadPoster(posterBlob, "posts") : null;
        payload.video_duration = Math.round(video.meta.duration);
      } else if (images.length > 0) {
        setStage("Rasmlar yuklanmoqda");
        const urls: string[] = [];
        for (let i = 0; i < images.length; i++) { urls.push(await uploadImage(images[i].file, "posts")); setProgress((i + 1) / images.length); }
        payload.images = urls;
      }
      setStage("Saqlanmoqda");
      const res = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || "Post yaratishda xatolik"); }
      toast.success("Post joylandi!");
      router.push("/posts");
    } catch (e: any) {
      if (e?.code !== "ABORTED" && e?.name !== "AbortError") toast.error(e?.message || "Xatolik");
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  if (!ready || !user) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;

  const tile = "h-[120px] rounded-xl border-2 border-dashed border-lime/50 flex flex-col items-center justify-center gap-1 transition-colors";
  return (
    <div className="container-main py-6 max-w-xl">
      <Link href="/posts" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white mb-4"><ChevronLeft className="h-3.5 w-3.5" />Postlar</Link>

      {/* 1) Sarlavha */}
      <h1 className="text-page-title">Post yaratish</h1>
      <p className="text-sm text-white/40 mt-1 mb-6">Rasm, video yoki faqat matn bilan joylashingiz mumkin</p>

      {/* 2) Tanlangan rasm/video — kesilmaydi (fit) */}
      {video ? (
        <div className="mb-4" data-testid="video-preview">
          <video src={video.url} poster={video.posterUrl} controls playsInline className="w-full max-h-[60vh] object-contain rounded-xl bg-black" />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-white/40">{formatDuration(video.meta.duration)} · {formatBytes(video.file.size)}</p>
            {!uploading && <button type="button" onClick={removeVideo} className="text-[11px] text-white/40 hover:text-red-400 flex items-center gap-1"><Trash2 className="h-3 w-3" />Olib tashlash</button>}
          </div>
        </div>
      ) : images.length > 0 ? (
        <div className="mb-4" data-testid="images-preview">
          <div className="rounded-xl overflow-hidden"><Carousel images={images.map((i) => i.url)} /></div>
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <div key={img.url} className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-black">
                <img src={img.url} alt="" className="w-full h-full object-contain" />
                {!uploading && <button type="button" onClick={() => removeImage(i)} aria-label={`${i + 1}-rasmni olib tashlash`} className="on-image absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center"><X className="h-3 w-3 text-white" /></button>}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 3) Ikki katta plitka: Rasm (5 tagacha) va Video (3 daqiqagacha) — birga emas */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button type="button" onClick={() => imageRef.current?.click()} disabled={!!video || imagesFull || uploading} data-testid="tile-image"
          className={cn(tile, "hover:bg-lime-subtle disabled:opacity-40 disabled:hover:bg-transparent")}>
          <Camera className="h-7 w-7 text-lime" />
          <span className="text-sm font-medium">Rasm</span>
          <span className="text-[11px] text-white/40">{images.length > 0 ? `${images.length}/${MAX_POST_IMAGES}` : `${MAX_POST_IMAGES} tagacha`}</span>
        </button>
        <button type="button" onClick={() => videoRef.current?.click()} disabled={images.length > 0 || preparing || uploading} data-testid="tile-video"
          className={cn(tile, "hover:bg-lime-subtle disabled:opacity-40 disabled:hover:bg-transparent")}>
          {preparing ? <Loader2 className="h-7 w-7 text-lime animate-spin" /> : <Video className="h-7 w-7 text-lime" />}
          <span className="text-sm font-medium">{preparing ? "Tekshirilmoqda..." : video ? "Boshqa video" : "Video"}</span>
          <span className="text-[11px] text-white/40">{formatDuration(VIDEO_POST_MAX_SECONDS)} gacha</span>
        </button>
        <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addImages} className="hidden" data-testid="input-image" />
        <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm" onChange={pickVideo} className="hidden" data-testid="input-video" />
      </div>

      {/* 4) ENG PASTDA — Matn */}
      <label htmlFor="post-caption" className="block text-sm font-medium mb-2">Matn</label>
      <textarea id="post-caption" value={caption} onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))} rows={captionRows(caption)} maxLength={MAX_CAPTION}
        placeholder="Fikringizni yozing... #hashtag qo'shishingiz mumkin" disabled={uploading} data-testid="caption-input"
        className="input-field resize-none text-sm overflow-y-auto" />
      <p className="text-right text-[11px] text-white/30 mt-1" data-testid="caption-counter">{caption.length}/{MAX_CAPTION}</p>

      {uploading && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-lime transition-all duration-200" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <p className="text-[11px] text-white/40 mt-1.5">{stage}{stage !== "Saqlanmoqda" ? ` · ${Math.round(progress * 100)}%` : ""}</p>
        </div>
      )}

      <button type="button" onClick={submit} disabled={!canSubmit} data-testid="submit-post" className="btn-lime w-full mt-4 !py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-30">
        {uploading && <Loader2 className="h-4 w-4 animate-spin" />}{uploading ? "Yuklanmoqda..." : "Joylash"}
      </button>
    </div>
  );
}
