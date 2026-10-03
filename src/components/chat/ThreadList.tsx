"use client";

import { Search, Loader2, MessageCircle, Zap, Lock, Users, Ban, Megaphone } from "lucide-react";
import { cn, getInitials, timeAgo } from "@/lib/utils";
import type { ThreadItem } from "@/lib/chat-client";
import type { OfficialSummary, ChannelIdentity } from "@/lib/announcements";

interface Props {
  items: ThreadItem[];
  loading: boolean;
  query: string;
  onQuery: (q: string) => void;
  selectedKey: string | null;      // "dm:<id>" | "group:<id>" | "ai" | "official"
  onSelect: (item: ThreadItem) => void;
  onSelectAi: () => void;
  official?: OfficialSummary | null;
  channelIdentity?: ChannelIdentity | null;
  onSelectOfficial?: () => void;
}

const AI_MATCH = "trainertop ai";
const OFFICIAL_MATCH = "trainertop rasmiy kanal e'lon";

// Chatlar ro'yxati: AI yordamchi, 1:1 suhbatlar va darslik guruhlari (qulflanganlar qulf belgisi bilan).
export function ThreadList({ items, loading, query, onQuery, selectedKey, onSelect, onSelectAi, official, channelIdentity, onSelectOfficial }: Props) {
  const showAi = !query || AI_MATCH.includes(query.toLowerCase());
  const showOfficial = !!official?.latest && (!query || OFFICIAL_MATCH.includes(query.toLowerCase()));
  const channelName = channelIdentity?.name || "TrainerTop";
  return (
    <>
      <div className="p-4 border-b border-white/[0.06]">
        <h2 className="font-semibold text-sm mb-3">Chatlar</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input type="text" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Qidirish..." className="input-field !py-2 !pl-9 text-xs" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {showAi && (
          <button onClick={onSelectAi} className={cn("w-full flex items-center gap-3 p-4 text-left transition-colors border-b border-white/[0.06]", selectedKey === "ai" ? "bg-lime/[0.06]" : "hover:bg-lime/[0.03]")}>
            <div className="w-10 h-10 rounded-xl ai-accent flex items-center justify-center shrink-0"><Zap className="h-5 w-5 text-black" /></div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-lime">TrainerTop AI</span>
              <p className="text-xs text-white/40 truncate mt-0.5">Fitness haqida savol bering</p>
            </div>
          </button>
        )}

        {showOfficial && official?.latest && (
          <button onClick={onSelectOfficial} data-testid="official-item"
            className={cn("w-full flex items-center gap-3 p-4 text-left transition-colors border-b border-white/[0.06]", selectedKey === "official" ? "bg-lime/[0.06]" : "hover:bg-white/[0.02]")}>
            <div className="w-10 h-10 rounded-full bg-lime flex items-center justify-center overflow-hidden shrink-0">
              {channelIdentity?.avatar_url ? <img src={channelIdentity.avatar_url} alt="" className="w-full h-full object-cover" /> : <Megaphone className="h-5 w-5 text-black" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold truncate">{channelName} <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-lime/15 text-lime font-semibold align-middle">RASMIY</span></span>
                <span className="text-[10px] text-white/25 shrink-0">{timeAgo(official.latest.created_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className={cn("text-xs truncate", official.unread > 0 ? "text-white/70" : "text-white/40")}>{official.latest.title}</p>
                {official.unread > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-lime text-black text-[10px] font-bold flex items-center justify-center shrink-0" aria-label={`${official.unread} ta o'qilmagan e'lon`}>{official.unread}</span>}
              </div>
            </div>
          </button>
        )}

        {loading ? <div className="p-4 text-center"><Loader2 className="h-4 w-4 text-lime animate-spin mx-auto" /></div>
          : items.length === 0 ? (
            query ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-12 h-12 rounded-full bg-dark-card flex items-center justify-center mb-3"><MessageCircle className="h-5 w-5 text-white/10" /></div>
                <p className="text-sm text-white/30 text-center mb-1">"{query}" bo'yicha chat topilmadi</p>
                <p className="text-[11px] text-white/15 text-center">Trenerlar sahifasidan yangi chat boshlang</p>
              </div>
            ) : <p className="text-xs text-white/20 text-center p-4">Hali chatlar yo'q</p>
          ) : items.map((it) => {
            const key = `${it.kind}:${it.id}`;
            return (
              <button key={key} onClick={() => onSelect(it)} data-testid="thread-item"
                className={cn("w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors border-b border-white/[0.03]", selectedKey === key && "bg-white/[0.03]")}>
                <div className={cn("w-10 h-10 flex items-center justify-center shrink-0 overflow-hidden bg-dark-card relative", it.kind === "group" ? "rounded-xl" : "rounded-full")}>
                  {it.avatar ? <img src={it.avatar} alt="" className={cn("w-full h-full object-cover", (it.locked || it.removed) && "opacity-40")} />
                    : it.kind === "group" ? <Users className="h-4 w-4 text-white/30" /> : <span className="text-xs font-bold text-white/20">{getInitials(it.title)}</span>}
                  {it.locked && <Lock className="h-4 w-4 text-white/60 absolute" />}
                  {it.removed && <Ban className="h-4 w-4 text-red-400/80 absolute" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium truncate">{it.title}</span>
                    <span className="text-[10px] text-white/20 shrink-0 ml-2">{it.time ? timeAgo(it.time) : ""}</span>
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <p className={cn("text-xs truncate", it.locked ? "text-yellow-500/70" : it.removed ? "text-red-400/70" : "text-white/40")}>{it.subtitle}</p>
                    {it.unread > 0 && <span className="ml-2 shrink-0 min-w-[18px] h-[18px] rounded-full bg-lime text-black text-[10px] font-bold flex items-center justify-center" aria-label={`${it.unread} ta o'qilmagan`}>{it.unread}</span>}
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </>
  );
}
