"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { WorkoutGate } from "@/components/workouts/WorkoutGate";
import { ErrorBox, Spinner } from "@/components/workouts/common";
import { askConfirm } from "@/components/workouts/confirm";
import { formatDateUz, formatKg, isAchievement, localToday, outcomeBadge, type Outcome } from "@/lib/workout";
import { loadDraft, wapi } from "@/lib/workout-client";

// Bitta mashg'ulot: har mashq padxodlari + oldingi mashg'ulotga nisbatan natija (rekord / vazn oshdi / takror oshdi)
export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const router = useRouter();
  const [s, setS] = useState<any>(null);
  const [error, setError] = useState("");
  const today = localToday();
  useEffect(() => {
    if (!user) return;
    wapi(`/sessions/${params.id}`).then((d: any) => setS(d.session)).catch((e) => setError(e.message));
  }, [user, params.id]);

  const edit = async () => {
    const d = user ? loadDraft(user.id) : null;
    if (d && d.id !== s.id && !(await askConfirm({ title: "Tugallanmagan mashg'ulot bor", message: `"${d.title}" hali saqlanmagan. Uni bekor qilib, bu mashg'ulotni tahrirlaysizmi?`, confirmText: "Ha, tahrirlash" }))) return;
    router.push(`/workouts/log?session=${s.id}${d && d.id !== s.id ? "&new=1" : ""}`);
  };
  const remove = async () => {
    if (!(await askConfirm({ title: "Mashg'ulot o'chirilsinmi?", message: "Uning natijalari statistika va hisobotdan ham olib tashlanadi. Buni qaytarib bo'lmaydi." }))) return;
    try { await wapi(`/sessions/${s.id}`, { method: "DELETE" }); toast.success("Mashg'ulot o'chirildi"); router.push("/workouts/history"); }
    catch (e: any) { toast.error(e.message); }
  };

  if (!ready) return <Spinner />;
  if (!user) return <WorkoutGate />;
  if (error) return <ErrorBox message={error} backHref="/workouts/history" backText="Tarixga qaytish" />;
  if (!s) return <Spinner />;
  const wins = (s.exercises || []).filter((x: any) => x.outcome && isAchievement(x.outcome)).length;
  return (
    <div className="container-main py-6 max-w-xl" data-testid="session-detail">
      <Link href="/workouts/history" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white mb-4"><ChevronLeft className="h-3.5 w-3.5" />Tarix</Link>
      <h1 className="text-page-title text-white">{s.title}</h1>
      <p className="text-sm text-white/40 mt-1 mb-4">
        {formatDateUz(s.performed_on, today)} · {s.exercises.length} mashq · {s.sets_count} padxod
        {wins > 0 && <span className="text-lime"> · {wins} yutuq</span>}
      </p>
      {s.note && <p className="text-sm text-white/70 card p-3 mb-4 whitespace-pre-line">{s.note}</p>}
      <div className="space-y-3">
        {s.exercises.map((x: any) => {
          const o: Outcome | null = x.outcome;
          const bw = x.exercise.is_bodyweight;
          return (
            <div key={x.exercise.id} className="card p-4" data-testid="detail-exercise">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Link href={`/workouts/exercises/${x.exercise.id}`} className="min-w-0 group">
                  <p className="text-[15px] font-semibold text-white truncate group-hover:text-lime">{x.exercise.name}</p>
                  <p className="text-[11px] text-lime flex items-center">Progress<ChevronRight className="h-3 w-3" /></p>
                </Link>
                {o && isAchievement(o) && (   // faqat yutuqlar (pastroq natija jazolanmaydi — u mashq statistikasida tushuntiriladi)
                  <span data-testid="outcome-badge" data-type={o.type}
                    className={cn("shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full flex items-center gap-1",
                      o.type === "record" ? "bg-amber-400/15 text-amber-400" : "bg-lime-muted text-lime")}>
                    {o.type === "record" && <Trophy className="h-3 w-3" />}{outcomeBadge(o)}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {x.sets.map((y: any, i: number) => (
                  <div key={i} className="flex items-center text-sm gap-3" data-testid="detail-set">
                    <span className="w-5 text-white/30 text-xs">{i + 1}</span>
                    <span className="text-white">{bw && Number(y.weight_kg) === 0 ? `${y.reps} takror` : `${formatKg(Number(y.weight_kg))} kg × ${y.reps}`}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={edit} className="btn-ghost w-full !py-3 text-sm mt-6 flex items-center justify-center gap-2" data-testid="edit-session"><Pencil className="h-4 w-4" />Tahrirlash</button>
      <button type="button" onClick={remove} className="w-full mt-2 py-3 text-sm text-red-400 flex items-center justify-center gap-1.5" data-testid="delete-session"><Trash2 className="h-4 w-4" />O'chirish</button>
    </div>
  );
}
