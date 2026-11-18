"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { WorkoutGate } from "@/components/workouts/WorkoutGate";
import { SessionRow, Spinner } from "@/components/workouts/common";
import { localToday } from "@/lib/workout";
import { wapi } from "@/lib/workout-client";

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const PAGE = 20;

// Mashg'ulotlar tarixi — oylar bo'yicha guruhlangan, "Yana" bilan sahifalanadi
export default function HistoryPage() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [list, setList] = useState<any[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = localToday();

  const load = useCallback(async (offset: number) => {
    setBusy(true); setError("");
    try {
      const r = await wapi<{ sessions: any[]; has_more: boolean }>(`/sessions?limit=${PAGE}&offset=${offset}`);
      setList((l) => (offset === 0 ? r.sessions : [...(l || []), ...r.sessions])); setHasMore(r.has_more);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }, []);
  useEffect(() => { if (user) load(0); }, [user, load]);

  if (!ready) return <Spinner />;
  if (!user) return <WorkoutGate />;

  const groups: { key: string; label: string; items: any[] }[] = [];
  for (const s of list || []) {
    const key = s.performed_on.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, label: `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`, items: [] }; groups.push(g); }
    g.items.push(s);
  }
  return (
    <div className="container-main py-6 max-w-2xl" data-testid="history">
      <Link href="/workouts" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white mb-4"><ChevronLeft className="h-3.5 w-3.5" />Kundalik</Link>
      <h1 className="text-page-title text-white mb-5">Tarix</h1>
      {list === null ? (error ? <p className="text-sm text-white/40 text-center py-10">{error}</p> : <Spinner />) : list.length === 0 ? (
        <p className="text-sm text-white/30 card p-6 text-center">Hali mashg'ulot yozilmagan</p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="text-xs text-white/40 mb-2 px-1">{g.label} · {g.items.length} ta</p>
              <div className="card divide-y divide-white/[0.06]">{g.items.map((s) => <SessionRow key={s.id} s={s} today={today} />)}</div>
            </div>
          ))}
          {hasMore && (
            <button type="button" onClick={() => load(list.length)} disabled={busy} className="btn-ghost w-full !py-2.5 text-sm" data-testid="load-more">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Yana ko'rsatish"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
