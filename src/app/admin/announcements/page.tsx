"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Bell, X, Search, Trash2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { ANNOUNCE_TITLE_MAX, ANNOUNCE_BODY_MAX, ANNOUNCE_LABEL_MAX, safeLink } from "@/lib/announcements";

const newToken = () => (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
  ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));

// Admin › E'lonlar: BITTA foydalanuvchiga shaxsiy bildirishnoma (chatida "rasmiy" xabar sifatida
// ko'rinadi). Rasmiy kanal (hammaga, Telegram uslubida) — alohida, Admin › Rasmiy kanal sahifasida.
export default function AdminAnnouncementsPage() {
  const [search, setSearch] = useState(""); const [found, setFound] = useState<any[]>([]); const [target, setTarget] = useState<any>(null);
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [link, setLink] = useState(""); const [label, setLabel] = useState("");
  const [sending, setSending] = useState(false);
  const [token, setToken] = useState(newToken());
  const [rows, setRows] = useState<any[]>([]); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/announcements"); const d = await res.json().catch(() => ({}));
      if (res.ok) { const userRows = (d.rows || []).filter((r: any) => r.kind === "user"); setRows(userRows); setTotal(userRows.length); } else toast.error(d.message || "Tarixni yuklab bo'lmadi");
    } catch { toast.error("Tarixni yuklab bo'lmadi"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  // Foydalanuvchi qidirish (kamida 2 belgi, kechiktirib)
  useEffect(() => {
    if (target || search.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(async () => {
      try { const res = await fetch(`/api/admin/users?search=${encodeURIComponent(search.trim())}`); const d = await res.json().catch(() => []); setFound(res.ok && Array.isArray(d) ? d.slice(0, 8) : []); } catch { setFound([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [search, target]);

  const linkOk = !link.trim() || !!safeLink(link);
  const valid = !!target && title.trim().length <= ANNOUNCE_TITLE_MAX && !!body.trim() && body.trim().length <= ANNOUNCE_BODY_MAX
    && linkOk && label.trim().length <= ANNOUNCE_LABEL_MAX;

  const send = async () => {
    if (!valid || sending) return;
    if (!window.confirm(`${target.full_name} ga yuborilsinmi?`)) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "user", target_user_id: target.id, title: title.trim() || undefined, body: body.trim(), link_url: link.trim() || undefined, link_label: label.trim() || undefined, client_token: token }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Yuborilmadi"); return; }
      toast.success(d.duplicate ? "Bu xabar allaqachon yuborilgan" : "E'lon yuborildi");
      setTitle(""); setBody(""); setLink(""); setLabel(""); setTarget(null); setSearch(""); setToken(newToken());
      void loadHistory();
    } catch { toast.error("Yuborilmadi"); } finally { setSending(false); }
  };

  const remove = async (r: any) => {
    if (!window.confirm(`«${r.title || "Bu xabar"}» o'chiriladi. Davom etasizmi?`)) return;
    const res = await fetch(`/api/admin/announcements/${r.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.message || "O'chirilmadi"); return; }
    toast.success("E'lon o'chirildi"); void loadHistory();
  };

  return (
    <div>
      <h1 className="text-lg font-bold mb-1 flex items-center gap-2"><Bell className="h-5 w-5 text-lime" />E'lonlar</h1>
      <p className="text-xs text-white/40 mb-5">Bitta foydalanuvchiga shaxsiy bildirishnoma yuborish. Hammaga post — Admin › Rasmiy kanal sahifasida.</p>

      <div className="card p-4 space-y-4 mb-8 max-w-xl">
        <div>
          {target ? (
            <div className="flex items-center gap-2 bg-dark-card rounded-lg px-3 py-2 text-sm" data-testid="picked-user">
              <span className="flex-1 truncate">{target.full_name} <span className="text-white/30 text-xs">{target.email}</span></span>
              <button onClick={() => setTarget(null)} aria-label="Tanlovni bekor qilish" className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ism yoki email (kamida 2 belgi)" className="input-field !pl-9 text-sm" aria-label="Foydalanuvchini qidirish" />
              {found.length > 0 && (
                <ul className="mt-1 bg-dark-card rounded-lg border border-white/[0.06] max-h-48 overflow-y-auto" role="listbox">
                  {found.map((u) => <li key={u.id}><button onClick={() => { setTarget(u); setFound([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-white/[0.04]">{u.full_name} <span className="text-white/30 text-xs">{u.email} · {u.role}</span></button></li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={ANNOUNCE_TITLE_MAX} placeholder="Sarlavha (ixtiyoriy)" className="input-field text-sm" aria-label="Sarlavha" />
          <p className="text-[10px] text-white/30 text-right mt-0.5">{title.length}/{ANNOUNCE_TITLE_MAX}</p>
        </div>
        <div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={ANNOUNCE_BODY_MAX} rows={5} placeholder="Xabar matni..." className="input-field text-sm resize-none" aria-label="Matn" />
          <p className="text-[10px] text-white/30 text-right mt-0.5">{body.length}/{ANNOUNCE_BODY_MAX}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Havola: /lessons yoki https://..." className={cn("input-field text-sm", !linkOk && "!border-red-500/60")} aria-label="Havola" />
            {!linkOk && <p className="text-[10px] text-red-400 mt-0.5">Faqat sayt ichidagi yo'l (/...) yoki https://</p>}</div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={ANNOUNCE_LABEL_MAX} placeholder="Tugma yozuvi (masalan: Ko'rish)" className="input-field text-sm" aria-label="Tugma yozuvi" />
        </div>

        <button onClick={send} disabled={!valid || sending} className="btn-lime w-full !py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-40">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Yuborish
        </button>
      </div>

      <h2 className="text-sm font-semibold mb-3">Yuborilgan e'lonlar {total > 0 && <span className="text-white/30 font-normal">({total})</span>}</h2>
      {loading ? <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin text-lime mx-auto" /></div> : rows.length === 0 ? <p className="text-xs text-white/30 py-6">Hali e'lon yuborilmagan</p> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className={cn("card p-4", r.deleted_at && "opacity-50")} data-testid="announcement-row">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-sky-500/15 text-sky-400">Shaxsiy → {r.target_name || "?"}</span>
                {r.deleted_at && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">O'chirilgan</span>}
                <span className="text-[10px] text-white/30 ml-auto">{new Date(r.created_at).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {r.title && <p className={cn("text-sm font-semibold", r.deleted_at && "line-through")}>{r.title}</p>}
              <p className="text-xs text-white/50 line-clamp-2 whitespace-pre-line">{r.body}</p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
                <span>{Number(r.reads) > 0 ? "Ochib ko'rgan" : "Hali ochmagan"}</span>
                {r.created_by_name && <span>Yubordi: {r.created_by_name}</span>}
                {!r.deleted_at && <button onClick={() => remove(r)} aria-label={`«${r.title || "Bu xabar"}» ni o'chirish`} className="ml-auto text-red-400/70 hover:text-red-400 flex items-center gap-1"><Trash2 className="h-3 w-3" />O'chirish</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
