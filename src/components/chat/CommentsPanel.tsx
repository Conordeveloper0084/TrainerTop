"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getInitials, timeAgo } from "@/lib/utils";
import { COMMENT_MAX, type AnnouncementComment } from "@/lib/announcements";

// Kanal postiga izohlar — Telegram uslubidagi alohida panel (post tepada qisqacha, pastda izoh yozish maydoni).
export function CommentsPanel({ announcementId, isAdmin, currentUserId, onBack, onCountChange }: {
  announcementId: string; isAdmin: boolean; currentUserId: string; onBack: () => void; onCountChange?: (n: number) => void;
}) {
  const [comments, setComments] = useState<AnnouncementComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/announcements/${announcementId}/comments`);
        const data = res.ok ? await res.json() : [];
        if (alive) setComments(Array.isArray(data) ? data : []);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [announcementId]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/announcements/${announcementId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Yuborilmadi"); return; }
      setComments((p) => { const next = [...p, d]; onCountChange?.(next.length); return next; }); setText("");
    } catch { toast.error("Yuborilmadi"); } finally { setSending(false); }
  };

  const remove = async (c: AnnouncementComment) => {
    if (!window.confirm("Izoh o'chirilsinmi?")) return;
    const res = await fetch(`/api/announcements/${announcementId}/comments/${c.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.message || "O'chirilmadi"); return; }
    setComments((p) => { const next = p.filter((x) => x.id !== c.id); onCountChange?.(next.length); return next; });
  };

  return (
    <>
      <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
        <button onClick={onBack} aria-label="Orqaga" className="text-white/40 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
        <p className="text-sm font-semibold">Izohlar</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="comments-list">
        {loading ? <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin text-lime mx-auto" /></div>
          : comments.length === 0 ? <p className="text-xs text-white/30 text-center py-10">Hali izoh yo'q. Birinchi bo'lib fikringizni yozing</p>
          : comments.map((c) => (
            <div key={c.id} className="group flex items-start gap-2.5" data-testid="comment-row">
              <div className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center overflow-hidden shrink-0">
                {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-white/20">{getInitials(c.profiles?.full_name || "?")}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold">{c.profiles?.full_name || "Foydalanuvchi"}</p>
                  <p className="text-[10px] text-white/25">{timeAgo(c.created_at)}</p>
                </div>
                <p className="text-sm text-white/70 whitespace-pre-line break-words">{c.body}</p>
              </div>
              {(c.user_id === currentUserId || isAdmin) && (
                <button onClick={() => remove(c)} aria-label="Izohni o'chirish" className="opacity-60 sm:opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity text-white/30 hover:text-red-400 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
      </div>
      <div className="p-3 border-t border-white/[0.06] flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={COMMENT_MAX} placeholder="Izoh yozing..." aria-label="Izoh yozing"
          className="input-field !py-2.5 text-sm flex-1" onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        <button onClick={send} disabled={!text.trim() || sending} aria-label="Yuborish" className="!p-2.5 rounded-button bg-lime text-black disabled:opacity-30 shrink-0">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </>
  );
}
