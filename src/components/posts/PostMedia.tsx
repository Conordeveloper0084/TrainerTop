"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/upload";
import { clampRatio, DEFAULT_RATIO, getCachedRatio, rememberRatio } from "@/lib/image-ratio";

// Bir vaqtning o'zida faqat bitta video o'ynaydi (feed'da bir nechta video bo'lganda)
let activeVideo: HTMLVideoElement | null = null;

export function PostVideo({ src, poster, duration }: { src: string; poster?: string | null; duration?: number | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  // Ekrandan chiqib ketsa — pauza
  useEffect(() => {
    const el = wrapRef.current;
    const video = ref.current;
    if (!el || !video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && !video.paused) video.pause();
    }, { threshold: 0.25 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (activeVideo === video) activeVideo = null;
    };
  }, []);

  const handlePlay = () => {
    const video = ref.current;
    if (!video) return;
    if (activeVideo && activeVideo !== video) activeVideo.pause();
    activeVideo = video;
    setPlaying(true);
  };

  if (failed) {
    return (
      <div className="w-full aspect-video bg-dark-card flex items-center justify-center px-6 text-center">
        <p className="text-xs text-white/40">Videoni ochib bo'lmadi. Keyinroq qayta urinib ko'ring</p>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative w-full bg-black">
      <video
        ref={ref}
        src={src}
        poster={poster || undefined}
        controls
        playsInline
        controlsList="nodownload"
        preload={poster ? "none" : "metadata"}
        className="w-full max-h-[75vh] object-contain bg-black"
        onPlay={handlePlay}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
      {!playing && duration ? (
        <span className="pointer-events-none absolute bottom-3 right-3 bg-black/70 text-white text-[10px] font-medium rounded px-1.5 py-0.5 flex items-center gap-1">
          <Play className="h-2.5 w-2.5 fill-white" />{formatDuration(duration)}
        </span>
      ) : null}
    </div>
  );
}

// Rasmlar KESILMAYDI (Instagram kabi): karta balandligi BIRINCHI rasmning asl nisbatiga (eni / bo'yi) moslashadi,
// 0.8 (4:5) … 1.91 (1.91:1) oralig'ida cheklanadi; har bir rasm "contain" bilan sig'diriladi, chetlari qora fon.
// Server o'lcham bermaydi — nisbat yuklangan rasmdan olinadi va sessiyada eslab qolinadi (qayta ochilganda sakramaydi).
export function Carousel({ images }: { images: string[] }) {
  const [cur, setCur] = useState(0);
  const [ratio, setRatio] = useState<number>(() => getCachedRatio(images[0]) ?? DEFAULT_RATIO);
  const ts = useRef(0);

  // Birinchi rasm o'zgarsa (boshqa post) — nisbat qaytadan
  useEffect(() => { setRatio(getCachedRatio(images[0]) ?? DEFAULT_RATIO); setCur(0); }, [images[0]]);   // eslint-disable-line react-hooks/exhaustive-deps

  const onFirstLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const r = clampRatio(img.naturalWidth, img.naturalHeight);
    if (img.naturalWidth > 0 && img.naturalHeight > 0) rememberRatio(images[0], r);
    setRatio(r);
  };

  return (
    <div
      className="on-image relative w-full overflow-hidden bg-black"
      style={{ aspectRatio: String(ratio) }}
      data-testid="post-carousel"
      data-ratio={ratio.toFixed(3)}
      onTouchStart={(e) => { ts.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const d = ts.current - e.changedTouches[0].clientX;
        if (d > 50 && cur < images.length - 1) setCur(cur + 1);
        if (d < -50 && cur > 0) setCur(cur - 1);
      }}
    >
      <div className="flex h-full transition-transform duration-300" style={{ transform: `translateX(-${cur * 100}%)` }}>
        {images.map((img, i) => (
          <div key={i} className="w-full h-full shrink-0 bg-black">
            <img src={img} alt="" className="w-full h-full object-contain" draggable={false} data-testid="post-image"
              loading={i === 0 ? "eager" : "lazy"} decoding="async" onLoad={i === 0 ? onFirstLoad : undefined} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          {cur > 0 && <button type="button" aria-label="Oldingi rasm" onClick={() => setCur(cur - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white/80"><ChevronLeft className="h-4 w-4" /></button>}
          {cur < images.length - 1 && <button type="button" aria-label="Keyingi rasm" onClick={() => setCur(cur + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white/80"><ChevronRight className="h-4 w-4" /></button>}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5" data-testid="post-dots">
            {images.map((_, i) => <div key={i} data-active={i === cur ? "true" : "false"} className={cn("rounded-full", i === cur ? "w-2 h-2 bg-lime" : "w-1.5 h-1.5 bg-white/50")} />)}
          </div>
          <div className="absolute top-3 right-3 bg-black/60 rounded-full px-2.5 py-1 text-[10px] text-white" data-testid="post-counter">{cur + 1}/{images.length}</div>
        </>
      )}
    </div>
  );
}

// Postning media qismi: video bo'lsa video, aks holda rasmlar, aks holda hech narsa (null)
export function PostMedia({ post }: { post: { video_url?: string | null; video_thumbnail_url?: string | null; video_duration?: number | null; images?: string[] | null } }) {
  if (post.video_url) {
    return <PostVideo src={post.video_url} poster={post.video_thumbnail_url} duration={post.video_duration} />;
  }
  if (post.images && post.images.length > 0) return <Carousel images={post.images} />;
  return null;
}
