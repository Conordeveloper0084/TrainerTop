"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Search, Flag, Users, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { groupHealth } from "@/lib/group-health";
import { reasonLabel } from "@/lib/chat-moderation";

const TONE: Record<string, string> = { green: "bg-lime/15 text-lime", yellow: "bg-yellow-500/15 text-yellow-500", gray: "bg-white/[0.06] text-white/50", red: "bg-red-500/15 text-red-400" };
const SORTS = [["activity", "Faollik (7 kun)"], ["members", "A'zolar"], ["messages", "Xabarlar"], ["reports", "Shikoyatlar"]] as const;
const RSTATUS = [["open", "Ochiq"], ["actioned", "Chora ko'rilgan"], ["dismissed", "Rad etilgan"]] as const;

// Admin: guruhlar ro'yxati + statistika, va xabarlarga shikoyatlar
export default function AdminGroupsPage() {
  const [tab, setTab] = useState<"groups" | "reports">("groups");
  const [q, setQ] = useState(""); const [sort, setSort] = useState("activity");
  const [rows, setRows] = useState<any[]>([]); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true);
  const [rstatus, setRstatus] = useState("open"); const [reports, setReports] = useState<any[]>([]); const [rcounts, setRcounts] = useState({ open: 0, dismissed: 0, actioned: 0 });

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/groups?q=${encodeURIComponent(q)}&sort=${sort}`); const d = await res.json();
      if (res.ok) { setRows(d.rows || []); setTotal(d.total || 0); } else toast.error(d.message || "Yuklab bo'lmadi");
    } catch { toast.error("Yuklab bo'lmadi"); } finally { setLoading(false); }
  }, [q, sort]);
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?status=${rstatus}`); const d = await res.json();
      if (res.ok) { setReports(d.reports || []); setRcounts(d.counts || { open: 0, dismissed: 0, actioned: 0 }); } else toast.error(d.message || "Yuklab bo'lmadi");
    } catch { toast.error("Yuklab bo'lmadi"); } finally { setLoading(false); }
  }, [rstatus]);

  useEffect(() => { if (tab === "groups") { const t = setTimeout(loadGroups, q ? 300 : 0); return () => clearTimeout(t); } void loadReports(); }, [tab, loadGroups, loadReports, q]);
  useEffect(() => { void (async () => { try { const r = await fetch("/api/admin/reports?status=open"); if (r.ok) setRcounts((await r.json()).counts); } catch {} })(); }, []);

  const setReport = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) { toast.error("Xatolik"); return; } void loadReports();
  };
  const deleteMessage = async (r: any) => {
    if (!r.message_id || !window.confirm("Xabar hamma uchun o'chiriladi (fayli ham). Davom etasizmi?")) return;
    const res = await fetch(`/api/admin/messages/${r.message_id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.message || "O'chirib bo'lmadi"); return; }
    toast.success("Xabar o'chirildi"); void loadReports();
  };

  return (
    <div>
      <h1 className="text-lg font-bold mb-4">Guruhlar</h1>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("groups")} className={cn("px-3 py-1.5 rounded-lg text-xs border flex items-center gap-1.5", tab === "groups" ? "bg-lime-muted text-lime border-lime/30 font-semibold" : "border-white/[0.08] text-white/50")}><Users className="h-3.5 w-3.5" />Guruhlar</button>
        <button onClick={() => setTab("reports")} className={cn("px-3 py-1.5 rounded-lg text-xs border flex items-center gap-1.5", tab === "reports" ? "bg-lime-muted text-lime border-lime/30 font-semibold" : "border-white/[0.08] text-white/50")}><Flag className="h-3.5 w-3.5" />Shikoyatlar{rcounts.open > 0 && <span className="px-1.5 rounded-full bg-red-500 text-white text-[10px]">{rcounts.open}</span>}</button>
      </div>

      {tab === "groups" ? (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Guruh, darslik yoki trener..." className="input-field !py-1.5 !pl-8 text-xs w-64" /></div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field !py-1.5 text-xs w-auto" aria-label="Saralash">{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <span className="text-[11px] text-white/30 ml-auto">Jami: {total}</span>
          </div>
          {loading ? <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin text-lime mx-auto" /></div> : rows.length === 0 ? <p className="text-xs text-white/30 py-10 text-center">Guruh topilmadi</p> : (
            <div className="space-y-2">
              {rows.map((r) => { const h = groupHealth(r); return (
                <Link key={r.id} href={`/admin/groups/${r.id}`} data-testid="group-row" className="card p-4 block hover:border-lime/30 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm truncate">{r.name}</p>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0", TONE[h.tone])}>{h.label}</span>
                    {r.open_reports > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 shrink-0 flex items-center gap-1"><Flag className="h-2.5 w-2.5" />{r.open_reports}</span>}
                  </div>
                  <p className="text-[11px] text-white/40 truncate mb-2">{r.lesson_title} · Trener: {r.owner_name}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    {([["A'zo", r.members], ["Chiqarilgan", r.removed], ["Cheklangan", r.muted], ["Xabar (7k)", r.messages_7d], ["Yozgan (7k)", r.senders_7d], ["Trener xabari", r.owner_msgs_7d]] as const).map(([l, v]) => (
                      <div key={l}><p className="text-sm font-bold">{v}</p><p className="text-[9px] text-white/30">{l}</p></div>
                    ))}
                  </div>
                </Link>
              ); })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-2 mb-3">{RSTATUS.map(([k, l]) => <button key={k} onClick={() => setRstatus(k)} className={cn("px-3 py-1.5 rounded-lg text-xs border", rstatus === k ? "bg-lime-muted text-lime border-lime/30" : "border-white/[0.08] text-white/50")}>{l}<span className="ml-1.5 opacity-70">{rcounts[k as "open" | "dismissed" | "actioned"]}</span></button>)}</div>
          {loading ? <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin text-lime mx-auto" /></div> : reports.length === 0 ? <p className="text-xs text-white/30 py-10 text-center">Shikoyat yo'q</p> : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r.id} className="card p-4" data-testid="report-row">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">{reasonLabel(r.reason)}</span>
                    {r.group ? <Link href={`/admin/groups/${r.group.id}`} className="text-[11px] text-lime hover:underline flex items-center gap-1"><MessageSquare className="h-3 w-3" />{r.group.name}</Link> : <span className="text-[11px] text-white/40">Shaxsiy chat</span>}
                    <span className="text-[10px] text-white/30 ml-auto">{new Date(r.created_at).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="bg-dark-card rounded-lg p-3 mb-2">
                    <p className="text-[10px] text-white/30 mb-1">{r.reported?.full_name || "Foydalanuvchi"} yozgan {r.snapshot?.type && r.snapshot.type !== "text" ? `(${r.snapshot.type})` : ""}:</p>
                    {r.snapshot?.content ? <p className="text-sm whitespace-pre-line break-words">{r.snapshot.content}</p> : <p className="text-xs text-white/30 italic">{r.snapshot?.media_url ? <a href={r.snapshot.media_url} target="_blank" rel="noreferrer" className="text-lime underline">Faylni ochish</a> : "Matn yo'q"}</p>}
                  </div>
                  <p className="text-[11px] text-white/40 mb-2">Shikoyat qilgan: {r.reporter?.full_name || "—"}{r.note ? ` — «${r.note}»` : ""}</p>
                  {r.status === "open" ? (
                    <div className="flex flex-wrap gap-2">
                      {r.message_id && <button onClick={() => deleteMessage(r)} className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20">Xabarni o'chirish</button>}
                      <button onClick={() => setReport(r.id, "actioned")} className="px-3 py-1.5 rounded-lg text-xs bg-lime/10 text-lime border border-lime/20">Chora ko'rildi</button>
                      <button onClick={() => setReport(r.id, "dismissed")} className="px-3 py-1.5 rounded-lg text-xs border border-white/[0.1] text-white/60">Rad etish</button>
                    </div>
                  ) : <button onClick={() => setReport(r.id, "open")} className="text-[11px] text-white/40 underline">Qayta ochish</button>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
