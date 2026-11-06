"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Flag, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { reasonLabel } from "@/lib/chat-moderation";

const FILTERS = [["false", "Ko'rilmagan"], ["true", "Ko'rilgan"], ["all", "Hammasi"]] as const;
const TARGET_LABEL: Record<string, string> = { post: "Post", comment: "Izoh", user: "Foydalanuvchi", lesson: "Darslik" };

function snapshotTitle(r: any): string {
  const s = r.snapshot || {};
  if (r.target_type === "post") return s.caption || "(matnsiz post)";
  if (r.target_type === "comment") return s.content || "";
  if (r.target_type === "lesson") return s.title || "";
  if (r.target_type === "user") return s.full_name || "";
  return "";
}

// Admin › Shikoyatlar: post/izoh/darslik/foydalanuvchiga qilingan umumiy shikoyatlar (chat xabar shikoyatlari bundan mustasno — ular alohida moderatsiya oqimida).
export default function AdminReportsPage() {
  const [filter, setFilter] = useState<string>("false");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content-reports?reviewed=${filter}`);
      const d = await res.json().catch(() => []);
      if (res.ok) setRows(Array.isArray(d) ? d : []); else toast.error(d.message || "Yuklab bo'lmadi");
    } catch { toast.error("Yuklab bo'lmadi"); } finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  const markReviewed = async (r: any) => {
    const res = await fetch(`/api/admin/content-reports/${r.id}`, { method: "PATCH" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(d.message || "Xatolik"); return; }
    toast.success("Ko'rilgan deb belgilandi"); void load();
  };

  return (
    <div>
      <h1 className="text-lg font-bold mb-4 flex items-center gap-2"><Flag className="h-5 w-5 text-lime" />Shikoyatlar</h1>
      <p className="text-xs text-white/30 mb-4">Post, izoh, darslik va foydalanuvchiga qilingan shikoyatlar. Chat xabar shikoyatlari bu yerga kirmaydi.</p>
      <div className="flex gap-2 mb-3">{FILTERS.map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={cn("px-3 py-1.5 rounded-lg text-xs border", filter === k ? "bg-lime-muted text-lime border-lime/30 font-semibold" : "border-white/[0.08] text-white/50")}>{l}</button>)}</div>
      {loading ? <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin text-lime mx-auto" /></div>
        : rows.length === 0 ? <p className="text-xs text-white/30 py-10 text-center">Shikoyat yo'q</p>
        : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="card p-4" data-testid="report-row">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60">{TARGET_LABEL[r.target_type] || r.target_type}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">{reasonLabel(r.reason)}</span>
                  <span className="text-xs text-white/50">Shikoyatchi: {r.reporter?.full_name || "—"}</span>
                  <span className="text-[10px] text-white/30 ml-auto">{new Date(r.created_at).toLocaleString("uz-UZ")}</span>
                </div>
                {snapshotTitle(r) && <p className="text-sm text-white/70 whitespace-pre-line break-words mb-1">{snapshotTitle(r)}</p>}
                {r.note && <p className="text-xs text-white/40 italic mb-2">Izoh: {r.note}</p>}
                {!r.reviewed_at && (
                  <button type="button" onClick={() => markReviewed(r)} className="px-3 py-1.5 rounded-lg text-xs bg-lime/10 text-lime border border-lime/20 flex items-center gap-1">
                    <Check className="h-3 w-3" />Ko'rildi deb belgilash
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
