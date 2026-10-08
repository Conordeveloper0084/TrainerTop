"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatVoiceTime } from "@/lib/chat-client";

const RATES = [1, 1.5, 2];

// Ovozli xabar pleyeri: ijro/to'xtatish, surish, tezlik (1× / 1.5× / 2×), ijro etib bo'lmasa — yuklab olish havolasi.
export function VoicePlayer({ src, duration, mine }: { src: string; duration?: number | null; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration || 0);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => { const a = audioRef.current; if (a) a.playbackRate = rate; }, [rate]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      if (a.paused) { await a.play(); } else { a.pause(); }
    } catch { setFailed(true); }
  };

  const accent = mine ? "bg-black/80 text-lime" : "bg-lime text-black";
  const muted = mine ? "text-black/50" : "text-white/40";

  return (
    <div className="flex items-center gap-2.5 min-w-[200px]" data-testid="voice-player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setTotal(d); }}
        onError={() => setFailed(true)}
      />
      {failed ? (
        <a href={src} download className={cn("flex items-center gap-2 text-xs underline", muted)}>
          <Download className="h-3.5 w-3.5" /> Ijro etib bo'lmadi — yuklab olish
        </a>
      ) : (
        <>
          <button onClick={toggle} aria-label={playing ? "To'xtatish" : "Ijro etish"} className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", accent)}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </button>
          <div className="flex-1 min-w-0">
            <input
              type="range" min={0} max={Math.max(1, total)} step={0.1} value={Math.min(current, Math.max(1, total))}
              aria-label="Ovozli xabar"
              onChange={(e) => { const a = audioRef.current; if (a) { a.currentTime = Number(e.target.value); setCurrent(a.currentTime); } }}
              className="w-full h-1 accent-lime cursor-pointer"
            />
            <div className={cn("flex items-center justify-between text-[10px] mt-1", muted)}>
              <span>{formatVoiceTime(playing || current > 0 ? current : total)}</span>
              <button onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])} aria-label="Tezlik" className="px-1.5 rounded bg-white/10 font-semibold">{rate}×</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
