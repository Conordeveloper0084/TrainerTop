"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StarRating } from "@/components/ui/StarRating";
import { PLATFORM_COMMENT_MAX } from "@/lib/platform-reviews";

// Profilda: "TrainerTop ni baholang" — 5 yulduz + izoh. Bir foydalanuvchi — bitta baho (keyin o'zgartirish yoki o'chirish mumkin).
export function PlatformRatingCard() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<{ rating: number; comment: string | null } | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/platform-reviews/mine"); const d = res.ok ? await res.json() : null;
        if (!alive) return;
        if (d) { setSaved(d); setRating(d.rating); setComment(d.comment || ""); }
      } catch {} finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const dirty = !saved || saved.rating !== rating || (saved.comment || "") !== comment.trim();

  const save = async () => {
    if (!rating || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/platform-reviews/mine", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, comment: comment.trim() || undefined }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Saqlanmadi"); return; }
      setSaved({ rating, comment: comment.trim() || null }); toast.success(d.created ? "Bahoyingiz uchun rahmat!" : "Baho yangilandi");
    } catch { toast.error("Saqlanmadi"); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm("Bahoyingiz o'chirilsinmi?")) return;
    const res = await fetch("/api/platform-reviews/mine", { method: "DELETE" });
    if (!res.ok) { toast.error("O'chirilmadi"); return; }
    setSaved(null); setRating(0); setComment(""); toast.success("Baho o'chirildi");
  };

  if (loading) return null;
  return (
    <div className="card p-5 mb-6" data-testid="platform-rating">
      <h2 className="text-sm font-semibold mb-0.5">TrainerTop ni baholang</h2>
      <p className="text-xs text-white/40 mb-3">Platforma sizga qanchalik yoqdi? Fikringiz bizni yaxshilaydi.</p>
      <StarRating value={rating} onChange={setRating} size={26} />
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={PLATFORM_COMMENT_MAX} rows={3} aria-label="Izoh" placeholder="Izoh (ixtiyoriy)" className="input-field text-sm resize-none mt-3" />
      <div className="flex items-center gap-3 mt-2">
        <span className="text-[10px] text-white/30">{comment.length}/{PLATFORM_COMMENT_MAX}</span>
        {saved && <button onClick={remove} className="text-[11px] text-white/40 hover:text-red-400 underline ml-auto">O'chirish</button>}
        <button onClick={save} disabled={!rating || !dirty || busy} className={`btn-lime !py-2 !px-5 text-xs flex items-center gap-1.5 disabled:opacity-40 ${saved ? "" : "ml-auto"}`}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{saved ? "Yangilash" : "Yuborish"}
        </button>
      </div>
    </div>
  );
}
