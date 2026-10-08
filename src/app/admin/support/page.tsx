"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Send, Mail, User, CheckCircle2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORT_LIMITS } from "@/lib/support-constants";

const TABS = [
  { key: "new", label: "Yangi" }, { key: "answered", label: "Javob berilgan" },
  { key: "closed", label: "Yopilgan" }, { key: "all", label: "Hammasi" },
] as const;
const SOURCES = [["all", "Hammasi"], ["web", "Sayt"], ["telegram", "Telegram"]] as const;
const DELIVERY: Record<string, string> = { both: "Qo'ng'iroqcha + email", notification: "Qo'ng'iroqcha", email: "Email", none: "Yetkazilmadi (qo'lda yozing)" };
const fmt = (iso: string) => new Date(iso).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Admin: sayt formasidan kelgan murojaatlar (support). Javob yozish, yopish.
export default function AdminSupportPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("new");
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"all" | "web" | "telegram">("all");
  const [tgInfo, setTgInfo] = useState<{ available: boolean; can_reply: boolean }>({ available: true, can_reply: false });
  const [list, setList] = useState<any[]>([]);
  const [counts, setCounts] = useState({ new: 0, answered: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/support?status=${tab}&source=${source}&q=${encodeURIComponent(q)}`);
      const d = await res.json();
      if (res.ok) { setList(d.tickets || []); setCounts(d.counts || { new: 0, answered: 0, closed: 0 }); if (d.telegram) setTgInfo(d.telegram); }
      else toast.error(d.message || "Yuklab bo'lmadi");
    } catch { toast.error("Yuklab bo'lmadi"); } finally { setLoading(false); }
  }, [tab, q, source]);
  useEffect(() => { const t = setTimeout(loadList, q ? 300 : 0); return () => clearTimeout(t); }, [loadList, q]);

  const openTicket = async (id: string) => {
    setOpenId(id); setTicket(null); setReply("");
    const res = await fetch(id.startsWith("tg-") ? `/api/admin/support/tg/${id.slice(3)}` : `/api/admin/support/${id}`);
    if (res.ok) setTicket(await res.json()); else toast.error("Murojaatni ochib bo'lmadi");
  };

  const send = async (force = false) => {
    if (!reply.trim() || !openId || busy) return;
    const isTg = openId.startsWith("tg-");
    setBusy(true);
    try {
      const res = await fetch(isTg ? `/api/admin/support/tg/${openId.slice(3)}` : `/api/admin/support/${openId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isTg ? { body: reply.trim(), force } : { body: reply.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (isTg && d.code === "CLAIMED" && window.confirm(`${d.message}. Baribir javob yuborasizmi?`)) { setBusy(false); return send(true); }
        toast.error(d.message || "Yuborilmadi"); return;
      }
      if (isTg) toast.success("Javob Telegram orqali yuborildi");
      else if (d.delivered === "none") toast.warning("Javob saqlandi, lekin foydalanuvchiga yetkazilmadi. Emailga qo'lda yozing");
      else toast.success(`Javob yuborildi: ${DELIVERY[d.delivered]}`);
      setReply(""); await openTicket(openId); void loadList();
    } catch { toast.error("Yuborilmadi"); } finally { setBusy(false); }
  };

  const setStatus = async (status: "closed" | "new") => {
    if (!openId) return;
    const res = await fetch(`/api/admin/support/${openId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) { toast.error("Xatolik"); return; }
    await openTicket(openId); void loadList();
  };

  return (
    <div>
      <h1 className="text-lg font-bold mb-4">Murojaatlar</h1>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("px-3 py-1.5 rounded-lg text-xs border", tab === t.key ? "bg-lime-muted text-lime border-lime/30 font-semibold" : "border-white/[0.08] text-white/50 hover:text-white")}>
            {t.label}{t.key !== "all" && <span className="ml-1.5 opacity-70">{counts[t.key as "new" | "answered" | "closed"]}</span>}
          </button>
        ))}
        <div className="flex gap-1" role="group" aria-label="Manba">
          {SOURCES.map(([k, l]) => <button key={k} onClick={() => setSource(k)} aria-pressed={source === k} className={cn("px-2.5 py-1.5 rounded-lg text-[11px] border", source === k ? "bg-white/[0.08] text-white border-white/20" : "border-white/[0.06] text-white/40")}>{l}</button>)}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, email, mavzu..." className="input-field !py-1.5 !pl-8 text-xs w-48" />
        </div>
      </div>

      {source !== "web" && !tgInfo.available && <p className="text-[11px] text-yellow-500 mb-3">Telegram bot jadvallari (tg_tickets) o'qilmadi — botning SQL sxemasi ishga tushirilganini tekshiring.</p>}
      <div className="grid md:grid-cols-[320px_1fr] gap-4">
        <div className={cn("card overflow-hidden", openId && "hidden md:block")}>
          {loading ? <div className="p-6 text-center"><Loader2 className="h-4 w-4 animate-spin text-lime mx-auto" /></div>
            : list.length === 0 ? <p className="p-6 text-xs text-white/30 text-center">Murojaat yo'q</p>
            : list.map((t) => (
              <button key={t.id} onClick={() => openTicket(t.id)} data-testid="ticket-row"
                className={cn("w-full text-left p-3 border-b border-white/[0.04] hover:bg-white/[0.02]", openId === t.id && "bg-white/[0.04]")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{t.name}</span>
                  <span className="text-[10px] text-white/30 shrink-0">{fmt(t.last_message_at)}</span>
                </div>
                <p className="text-[11px] text-white/40 truncate">{t.subject || "Mavzu yo'q"} · {t.email}</p>
                <p className="text-xs text-white/60 truncate mt-0.5">{t.last_message?.sender === "admin" ? "Siz: " : ""}{t.last_message?.body}</p>
                {t.source === "telegram" && <span className="inline-block mt-1 mr-1 text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-semibold">TELEGRAM</span>}
                {t.status === "new" && <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-lime/15 text-lime font-semibold">{t.in_progress ? "ISHLANMOQDA" : "YANGI"}</span>}
              </button>
            ))}
        </div>

        <div className={cn("card min-h-[300px] flex flex-col", !openId && "hidden md:flex")}>
          {!openId ? <p className="m-auto text-xs text-white/30">Murojaatni tanlang</p>
            : !ticket ? <Loader2 className="h-5 w-5 animate-spin text-lime m-auto" />
            : (
              <>
                <div className="p-4 border-b border-white/[0.06]">
                  <button onClick={() => setOpenId(null)} className="md:hidden text-white/40 mb-2 flex items-center gap-1 text-xs"><ArrowLeft className="h-3.5 w-3.5" />Ro'yxat</button>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-sm">{ticket.name}</p>
                    {ticket.source === "telegram"
                      ? <span className="text-xs text-sky-400">{ticket.username ? `@${ticket.username}` : "Telegram"}{ticket.blocked ? " · botni bloklagan" : ""}</span>
                      : <a href={`mailto:${ticket.email}`} className="text-xs text-lime flex items-center gap-1"><Mail className="h-3 w-3" />{ticket.email}</a>}
                    {ticket.source === "telegram" ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400">Telegram bot</span> : ticket.user ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 flex items-center gap-1"><User className="h-3 w-3" />Sayt foydalanuvchisi ({ticket.user.role})</span>
                      : <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">Mehmon</span>}
                    <span className="ml-auto text-[10px] text-white/30">{ticket.status === "closed" ? "Yopilgan" : ticket.status === "answered" ? "Javob berilgan" : "Yangi"}</span>
                  </div>
                  <p className="text-xs text-white/40 mt-1">{ticket.source === "telegram" ? "Telegram murojaati" : ticket.subject || "Mavzu yo'q"} · {fmt(ticket.created_at)}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
                  {ticket.messages.map((m: any) => (
                    <div key={m.id} className={cn("flex", m.sender === "admin" ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5", m.sender === "admin" ? "bg-lime text-black rounded-br-md" : "bg-dark-card text-white/80 rounded-bl-md")}>
                        {m.file_id && (m.media_type === "photo"
                          ? <a href={`/api/admin/support/tg-file?file_id=${encodeURIComponent(m.file_id)}`} target="_blank" rel="noreferrer"><img src={`/api/admin/support/tg-file?file_id=${encodeURIComponent(m.file_id)}`} alt="Telegram rasmi" className="rounded-lg max-h-56 mb-1.5" /></a>
                          : <a href={`/api/admin/support/tg-file?file_id=${encodeURIComponent(m.file_id)}`} target="_blank" rel="noreferrer" className="text-xs underline block mb-1.5">[{m.media_type || "fayl"}] yuklab olish</a>)}
                        {m.body && <p className="text-sm whitespace-pre-line break-words">{m.body}</p>}
                        <p className={cn("text-[10px] mt-1", m.sender === "admin" ? "text-black/50" : "text-white/30")}>
                          {fmt(m.created_at)}{m.sender === "admin" && m.delivered ? ` · ${DELIVERY[m.delivered] || m.delivered}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-white/[0.06]">
                  {ticket.source === "telegram" && !ticket.can_reply ? (
                    <p className="text-[11px] text-yellow-500">Telegramga javob yuborish uchun Vercel env'iga <b>TELEGRAM_BOT_TOKEN</b> qo'shing. Hozircha faqat o'qish mumkin (javobni botning o'zida bering).</p>
                  ) : ticket.status === "closed" ? (
                    <button onClick={() => setStatus("new")} className="btn-outline text-xs !py-2">Qayta ochish</button>
                  ) : (
                    <>
                      {ticket.source === "telegram" && ticket.in_progress && <p className="text-[11px] text-yellow-500 mb-2">Botda boshqa admin bu murojaat ustida ishlayapti.</p>}
                      {ticket.source !== "telegram" && !ticket.user && !ticket.can_email && (
                        <p className="text-[11px] text-yellow-500 mb-2">Mehmon uchun avtomatik email yuborilmaydi (RESEND_API_KEY sozlanmagan). Javobni saqlang va <a className="underline" href={`mailto:${ticket.email}`}>emailga qo'lda</a> yozing.</p>
                      )}
                      <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={SUPPORT_LIMITS.REPLY_MAX} placeholder="Javob yozing..." className="input-field text-sm resize-none mb-2" aria-label="Javob" />
                      <div className="flex items-center gap-2">
                        <button onClick={() => send()} disabled={!reply.trim() || busy} className="btn-lime !py-2 text-xs flex items-center gap-1.5 disabled:opacity-40">
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Javob yuborish
                        </button>
                        {ticket.source !== "telegram" && <button onClick={() => setStatus("closed")} className="btn-outline !py-2 text-xs flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Yopish</button>}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
}
