"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, AlertTriangle, Lock } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

interface SecureVideoPlayerProps {
  videoUrl: string;
  title?: string;
  poster?: string;
  onComplete?: () => void;
}

export default function SecureVideoPlayer({ videoUrl, title, poster, onComplete }: SecureVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMsg, setWarningMsg] = useState("");

  // ====== XAVFSIZLIK 1: Right-click off ======
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showSecurityWarning("O'ng tugma ishlamaydi — kontent himoyalangan");
      return false;
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener("contextmenu", handleContextMenu);
      return () => container.removeEventListener("contextmenu", handleContextMenu);
    }
  }, []);

  // ====== XAVFSIZLIK 2: Keyboard shortcuts blokirovkasi ======
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S, Ctrl+Shift+S (save), Ctrl+U (view source), F12, Ctrl+Shift+I (devtools)
      if (
        (e.ctrlKey && (e.key === "s" || e.key === "u" || e.key === "p")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "S" || e.key === "I" || e.key === "C")) ||
        e.key === "F12" ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
        showSecurityWarning("Bu amal cheklangan — kontent himoyalangan");
        return false;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ====== XAVFSIZLIK 3: Screen recording detection (Mobile/iOS) ======
  // iOS Safari'da `screencaptured` event bor (faqat iOS 11+)
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Agar tab'dan chiqib ketsa — to'xtat
      if (document.hidden && videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ====== XAVFSIZLIK 4: DevTools detection (basic) ======
  useEffect(() => {
    let devtoolsOpen = false;
    const threshold = 160;

    const checkDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (widthThreshold || heightThreshold) {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
          }
          showSecurityWarning("Developer tools aniqlandi. Video to'xtatildi.");
        }
      } else {
        devtoolsOpen = false;
      }
    };

    const interval = setInterval(checkDevTools, 1000);
    return () => clearInterval(interval);
  }, []);

  const showSecurityWarning = (msg: string) => {
    setWarningMsg(msg);
    setShowWarning(true);
    setTimeout(() => setShowWarning(false), 3000);
  };

  // ====== Video controls ======
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play();
    setPlaying(!playing);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration;
    setProgress((current / total) * 100);
    if (current >= total - 0.5 && onComplete) onComplete();
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    videoRef.current.currentTime = (percent / 100) * videoRef.current.duration;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Watermark text — user email + IP (qo'rqitish uchun)
  const watermarkText = user?.email || "trainertop.uz";

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group select-none"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => playing && setShowControls(false)}
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoUrl}
        poster={poster}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        disableRemotePlayback
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* WATERMARK — user email + sana */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Markaz watermark (xira) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white/[0.04] text-4xl font-bold rotate-[-25deg] select-none whitespace-nowrap">
            {watermarkText}
          </p>
        </div>

        {/* Burchaklar */}
        <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm px-2 py-1 rounded text-white/40 text-[10px] font-mono">
          {watermarkText}
        </div>
        <div className="absolute bottom-20 left-4 bg-black/40 backdrop-blur-sm px-2 py-1 rounded text-white/30 text-[9px]">
          {new Date().toLocaleString("uz-UZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* Center play overlay */}
      {!playing && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
        >
          <div className="w-20 h-20 rounded-full bg-lime flex items-center justify-center hover:scale-110 transition-transform">
            <Play className="h-8 w-8 text-black ml-1" fill="black" />
          </div>
        </button>
      )}

      {/* Controls */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity",
        showControls ? "opacity-100" : "opacity-0"
      )}>
        {/* Progress bar */}
        <div onClick={handleSeek} className="w-full h-1 bg-white/20 rounded-full mb-3 cursor-pointer group/progress">
          <div className="h-full bg-lime rounded-full relative" style={{ width: `${progress}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-lime rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={togglePlay} className="text-white hover:text-lime">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button onClick={toggleMute} className="text-white hover:text-lime">
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <span className="text-xs text-white/80 font-mono">
            {formatTime((progress / 100) * duration)} / {formatTime(duration)}
          </span>
          <div className="flex-1" />
          {title && <span className="text-xs text-white/60 truncate max-w-xs hidden sm:block">{title}</span>}
          <button onClick={toggleFullscreen} className="text-white hover:text-lime">
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Security warning toast */}
      {showWarning && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg flex items-center gap-2 animate-fade-in-up shadow-2xl">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium">{warningMsg}</span>
        </div>
      )}

      {/* Inline CSS — qo'shimcha himoya */}
      <style jsx>{`
        video::-webkit-media-controls-download-button { display: none; }
        video::-webkit-media-controls-enclosure { overflow: hidden; }
        video {
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
