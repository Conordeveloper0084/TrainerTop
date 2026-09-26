"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Send, ArrowLeft, Loader2, Zap, MessageCircle, Lock, Info, Users, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { cn, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { createClient } from "@/lib/supabase/client";
import { chatUnreadPoller, notificationsPoller } from "@/lib/shared-poll";
import { CHAT_PAGE_SIZE } from "@/lib/constants";
import {
  buildThreadList, filterThreads, mergeMessages,
  type ChatMessage, type DmSummary, type GroupSummary, type ThreadItem,
} from "@/lib/chat-client";
import { ThreadList } from "@/components/chat/ThreadList";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Composer, type OutgoingPayload } from "@/components/chat/Composer";
import { ImageViewer } from "@/components/chat/ImageViewer";
import { LockedGroup } from "@/components/chat/LockedGroup";
import { GroupIntro } from "@/components/chat/GroupIntro";
import { GroupInfoModal, type GroupDetail } from "@/components/chat/GroupInfoModal";
import { RemovedGroup } from "@/components/chat/RemovedGroup";
import { ReportDialog } from "@/components/chat/ReportDialog";
import { formatUntil, isMutedNow, reasonLabel } from "@/lib/chat-moderation";
import { OfficialChannel } from "@/components/chat/OfficialChannel";
import type { OfficialSummary, ChannelIdentity } from "@/lib/announcements";

type Selected = { kind: "dm" | "group" | "ai" | "official"; id: string } | null;

const threadUrl = (s: { kind: "dm" | "group"; id: string }) =>
  s.kind === "group" ? `/api/chat/groups/${s.id}/messages` : `/api/chat/${s.id}/messages`;

export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();

  const [dms, setDms] = useState<DmSummary[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Selected>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [official, setOfficial] = useState<OfficialSummary | null>(null);
  const [channelIdentity, setChannelIdentity] = useState<ChannelIdentity | null>(null);
  const [query, setQuery] = useState("");

  // AI yordamchi
  const [aiMessages, setAiMessages] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
  const openToken = useRef(0);
  const senders = useRef(new Map<string, ChatMessage["sender"]>());
  const handledDeepLink = useRef(false);

  const isAI = selected?.kind === "ai";
  const locked = selected?.kind === "group" && group?.access === "expired";
  const removed = selected?.kind === "group" && group?.access === "removed";
  const muted = selected?.kind === "group" && !!group && group.access === "active" && isMutedNow(group.muted_until);

  // ---------- Ro'yxatlar ----------
  const loadLists = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([fetch("/api/chat"), fetch("/api/chat/groups"), fetch("/api/announcements/summary").catch(() => null)]);
      const da = a.ok ? await a.json() : [];
      const db = b.ok ? await b.json() : [];
      setDms(Array.isArray(da) ? da : []);
      setGroups(Array.isArray(db) ? db : []);
      // Rasmiy TrainerTop kanali (e'lonlar): oxirgi e'lon bo'lsa ro'yxatda ko'rinadi
      const dc = c && c.ok ? await c.json().catch(() => null) : null;
      setOfficial(dc && typeof dc.unread === "number" ? { unread: dc.unread, latest: dc.latest || null } : null);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadLists(); }, [loadLists]);
  // Rasmiy kanal identifikatori (nom/rasm/obunachi soni) — chat ro'yxatidagi qatorda ko'rsatish uchun, bir marta yetarli
  useEffect(() => { let alive = true; fetch("/api/channel").then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d) setChannelIdentity(d); }).catch(() => {}); return () => { alive = false; }; }, []);

  // ---------- Xabarlarni yuklash ----------
  const rememberSenders = (list: ChatMessage[]) => list.forEach((m) => { if (m.sender?.id) senders.current.set(m.sender_id, m.sender); });

  const fetchLatest = useCallback(async (sel: { kind: "dm" | "group"; id: string }): Promise<{ list: ChatMessage[] | null; code?: string }> => {
    try {
      const res = await fetch(threadUrl(sel));
      const data = await res.json().catch(() => null);
      if (!res.ok) return { list: null, code: data?.code };
      const list: ChatMessage[] = Array.isArray(data) ? data : [];
      rememberSenders(list);
      return { list };
    } catch { return { list: null }; }
  }, []);

  const clearUnreadLocally = (sel: { kind: "dm" | "group"; id: string }) => {
    if (sel.kind === "dm") setDms((p) => p.map((c) => (c.id === sel.id ? { ...c, my_unread: 0 } : c)));
    else setGroups((p) => p.map((g) => (g.id === sel.id ? { ...g, unread: 0 } : g)));
  };

  const openThread = useCallback(async (sel: NonNullable<Selected>) => {
    const token = ++openToken.current;
    setSelected(sel); setMessages([]); setHasMore(false); setGroup(null); setShowInfo(false); setShowIntro(false);
    if (sel.kind === "ai" || sel.kind === "official") return;
    const real = sel as { kind: "dm" | "group"; id: string };
    setLoadingThread(true);
    try {
      if (sel.kind === "group") {
        const res = await fetch(`/api/chat/groups/${sel.id}`);
        if (token !== openToken.current) return;
        if (!res.ok) { toast.error("Guruh topilmadi"); setSelected(null); void loadLists(); return; }
        const g: GroupDetail = await res.json();
        if (token !== openToken.current) return;
        setGroup(g);
        if (g.access === "expired" || g.access === "removed") return;
        if (!g.seen_intro) setShowIntro(true);
      }
      const { list, code } = await fetchLatest(real);
      if (token !== openToken.current) return;
      if (!list) {
        if (code === "EXPIRED") { setGroup((g) => (g ? { ...g, access: "expired" } : g)); return; }
        if (code === "REMOVED") { setGroup((g) => (g ? { ...g, access: "removed" } : g)); return; }
        toast.error("Xabarlarni yuklab bo'lmadi");
        return;
      }
      setMessages(list);
      setHasMore(list.length >= CHAT_PAGE_SIZE);
      clearUnreadLocally(real);
      void chatUnreadPoller.refresh();
    } finally { if (token === openToken.current) setLoadingThread(false); }
  }, [fetchLatest, loadLists]);

  const openTrainerChat = useCallback(async (trainerId: string) => {
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainer_id: trainerId }) });
    if (res.ok) {
      const { id } = await res.json();
      await openThread({ kind: "dm", id });
      void loadLists();
    }
  }, [openThread, loadLists]);

  // Rasmiy kanal: /chat?official=1 (qo'ng'iroqchadagi e'lon qatori). Sahifa ochiq turganda ham har safar ishlaydi.
  const wantsOfficial = searchParams.get("official") === "1";
  useEffect(() => { if (wantsOfficial && user) void openThread({ kind: "official", id: "official" }); }, [wantsOfficial, user?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Chuqur havolalar: ?trainer=<id> | ?group=<id> | ?lesson=<id> (auth va ro'yxatlar yuklangach bir marta)
  useEffect(() => {
    if (loading || !user || handledDeepLink.current) return;
    handledDeepLink.current = true;
    const trainerId = searchParams.get("trainer");
    const groupId = searchParams.get("group");
    const lessonId = searchParams.get("lesson");
    if (trainerId) void openTrainerChat(trainerId);
    else if (groupId) void openThread({ kind: "group", id: groupId });
    else if (lessonId) {
      const g = groups.find((x) => x.lesson_id === lessonId);
      if (g) void openThread({ kind: "group", id: g.id });
    }
  }, [loading, user, groups, searchParams, openThread, openTrainerChat]);

  // ---------- Realtime + qayta ulanganda to'ldirish ----------
  useEffect(() => {
    if (!selected || selected.kind === "ai" || selected.kind === "official" || !user) return;
    if (selected.kind === "group" && (!group || group.access === "expired" || group.access === "removed")) return;
    const sel = { kind: selected.kind, id: selected.id } as { kind: "dm" | "group"; id: string };
    const supabase = createClient();
    const filter = `${sel.kind === "group" ? "group_id" : "conversation_id"}=eq.${sel.id}`;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false; // bu suhbatdan chiqilgach kechikkan javoblar e'tiborga olinmaydi

    const refresh = async () => {
      const { list } = await fetchLatest(sel);
      if (list && !cancelled) setMessages((prev) => mergeMessages(prev, list));
    };
    const scheduleRefresh = () => { if (refreshTimer) clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 300); };

    const channel = supabase
      .channel(`chat-${sel.kind}-${sel.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter }, (payload: any) => {
        const m = payload.new as ChatMessage;
        const sender = senders.current.get(m.sender_id) || (m.sender_id === user.id ? { id: user.id, full_name: user.full_name } : undefined);
        setMessages((prev) => mergeMessages(prev, [{ ...m, sender }]));
        if (m.sender_id !== user.id) scheduleRefresh(); // yuboruvchi ismi + "o'qildi" belgisi
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter }, (payload: any) => {
        setMessages((prev) => mergeMessages(prev, [payload.new as ChatMessage]));
      })
      // Realtime xabarni o'tkazib yuborishi mumkin: har (qayta) ulanishda oxirgi xabarlarni qayta olamiz
      .subscribe((status: string) => { if (status === "SUBSCRIBED") void refresh(); });

    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [selected?.kind, selected?.id, group?.access, user?.id, fetchLatest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Telefonda suhbat ochiq bo'lganda pastki menyu yashiriladi (yozish paneli ustini yopib qo'ymasligi uchun)
  const threadOpen = selected !== null;
  useEffect(() => {
    if (!threadOpen) return;
    document.body.dataset.chatThread = "1";
    return () => { delete document.body.dataset.chatThread; };
  }, [threadOpen]);

  // ---------- Pastga aylantirish (faqat YANGI xabar kelganda, eskilari yuklanganda emas) ----------
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: "smooth" }); }, [lastId, aiMessages.length, selected?.id]);

  const loadOlder = async () => {
    if (!selected || selected.kind === "ai" || selected.kind === "official" || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const token = openToken.current;
    try {
      const url = `${threadUrl(selected as any)}?before=${encodeURIComponent(messages[0].created_at)}`;
      const res = await fetch(url);
      const data = res.ok ? await res.json() : [];
      if (token !== openToken.current) return;
      const list: ChatMessage[] = Array.isArray(data) ? data : [];
      rememberSenders(list);
      setMessages((prev) => mergeMessages(prev, list));
      setHasMore(list.length >= CHAT_PAGE_SIZE);
    } finally { setLoadingMore(false); }
  };

  // ---------- Yuborish / o'chirish ----------
  // Xabar hali serverga yuborilmasdan oldin chatda darhol ko'rinishi uchun (matn/rasm/video/ovoz — hammasi uchun bir xil):
  // mahalliy (blob:) manzil bilan "yuborilmoqda" holatida qo'yiladi, keyin haqiqiy natija bilan almashtiriladi.
  const startOptimistic = (preview: { type: "image" | "video" | "voice"; localUrl: string; duration?: number }): string => {
    if (!user) return "";
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId, sender_id: user.id, content: null, type: preview.type, media_url: preview.localUrl,
      media_duration: preview.duration ?? null, created_at: new Date().toISOString(), pending: true,
      sender: { id: user.id, full_name: user.full_name },
    }]);
    return tempId;
  };

  const sendMessage = async (payload: OutgoingPayload, existingTempId?: string): Promise<boolean> => {
    if (!selected || selected.kind === "ai" || selected.kind === "official" || !user) return false;
    const isText = payload.type === "text";
    const tempId = existingTempId || `temp-${Date.now()}`;
    const token = openToken.current;
    if (isText && !existingTempId) {
      setMessages((prev) => [...prev, {
        id: tempId, sender_id: user.id, content: (payload as any).content, type: "text", media_url: null,
        created_at: new Date().toISOString(), pending: true, sender: { id: user.id, full_name: user.full_name },
      }]);
    }
    try {
      const res = await fetch(threadUrl(selected as any), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        if (token === openToken.current) {
          if (d.code === "EXPIRED") setGroup((g) => (g ? { ...g, access: "expired" } : g));
          if (d.code === "REMOVED") setGroup((g) => (g ? { ...g, access: "removed" } : g));
          if (d.code === "MUTED") setGroup((g) => (g ? { ...g, muted_until: d.muted_until, mod: { reason: d.reason, note: d.note } } : g));
        }
        toast.error(d.message || "Xabar yuborilmadi");
        return false;
      }
      void loadLists();
      if (token === openToken.current) {
        setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== tempId), [{ ...d, sender: d.sender || { id: user.id, full_name: user.full_name } }]));
      }
      return true;
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("Internet bilan muammo. Qayta urinib ko'ring");
      return false;
    }
  };

  const deleteMessage = async (id: string) => {
    if (!window.confirm("Xabar hamma uchun o'chiriladi. Davom etasizmi?")) return;
    const res = await fetch(`/api/chat/messages/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.message || "O'chirib bo'lmadi"); return; }
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString(), content: null, media_url: null, thumb_url: null, image_url: null } : m)));
    void loadLists();
  };

  // ---------- AI ----------
  const sendAi = async () => {
    const text = aiInput.trim();
    if (!text || aiLoading) return;
    setAiInput("");
    const newMsg = { id: `m-${Date.now()}`, sender: "me", text, time: new Date().toISOString() };
    setAiMessages((prev) => [...prev, newMsg]);
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: aiMessages.slice(-10).map((m) => ({ role: m.sender === "me" ? "user" : "assistant", content: m.text })) }) });
      if (!res.ok) throw new Error();
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      const aiMsgId = `ai-${Date.now()}`;
      setAiMessages((prev) => [...prev, { id: aiMsgId, sender: "other", text: "", time: new Date().toISOString() }]);
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n").filter((l) => l.startsWith("data: "))) {
          const data = line.replace("data: ", "");
          if (data === "[DONE]") break;
          try { const { text: t } = JSON.parse(data); aiText += t; setAiMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, text: aiText } : m))); } catch {}
        }
      }
    } catch { setAiMessages((prev) => [...prev, { id: `err-${Date.now()}`, sender: "other", text: "Kechirasiz, xatolik yuz berdi.", time: new Date().toISOString() }]); }
    setAiLoading(false);
  };

  // Rasmiy kanal ochildi (server "o'qildi" deb belgiladi): ro'yxat, chat belgisi va qo'ng'iroqcha yangilanadi
  const onOfficialRead = useCallback(() => {
    setOfficial((o) => (o ? { ...o, unread: 0 } : o));
    void chatUnreadPoller.refresh(); void notificationsPoller?.refresh?.();
  }, []);

  // ---------- Ko'rinish ----------
  const items = filterThreads(buildThreadList(dms, groups), query);
  const selectedKey = !selected ? null : selected.kind === "ai" ? "ai" : selected.kind === "official" ? "official" : `${selected.kind}:${selected.id}`;
  const currentDm = selected?.kind === "dm" ? dms.find((c) => c.id === selected.id) : undefined;
  const groupSummary = selected?.kind === "group" ? groups.find((g) => g.id === selected.id) : undefined;
  const isOwner = group?.role === "owner";

  const onSelectItem = (it: ThreadItem) => { void openThread({ kind: it.kind, id: it.id }); };
  const canDelete = (m: ChatMessage) => (selected?.kind === "group" ? isOwner || m.sender_id === user?.id : m.sender_id === user?.id);

  return (
    <div className="chat-shell flex">
      {/* Sidebar */}
      <div className={cn("w-full sm:w-80 border-r border-white/[0.06] flex flex-col bg-dark", selected !== null ? "hidden sm:flex" : "flex")}>
        <ThreadList items={items} loading={loading} query={query} onQuery={setQuery} selectedKey={selectedKey}
          onSelect={onSelectItem} onSelectAi={() => void openThread({ kind: "ai", id: "ai" })}
          official={official} channelIdentity={channelIdentity} onSelectOfficial={() => void openThread({ kind: "official", id: "official" })} />
      </div>

      {/* Chat area */}
      <div className={cn("flex-1 flex flex-col min-w-0", selected === null ? "hidden sm:flex" : "flex", isAI ? "bg-gradient-to-b from-lime/[0.02] to-dark" : "bg-dark")}>
        {selected !== null && selected.kind === "official" ? (
          <OfficialChannel onBack={() => setSelected(null)} onRead={onOfficialRead} />
        ) : selected !== null ? (
          <>
            {/* Header */}
            <div className={cn("flex items-center gap-3 p-4 border-b border-white/[0.06]", isAI && "bg-lime/[0.03]")}>
              <button onClick={() => setSelected(null)} aria-label="Orqaga" className="sm:hidden text-white/40 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
              {isAI ? (
                <><div className="w-9 h-9 rounded-xl ai-accent flex items-center justify-center"><Zap className="h-4 w-4 text-black" /></div>
                  <div><p className="text-sm font-semibold text-lime">TrainerTop AI</p><p className="text-[10px] text-white/30">Fitness yordamchisi</p></div></>
              ) : selected.kind === "group" ? (
                <button onClick={() => group && !locked && !removed && setShowInfo(true)} className="flex items-center gap-3 min-w-0 flex-1 text-left" aria-label="Guruh haqida">
                  <div className="w-9 h-9 rounded-xl bg-dark-card flex items-center justify-center overflow-hidden shrink-0">
                    {(group?.avatar_url || groupSummary?.avatar_url) ? <img src={(group?.avatar_url || groupSummary?.avatar_url) as string} alt="" className="w-full h-full object-cover" /> : <Users className="h-4 w-4 text-white/30" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1.5">{group?.name || groupSummary?.name || "Guruh"}{locked && <Lock className="h-3 w-3 text-white/40" />}</p>
                    <p className="text-[10px] text-white/30 truncate">{locked ? "Obuna tugagan" : removed ? "Guruhdan chiqarilgansiz" : group ? `${group.member_count} ta a'zo · darslik guruhi` : "Yuklanmoqda..."}</p>
                  </div>
                  {group && !locked && !removed && <Info className="h-4 w-4 text-white/30 ml-auto shrink-0" />}
                </button>
              ) : (
                <><div className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center overflow-hidden">
                  {currentDm?.other?.avatar_url ? <img src={currentDm.other.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-white/20">{getInitials(currentDm?.other?.full_name || "")}</span>}
                </div><p className="text-sm font-medium">{currentDm?.other?.full_name}</p></>
              )}
            </div>

            {locked && group ? (
              <LockedGroup group={{ id: group.id, name: group.name, avatar_url: group.avatar_url, lesson_id: group.lesson_id, price_monthly: group.lesson?.price_monthly }}
                onLeft={() => { setSelected(null); void loadLists(); }} />
            ) : removed && group ? (
              <RemovedGroup group={{ id: group.id, name: group.name, avatar_url: group.avatar_url, lesson: group.lesson ? { id: group.lesson.id, title: group.lesson.title } : null, mod: group.mod }}
                onDismissed={() => { setSelected(null); void loadLists(); }} />
            ) : (
              <>
                {/* Xabarlar */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {isAI && aiMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-20 h-20 rounded-2xl ai-accent flex items-center justify-center mb-5"><Zap className="h-9 w-9 text-black" /></div>
                      <h3 className="text-lg font-bold text-lime mb-1">TrainerTop AI</h3>
                      <p className="text-xs text-white/40 text-center max-w-sm mb-8">Mashq, dieta, supplement — hamma savollaringizga javob beraman</p>
                      <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                        {["Mashq rejasi tuzing", "Vazn tashlash uchun dieta", "Protein miqdori qancha?", "Uyda mashq qilish"].map((q) => (
                          <button key={q} onClick={() => setAiInput(q)} className="text-left p-3 rounded-xl border border-lime/20 bg-lime/[0.04] hover:bg-lime/[0.08] transition-colors"><p className="text-xs text-lime/80">{q}</p></button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isAI && loadingThread && <div className="py-8 text-center"><Loader2 className="h-5 w-5 text-lime animate-spin mx-auto" /></div>}
                  {!isAI && !loadingThread && hasMore && (
                    <div className="text-center"><button onClick={loadOlder} disabled={loadingMore} className="text-xs text-lime/80 hover:text-lime disabled:opacity-40">{loadingMore ? "Yuklanmoqda..." : "Oldingi xabarlar"}</button></div>
                  )}
                  {!isAI && !loadingThread && messages.length === 0 && <p className="text-center text-xs text-white/20 py-8">{selected.kind === "group" ? "Guruhda hali xabar yo'q. Birinchi bo'lib yozing!" : "Xabar yozing..."}</p>}

                  {!isAI && messages.map((m) => (
                    <MessageBubble key={m.id} msg={m} mine={m.sender_id === user?.id} isGroup={selected.kind === "group"} ownerId={group?.owner?.id}
                      canDelete={canDelete(m)} onDelete={deleteMessage} onReport={setReportFor} onOpenImage={setViewer} />
                  ))}

                  {isAI && aiMessages.map((msg) => {
                    const isMe = msg.sender === "me";
                    return (
                      <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                        {!isMe && <div className="w-7 h-7 rounded-lg bg-lime/20 flex items-center justify-center mr-2 mt-1 shrink-0"><Zap className="h-3.5 w-3.5 text-lime" /></div>}
                        <div className={cn("max-w-[75%] rounded-2xl px-4 py-2.5", isMe ? "bg-lime text-black rounded-br-md ai-msg-me" : "ai-msg-bot rounded-bl-md")}>
                          <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text || "..."}</p>
                          <p className={cn("text-[10px] mt-1", isMe ? "text-black/40" : "text-white/20")}>{new Date(msg.time).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    );
                  })}
                  {isAI && aiLoading && <div className="flex items-start gap-2"><div className="w-7 h-7 rounded-lg bg-lime/20 flex items-center justify-center shrink-0"><Zap className="h-3.5 w-3.5 text-lime" /></div><div className="ai-msg-bot rounded-2xl rounded-bl-md px-4 py-3"><Loader2 className="h-4 w-4 animate-spin text-lime" /></div></div>}
                  <div ref={endRef} />
                </div>

                {/* Kiritish */}
                {isAI ? (
                  <div className="p-4 border-t border-white/[0.06] bg-lime/[0.02]">
                    <div className="flex items-end gap-2">
                      <textarea value={aiInput} onChange={(e) => setAiInput(e.target.value)} rows={1} placeholder="Fitness haqida savol bering..."
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendAi(); } }}
                        className="input-field !py-2.5 resize-none flex-1 text-sm" style={{ maxHeight: "120px" }} />
                      <button onClick={sendAi} disabled={!aiInput.trim() || aiLoading} aria-label="Yuborish" className="!p-2.5 rounded-button bg-lime text-black disabled:opacity-30"><Send className="h-4 w-4" /></button>
                    </div>
                  </div>
                ) : muted && group ? (
                  <div className="p-4 border-t border-white/[0.06]" data-testid="muted-banner">
                    <div className="flex items-start gap-3 bg-orange-500/[0.07] border border-orange-500/20 rounded-xl p-3">
                      <VolumeX className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="text-orange-300 font-medium">Guruhda yozishingiz cheklangan{group.muted_until === "infinity" ? " (muddatsiz)" : ` — ${formatUntil(group.muted_until)} gacha`}</p>
                        <p className="text-white/50 mt-0.5">Sabab: {reasonLabel(group.mod?.reason)}{group.mod?.note ? ` — ${group.mod.note}` : ""}. Guruhni o'qiy olasiz.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Composer onSend={sendMessage} onOptimistic={startOptimistic} onOptimisticFailed={(id) => setMessages((prev) => prev.filter((m) => m.id !== id))} disabled={loadingThread} />
                )}
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center"><div className="text-center"><div className="w-16 h-16 rounded-full bg-dark-card flex items-center justify-center mx-auto mb-3"><MessageCircle className="h-7 w-7 text-white/10" /></div><p className="text-sm text-white/30">Chatni tanlang</p></div></div>
        )}
      </div>

      {showIntro && group && (
        <GroupIntro group={group} isOwner={isOwner} onClose={() => { setShowIntro(false); setGroup((g) => (g ? { ...g, seen_intro: true } : g)); void fetch(`/api/chat/groups/${group.id}/intro-seen`, { method: "POST" }); }} />
      )}
      {showInfo && group && (
        <GroupInfoModal group={group} onClose={() => setShowInfo(false)}
          onUpdated={(u) => { setGroup((g) => (g ? { ...g, ...u } : g)); void loadLists(); }} />
      )}
      {viewer && <ImageViewer url={viewer} onClose={() => setViewer(null)} />}
      {reportFor && (
        <ReportDialog onClose={() => setReportFor(null)} onSubmit={async (b) => {
          const res = await fetch(`/api/chat/messages/${reportFor}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
          const d = await res.json().catch(() => ({}));
          if (res.ok) { toast.success("Shikoyat yuborildi. Rahmat!"); setReportFor(null); }
          else { toast.error(d.message || "Xatolik"); if (res.status === 409) setReportFor(null); }
        }} />
      )}
    </div>
  );
}
