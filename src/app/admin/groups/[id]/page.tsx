"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Sparkles, ShieldAlert, UserPlus, Flag, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ImageViewer } from "@/components/chat/ImageViewer";
import { ModerationDialog, type ModerationSubmit } from "@/components/chat/ModerationDialog";
import { formatUntil, reasonLabel } from "@/lib/chat-moderation";
import { formatResponseTime } from "@/lib/group-health";
import { CHAT_PAGE_SIZE } from "@/lib/constants";
import { mergeMessages, type ChatMessage } from "@/lib/chat-client";

const STATE: Record<string, [string, string]> = { owner: ["Trener", "bg-lime/15 text-lime"], active: ["Faol", "bg-white/[0.06] text-white/60"], muted: ["Cheklangan", "bg-orange-500/15 text-orange-400"], expired: ["Obuna tugagan", "bg-yellow-500/15 text-yellow-500"], removed: ["Chiqarilgan", "bg-red-500/15 text-red-400"], left: ["Chiqib ketgan", "bg-white/[0.06] text-white/30"] };
const VERDICT: Record<string, [string, string]> = { foydali: ["Foydali", "bg-lime/15 text-lime"], aralash: ["Aralash", "bg-yellow-500/15 text-yellow-500"], mavzudan_tashqari: ["Mavzudan tashqari", "bg-orange-500/15 text-orange-400"], muammoli: ["Muammoli", "bg-red-500/15 text-red-400"] };
const ACTION_LABEL: Record<string, string> = { mute: "cheklandi", unmute: "cheklov olindi", remove: "chiqarildi", restore: "qaytarildi" };

// Admin: bitta guruh — statistika, BARCHA xabarlarni o'qish, a'zolarga chora, AI tahlil
export default function AdminGroupDetailPage() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<"messages" | "members" | "ai">("messages");
  const [messages, setMessages] = useState<ChatMessage[]>([]); const [hasMore, setHasMore] = useState(false); const [msgLoading, setMsgLoading] = useState(false);
  const [members, setMembers] = useState<any[] | null>(null); const [actions, setActions] = useState<any[]>([]);
  const [dialogFor, setDialogFor] = useState<any>(null); const [viewer, setViewer] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null); const [analyzing, setAnalyzing] = useState(false);

  const loadMain = useCallback(async () => {
    const res = await fetch(`/api/admin/groups/${id}`); const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.message || "Guruh topilmadi"); return; }
    setData(d); setAnalysis(d.analysis);
  }, [id]);
  const loadMessages = async (before?: string) => {
    setMsgLoading(true);
    try {
      const res = await fetch(`/api/admin/groups/${id}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`); const d = await res.json().catch(() => []);
      const list: ChatMessage[] = Array.isArray(d) ? d : [];
      setMessages((prev) => mergeMessages(before ? prev : [], list)); setHasMore(list.length >= CHAT_PAGE_SIZE);
    } finally { setMsgLoading(false); }
  };
  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/admin/groups/${id}/members`); const d = await res.json().catch(() => ({}));
    if (res.ok) { setMembers(d.members || []); setActions(d.actions || []); }
  }, [id]);
  useEffect(() => { void loadMain(); void loadMessages(); void loadMembers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const moderate = async (m: any, body: Record<string, any>): Promise<boolean> => {
    const res = await fetch(`/api/admin/groups/${id}/members/${m.user_id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.message || "Xatolik"); return false; }
    await loadMembers(); void loadMain(); return true;
  };
  const submitDialog = async (b: ModerationSubmit) => { if (dialogFor && (await moderate(dialogFor, b))) { toast.success("Chora ko'rildi"); setDialogFor(null); } };
  const deleteMessage = async (mid: string) => {
    if (!window.confirm("Xabar hamma uchun o'chiriladi (fayli ham). Davom etasizmi?")) return;
    const res = await fetch(`/api/admin/messages/${mid}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.message || "O'chirib bo'lmadi"); return; }
    setMessages((prev) => prev.map((m) => (m.id === mid ? { ...m, deleted_at: new Date().toISOString(), content: null, media_url: null, thumb_url: null, image_url: null } : m)));
  };
  const toggleArchive = async () => {
    const archived = !data.group.is_archived;
    if (archived && !window.confirm("Guruh yopiladi: hech kim (trener ham) kira olmaydi. Xabarlar saqlanadi. Davom etasizmi?")) return;
    const res = await fetch(`/api/admin/groups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived }) });
    if (res.ok) { toast.success(archived ? "Guruh yopildi" : "Guruh qayta ochildi"); void loadMain(); } else toast.error("Xatolik");
  };
  const analyze = async (force = false) => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/admin/groups/${id}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Tahlil ishlamadi"); return; }
      setAnalysis(d); if (d.cached && !force) toast.info("Saqlangan tahlil ko'rsatildi (1 soatdan yangi)");
    } catch { toast.error("Tahlil ishlamadi"); } finally { setAnalyzing(false); }
  };

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;
  const { group, stats } = data; const ownerId = group.owner?.id; const ai = analysis?.result;
  const maxDay = Math.max(1, ...((stats?.daily || []).map((d: any) => d.count)));

  return (
    <div>
      <Link href="/admin/groups" className="text-xs text-white/40 hover:text-white flex items-center gap-1 mb-3"><ArrowLeft className="h-3.5 w-3.5" />Guruhlar</Link>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="min-w-0"><h1 className="text-lg font-bold truncate">{group.name}</h1><p className="text-xs text-white/40">{group.lesson?.title} · Trener: {group.owner?.full_name}</p></div>
        <button onClick={toggleArchive} className={cn("ml-auto px-3 py-1.5 rounded-lg text-xs border", group.is_archived ? "bg-lime/10 text-lime border-lime/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>{group.is_archived ? "Qayta ochish" : "Guruhni yopish"}</button>
      </div>

      {stats && (
        <div className="card p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div><p className="text-[10px] text-white/30">Trener javob tezligi (30 kun)</p><p className="text-sm font-bold" data-testid="response-time">{formatResponseTime(stats.response_median_seconds)}</p><p className="text-[10px] text-white/30">{stats.answered_within_48h}/{stats.member_msgs_30d} xabarga 48 soatda javob</p></div>
            <div><p className="text-[10px] text-white/30">Xabar turlari (30 kun)</p><p className="text-xs">💬 {stats.media_30d?.text} · 📷 {stats.media_30d?.image} · 🎤 {stats.media_30d?.voice} · 🎬 {stats.media_30d?.video}</p></div>
            <div><p className="text-[10px] text-white/30">O'chirilgan xabarlar</p><p className="text-sm font-bold">{stats.deleted_total}</p></div>
            <div><p className="text-[10px] text-white/30">Ochiq shikoyatlar / chora</p><p className="text-sm font-bold">{stats.open_reports} / {stats.actions_total}</p></div>
          </div>
          <p className="text-[10px] text-white/30 mb-1">Oxirgi 14 kun (xabarlar)</p>
          <div className="flex items-end gap-1 h-12" aria-label="Kunlik xabarlar">{(stats.daily || []).map((d: any) => <div key={d.day} title={`${d.day}: ${d.count}`} className="flex-1 bg-lime/40 rounded-sm" style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%` }} />)}</div>
          {stats.top_senders?.length > 0 && <p className="text-[11px] text-white/40 mt-3">Eng faol: {stats.top_senders.map((s: any) => `${s.name}${s.is_owner ? " (trener)" : ""} — ${s.count}`).join(" · ")}</p>}
        </div>
      )}

      <div className="flex gap-2 mb-3">
        {([["messages", "Xabarlar"], ["members", "A'zolar va chora tarixi"], ["ai", "AI tahlil"]] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn("px-3 py-1.5 rounded-lg text-xs border", tab === k ? "bg-lime-muted text-lime border-lime/30 font-semibold" : "border-white/[0.08] text-white/50")}>{l}</button>)}
      </div>

      {tab === "messages" && (
        <div className="card p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {hasMore && <div className="text-center"><button onClick={() => loadMessages(messages[0]?.created_at)} disabled={msgLoading} className="text-xs text-lime/80 disabled:opacity-40">Oldingi xabarlar</button></div>}
          {msgLoading && messages.length === 0 ? <Loader2 className="h-5 w-5 animate-spin text-lime mx-auto" /> : messages.length === 0 ? <p className="text-xs text-white/30 text-center py-6">Guruhda xabar yo'q</p> :
            messages.map((m) => <MessageBubble key={m.id} msg={m} mine={false} isGroup ownerId={ownerId} canDelete onDelete={deleteMessage} onOpenImage={setViewer} />)}
        </div>
      )}

      {tab === "members" && (
        <div className="space-y-4">
          <div className="card divide-y divide-white/[0.04]">
            {members === null ? <div className="p-6 text-center"><Loader2 className="h-4 w-4 animate-spin text-lime mx-auto" /></div> : members.map((m) => {
              const [label, cls] = STATE[m.state] || [m.state, ""];
              return (
                <div key={m.user_id} className="p-3 flex items-center gap-3" data-testid="admin-member-row">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{m.full_name} <span className={cn("ml-1.5 text-[10px] px-2 py-0.5 rounded-full", cls)}>{label}</span></p>
                    {m.state === "muted" && <p className="text-[10px] text-orange-400">{formatUntil(m.muted_until)} gacha · {reasonLabel(m.mod_reason)}{m.mod_by_admin ? " · admin" : ""}</p>}
                    {m.state === "removed" && <p className="text-[10px] text-red-400/80">{reasonLabel(m.mod_reason)}{m.mod_note ? ` — ${m.mod_note}` : ""}{m.mod_by_admin ? " · admin chiqargan" : " · trener chiqargan"}</p>}
                  </div>
                  {m.role !== "owner" && m.status !== "left" && (m.state === "removed"
                    ? <button onClick={async () => { if (await moderate(m, { action: "restore" })) toast.success("Qaytarildi"); }} aria-label={`${m.full_name} ni qaytarish`} className="p-1.5 text-white/40 hover:text-lime"><UserPlus className="h-4 w-4" /></button>
                    : <button onClick={() => setDialogFor(m)} aria-label={`${m.full_name} ga chora ko'rish`} className="p-1.5 text-white/30 hover:text-red-400"><ShieldAlert className="h-4 w-4" /></button>)}
                </div>
              );
            })}
          </div>
          <div className="card p-4"><p className="text-xs font-semibold mb-2">Chora tarixi</p>
            {actions.length === 0 ? <p className="text-xs text-white/30">Hali chora ko'rilmagan</p> : <ul className="space-y-1.5">{actions.map((a) => {
              const who = members?.find((x) => x.user_id === a.user_id)?.full_name || "A'zo";
              return <li key={a.id} className="text-[11px] text-white/50 flex items-center gap-2"><VolumeX className="h-3 w-3 shrink-0" />{who} — {ACTION_LABEL[a.action]}{a.reason ? ` (${reasonLabel(a.reason)})` : ""} · {a.actor_is_admin ? "admin" : "trener"} · {new Date(a.created_at).toLocaleDateString("uz-UZ")}</li>;
            })}</ul>}
          </div>
        </div>
      )}

      {tab === "ai" && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => analyze(false)} disabled={analyzing} className="btn-lime !py-2 text-xs flex items-center gap-1.5 disabled:opacity-40">{analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{ai ? "Tahlilni ko'rsatish" : "AI tahlil qilish"}</button>
            {ai && <button onClick={() => analyze(true)} disabled={analyzing} className="text-[11px] text-white/40 underline">Yangilash</button>}
            <p className="text-[10px] text-white/30 ml-auto">Oxirgi ~100 ta matnli xabar; ismlar AI'ga yuborilmaydi</p>
          </div>
          {!ai ? <p className="text-xs text-white/30">Hali tahlil qilinmagan. Guruh foydali yoki mavzudan tashqari ekanini AI xulosalaydi (bosgandagina ishlaydi).</p> : (
            <div className="space-y-3" data-testid="ai-result">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", (VERDICT[ai.verdict] || VERDICT.aralash)[1])}>{(VERDICT[ai.verdict] || VERDICT.aralash)[0]}</span>
                <span className="text-xs text-white/60">Mavzuga oid: <b>{ai.on_topic_percent}%</b></span><span className="text-xs text-white/60">Trener ishtiroki: <b>{ai.trainer_engagement}</b></span>
                <span className="text-[10px] text-white/30 ml-auto">{analysis.message_count} ta xabar · {new Date(analysis.created_at).toLocaleString("uz-UZ")}</span>
              </div>
              <p className="text-sm text-white/80">{ai.summary}</p>
              {ai.topics?.length > 0 && <div className="flex flex-wrap gap-1.5">{ai.topics.map((t: string) => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60">{t}</span>)}</div>}
              {ai.off_topic_examples?.length > 0 && <div><p className="text-[11px] text-white/40 mb-1">Mavzudan tashqari misollar</p><ul className="text-xs text-white/60 list-disc pl-4 space-y-0.5">{ai.off_topic_examples.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul></div>}
              {ai.concerns?.length > 0 && <div className="bg-red-500/[0.06] border border-red-500/20 rounded-lg p-3"><p className="text-[11px] text-red-400 mb-1 flex items-center gap-1"><Flag className="h-3 w-3" />E'tibor talab qiladi</p><ul className="text-xs text-white/70 space-y-0.5">{ai.concerns.map((c: any, i: number) => <li key={i}>{c.type}: {c.note}</li>)}</ul></div>}
              {ai.recommendation && <p className="text-xs text-lime/90">Tavsiya: {ai.recommendation}</p>}
            </div>
          )}
        </div>
      )}

      {dialogFor && <ModerationDialog memberName={dialogFor.full_name} isMuted={dialogFor.state === "muted"} onSubmit={submitDialog} onClose={() => setDialogFor(null)} />}
      {viewer && <ImageViewer url={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
