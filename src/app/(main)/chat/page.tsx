"use client";

import { useState, useRef, useEffect } from "react";
import { Send, ArrowLeft, Search, Loader2, Zap, Image as ImageIcon, MessageCircle } from "lucide-react";
import { cn, getInitials, timeAgo } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

export default function ChatPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [aiMessages, setAiMessages] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const isAI = selected === "ai";
  const isConv = selected && selected !== "ai";

  // Conversations yuklash
  useEffect(() => {
    fetchConversations();
    // Trainer sahifasidan kelgan bo'lsa — conversation ochish
    const trainerId = searchParams.get("trainer");
    if (trainerId && user) openTrainerChat(trainerId);
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!isConv) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${selected}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selected}` },
        (payload: any) => {
          const newMsg = payload.new;
          if (newMsg.sender_id !== user?.id) {
            setMessages((prev) => [...prev, newMsg]);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected, user?.id]);

  // Auto scroll
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, aiMessages]);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/chat");
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch (e) {} finally { setLoading(false); }
  };

  const openTrainerChat = async (trainerId: string) => {
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainer_id: trainerId }) });
    if (res.ok) {
      const { id } = await res.json();
      setSelected(id);
      loadMessages(id);
      fetchConversations();
    }
  };

  const loadMessages = async (convId: string) => {
    const res = await fetch(`/api/chat/${convId}/messages`);
    const data = await res.json();
    setMessages(Array.isArray(data) ? data : []);
  };

  const selectConversation = (convId: string) => {
    setSelected(convId);
    if (convId !== "ai") loadMessages(convId);
  };

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    const text = message.trim();
    setMessage("");

    if (isAI) {
      // AI chat
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
            try { const { text: t } = JSON.parse(data); aiText += t; setAiMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, text: aiText } : m)); } catch {}
          }
        }
      } catch (e) { setAiMessages((prev) => [...prev, { id: `err-${Date.now()}`, sender: "other", text: "Kechirasiz, xatolik yuz berdi.", time: new Date().toISOString() }]); }
      setAiLoading(false);
    } else if (isConv) {
      // Real chat
      setSending(true);
      const tempMsg = { id: `temp-${Date.now()}`, sender_id: user?.id, content: text, created_at: new Date().toISOString(), sender: { full_name: user?.full_name } };
      setMessages((prev) => [...prev, tempMsg]);
      try {
        const res = await fetch(`/api/chat/${selected}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }) });
        if (res.ok) {
          const real = await res.json();
          setMessages((prev) => prev.map((m) => m.id === tempMsg.id ? real : m));
          fetchConversations(); // last_message yangilash
        }
      } catch (e) {}
      setSending(false);
    }
  };

  const currentConv = conversations.find((c) => c.id === selected);
  const otherName = currentConv?.other?.full_name || "";
  const otherAvatar = currentConv?.other?.avatar_url || "";
  const displayMessages = isAI ? aiMessages : messages;

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Sidebar */}
      <div className={cn("w-full sm:w-80 border-r border-white/[0.06] flex flex-col bg-dark", selected !== null ? "hidden sm:flex" : "flex")}>
        <div className="p-4 border-b border-white/[0.06]">
          <h2 className="font-semibold text-sm mb-3">Chatlar</h2>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" /><input type="text" value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} placeholder="Qidirish..." className="input-field !py-2 !pl-9 text-xs" /></div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* AI — search bo'lganda ham ko'rinadi agar mos bo'lsa */}
          {(!chatSearch || "trainertop ai".includes(chatSearch.toLowerCase())) && (
            <button onClick={() => selectConversation("ai")}
              className={cn("w-full flex items-center gap-3 p-4 text-left transition-colors border-b border-white/[0.06]",
                selected === "ai" ? "bg-lime/[0.06]" : "hover:bg-lime/[0.03]")}>
              <div className="w-10 h-10 rounded-xl ai-accent flex items-center justify-center shrink-0"><Zap className="h-5 w-5 text-black" /></div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-lime">TrainerTop AI</span>
                <p className="text-xs text-white/40 truncate mt-0.5">Fitness haqida savol bering</p>
              </div>
            </button>
          )}

          {/* Real conversations — filtered */}
          {loading ? <div className="p-4 text-center"><Loader2 className="h-4 w-4 text-lime animate-spin mx-auto" /></div> : (() => {
            const filtered = conversations.filter((c) =>
              !chatSearch || c.other?.full_name?.toLowerCase().includes(chatSearch.toLowerCase()) || c.last_message?.toLowerCase().includes(chatSearch.toLowerCase())
            );
            if (chatSearch && filtered.length === 0 && !"trainertop ai".includes(chatSearch.toLowerCase())) {
              return (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-dark-card flex items-center justify-center mb-3">
                    <MessageCircle className="h-5 w-5 text-white/10" />
                  </div>
                  <p className="text-sm text-white/30 text-center mb-1">"{chatSearch}" bo'yicha chat topilmadi</p>
                  <p className="text-[11px] text-white/15 text-center">Trenerlar sahifasidan yangi chat boshlang</p>
                </div>
              );
            }
            if (!chatSearch && conversations.length === 0) {
              return <p className="text-xs text-white/20 text-center p-4">Hali chatlar yo'q</p>;
            }
            return filtered.map((conv) => (
              <button key={conv.id} onClick={() => selectConversation(conv.id)}
                className={cn("w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors border-b border-white/[0.03]",
                  selected === conv.id && "bg-white/[0.03]")}>
                <div className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center shrink-0 overflow-hidden">
                  {conv.other?.avatar_url ? <img src={conv.other.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(conv.other?.full_name || "")}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between"><span className="text-sm font-medium truncate">{conv.other?.full_name}</span><span className="text-[10px] text-white/20 shrink-0 ml-2">{conv.last_message_at ? timeAgo(conv.last_message_at) : ""}</span></div>
                  <div className="flex justify-between mt-0.5"><p className="text-xs text-white/40 truncate">{conv.last_message || "Yangi chat"}</p>
                    {conv.my_unread > 0 && <span className="ml-2 shrink-0 min-w-[18px] h-[18px] rounded-full bg-lime text-black text-[10px] font-bold flex items-center justify-center">{conv.my_unread}</span>}
                  </div>
                </div>
              </button>
            ));
          })()}
        </div>
      </div>

      {/* Chat area */}
      <div className={cn("flex-1 flex flex-col", selected === null ? "hidden sm:flex" : "flex", isAI ? "bg-gradient-to-b from-lime/[0.02] to-dark" : "bg-dark")}>
        {selected !== null ? (
          <>
            {/* Header */}
            <div className={cn("flex items-center gap-3 p-4 border-b border-white/[0.06]", isAI && "bg-lime/[0.03]")}>
              <button onClick={() => setSelected(null)} className="sm:hidden text-white/40 hover:text-white"><ArrowLeft className="h-5 w-5" /></button>
              {isAI ? (
                <><div className="w-9 h-9 rounded-xl ai-accent flex items-center justify-center"><Zap className="h-4 w-4 text-black" /></div><div><p className="text-sm font-semibold text-lime">TrainerTop AI</p><p className="text-[10px] text-lime/60">Fitness bo'yicha yordamchi</p></div></>
              ) : (
                <><div className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center overflow-hidden">{otherAvatar ? <img src={otherAvatar} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-white/20">{getInitials(otherName)}</span>}</div><div><p className="text-sm font-medium">{otherName}</p><p className="text-[10px] text-lime">Online</p></div></>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isAI && aiMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-20 h-20 rounded-2xl ai-accent flex items-center justify-center mb-5"><Zap className="h-9 w-9 text-black" /></div>
                  <h3 className="text-lg font-bold text-lime mb-1">TrainerTop AI</h3>
                  <p className="text-xs text-white/40 text-center max-w-sm mb-8">Mashq, dieta, supplement — hamma savollaringizga javob beraman</p>
                  <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                    {["Mashq rejasi tuzing", "Vazn tashlash uchun dieta", "Protein miqdori qancha?", "Uyda mashq qilish"].map((q) => (
                      <button key={q} onClick={() => setMessage(q)} className="text-left p-3 rounded-xl border border-lime/20 bg-lime/[0.04] hover:bg-lime/[0.08] transition-colors"><p className="text-xs text-lime/80">{q}</p></button>
                    ))}
                  </div>
                </div>
              )}
              {!isAI && messages.length === 0 && <p className="text-center text-xs text-white/20 py-8">Xabar yozing...</p>}

              {displayMessages.map((msg: any) => {
                const isMe = isAI ? msg.sender === "me" : msg.sender_id === user?.id;
                return (
                  <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                    {!isMe && isAI && <div className="w-7 h-7 rounded-lg bg-lime/20 flex items-center justify-center mr-2 mt-1 shrink-0"><Zap className="h-3.5 w-3.5 text-lime" /></div>}
                    <div className={cn("max-w-[75%] rounded-2xl px-4 py-2.5",
                      isMe ? "bg-lime text-black rounded-br-md ai-msg-me" : isAI ? "ai-msg-bot rounded-bl-md" : "bg-dark-card text-white/80 rounded-bl-md")}>
                      <p className="text-sm leading-relaxed whitespace-pre-line">{isAI ? (msg.text || "...") : (msg.content || "...")}</p>
                      <p className={cn("text-[10px] mt-1", isMe ? "text-black/40" : "text-white/20")}>
                        {new Date(isAI ? msg.time : msg.created_at).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              {aiLoading && <div className="flex items-start gap-2"><div className="w-7 h-7 rounded-lg bg-lime/20 flex items-center justify-center shrink-0"><Zap className="h-3.5 w-3.5 text-lime" /></div><div className="ai-msg-bot rounded-2xl rounded-bl-md px-4 py-3"><div className="flex gap-1"><span className="w-1.5 h-1.5 bg-lime rounded-full animate-bounce" /><span className="w-1.5 h-1.5 bg-lime rounded-full animate-bounce" style={{ animationDelay: "150ms" }} /><span className="w-1.5 h-1.5 bg-lime rounded-full animate-bounce" style={{ animationDelay: "300ms" }} /></div></div></div>}
              <div ref={messagesEnd} />
            </div>

            {/* Input */}
            <div className={cn("p-4 border-t border-white/[0.06]", isAI && "bg-lime/[0.02]")}>
              <div className="flex items-end gap-2">
                <textarea value={message} onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={isAI ? "Fitness haqida savol bering..." : "Xabar yozing..."} rows={1}
                  className="input-field !py-2.5 resize-none flex-1 text-sm" style={{ maxHeight: "120px" }} />
                <button onClick={handleSend} disabled={!message.trim() || sending || aiLoading}
                  className={cn("!p-2.5 rounded-button disabled:opacity-30", isAI ? "bg-lime text-black" : "btn-lime")}>
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center"><div className="text-center"><div className="w-16 h-16 rounded-full bg-dark-card flex items-center justify-center mx-auto mb-3"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/10"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg></div><p className="text-white/30 text-sm">Suhbat tanlang yoki TrainerTop AI bilan gaplashing</p></div></div>
        )}
      </div>
    </div>
  );
}
