"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { reasonLabel } from "@/lib/chat-moderation";

interface Props {
  group: { id: string; name: string; avatar_url?: string | null; lesson?: { id: string; title: string } | null; mod?: { reason?: string | null; note?: string | null; by_admin?: boolean; at?: string | null } | null };
  onDismissed: () => void;
}

// Guruhdan CHIQARILGAN a'zo uchun: guruh ro'yxatda turadi, sabab ko'rsatiladi. Darslikka kirish saqlanadi (bu qulf EMAS).
export function RemovedGroup({ group, onDismissed }: Props) {
  const [busy, setBusy] = useState(false);
  const mod = group.mod || {};
  const dismiss = async () => {
    if (!window.confirm("Guruhni chat ro'yxatidan olib tashlaysizmi?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/chat/groups/${group.id}/leave`, { method: "POST" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || "Xatolik"); }
      onDismissed();
    } catch (e: any) { toast.error(e.message || "Xatolik"); } finally { setBusy(false); }
  };
  return (
    <div className="flex-1 flex items-center justify-center p-6" data-testid="removed-group">
      <div className="max-w-sm w-full text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 mx-auto mb-5 flex items-center justify-center"><Ban className="h-8 w-8 text-red-400" /></div>
        <h3 className="text-lg font-bold mb-1">{group.name}</h3>
        <p className="text-sm text-white/60 mb-4">Siz bu guruhdan {mod.by_admin ? "administratsiya" : "trener"} tomonidan chiqarilgansiz.</p>
        <div className="bg-dark-card rounded-xl p-3 text-left mb-4 space-y-1.5">
          <p className="text-[11px] text-white/30">Sabab</p>
          <p className="text-sm font-medium">{reasonLabel(mod.reason)}</p>
          {mod.note && <p className="text-xs text-white/60 whitespace-pre-line">{mod.note}</p>}
          {mod.at && <p className="text-[10px] text-white/30">{new Date(mod.at).toLocaleDateString("uz-UZ")}</p>}
        </div>
        <p className="text-xs text-lime/80 mb-5">Darslikka kirishingiz saqlanadi{group.lesson ? <> — <Link href={`/lessons/${group.lesson.id}`} className="underline">darslikka o'tish</Link></> : null}.</p>
        <p className="text-[11px] text-white/40 mb-4">Xato deb o'ylasangiz, <Link href="/support" className="text-lime underline">support</Link>ga yozing.</p>
        <button onClick={dismiss} disabled={busy} className="text-xs text-white/40 hover:text-white disabled:opacity-40">Ro'yxatdan olib tashlash</button>
      </div>
    </div>
  );
}
