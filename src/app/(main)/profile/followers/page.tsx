"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { getInitials, timeAgo } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { AthleteBadge } from "@/components/ui/AthleteBadge";

interface Row { id: string; full_name: string; avatar_url: string | null; role: string; followed_at: string; is_student: boolean; badge: "trainer" | "athlete" | null }

// Mening obunachilarim: kim obuna bo'lgan, qachon, shogirdmi (trener uchun). Faqat o'zining ro'yxati.
export default function FollowersPage() {
  const user = useAuthStore((s) => s.user);
  const [rows, setRows] = useState<Row[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(0); 
  const [loading, setLoading] = useState(true); const [more, setMore] = useState(false); const [q, setQ] = useState("");

  const load = useCallback(async (p: number, append: boolean) => {
    if (append) setMore(true); else setLoading(true);
    try {
      const res = await fetch(`/api/followers?page=${p}&q=${encodeURIComponent(q.trim())}`); const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.message || "Yuklab bo'lmadi"); return; }
      setRows((prev) => (append ? [...prev, ...d.rows] : d.rows)); setTotal(d.total || 0); setPage(p);
    } catch { toast.error("Yuklab bo'lmadi"); } finally { setLoading(false); setMore(false); }
  }, [q]);

  useEffect(() => { if (!user) return; const t = setTimeout(() => void load(0, false), q ? 300 : 0); return () => clearTimeout(t); }, [user?.id, q, load]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return <div className="container-main py-16 text-center text-sm text-white/40">Obunachilarni ko'rish uchun <Link href="/login" className="text-lime underline">tizimga kiring</Link></div>;
  return (
    <div className="container-main py-8 max-w-2xl">
      <Link href="/profile" className="text-xs text-white/40 hover:text-white flex items-center gap-1 mb-4"><ChevronLeft className="h-3.5 w-3.5" />Profil</Link>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-lg font-bold flex items-center gap-2"><Users className="h-5 w-5 text-lime" />Obunachilarim</h1><span className="text-xs text-white/30" data-testid="followers-total">{total} ta</span>
        <div className="relative ml-auto"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism bo'yicha..." aria-label="Qidirish" className="input-field !py-1.5 !pl-8 text-xs w-44" /></div>
      </div>
      {loading ? <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin text-lime mx-auto" /></div> : rows.length === 0 ? (
        <div className="card p-10 text-center"><p className="text-sm text-white/40">{q ? "Bunday obunachi topilmadi" : "Hali obunachilar yo'q"}</p>{!q && <p className="text-[11px] text-white/25 mt-1">Post joylang va ular sizni kuzata boshlaydi</p>}</div>
      ) : (
        <div className="card divide-y divide-white/[0.04]">
          {rows.map((r) => (
            <Link key={r.id} href={r.role === "trainer" ? `/trainers/${r.id}` : `/athletes/${r.id}`} data-testid="follower-row" className="p-4 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
              <div className="w-10 h-10 rounded-full bg-dark-card flex items-center justify-center overflow-hidden shrink-0">{r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-white/20">{getInitials(r.full_name)}</span>}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5">{r.full_name}{r.badge && <AthleteBadge size={15} kind={r.badge} />}</p>
                <p className="text-[11px] text-white/30">{timeAgo(r.followed_at)} obuna bo'ldi</p>
              </div>
              {r.role === "trainer" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-lime-muted text-lime">Trener</span>}
              {r.is_student && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400">Shogird</span>}
            </Link>
          ))}
        </div>
      )}
      {!loading && rows.length < total && <div className="text-center mt-4"><button onClick={() => load(page + 1, true)} disabled={more} className="text-xs text-lime disabled:opacity-40">{more ? "Yuklanmoqda..." : "Ko'proq ko'rsatish"}</button></div>}
    </div>
  );
}
