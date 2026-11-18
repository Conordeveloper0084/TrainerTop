"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Trophy } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { formatDateUz } from "@/lib/workout";
import { loadDraft } from "@/lib/workout-client";
import { askConfirm } from "@/components/workouts/confirm";

// Mashg'ulot qatori (bosh sahifa va tarix) — sarlavha, sana, mashqlar, padxodlar soni, yutuqlar
export function SessionRow({ s, today }: { s: any; today: string }) {
  return (
    <Link href={`/workouts/history/${s.id}`} className="flex items-center gap-3 p-4 hover:bg-white/[0.02]" data-testid="session-row">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-semibold text-white truncate">{s.title}</p>
          <span className="text-xs text-white/30 shrink-0">{formatDateUz(s.performed_on, today)}</span>
        </div>
        <p className="text-xs text-white/40 truncate mt-0.5">{(s.exercise_names || []).join(", ")}</p>
        <p className="text-[11px] text-white/30 mt-0.5 flex items-center gap-1">
          {s.exercises_count} mashq · {s.sets_count} padxod
          {s.achievements > 0 && <span className="text-lime flex items-center gap-0.5 ml-1" data-testid="row-achievements"><Trophy className="h-3 w-3" />{s.achievements} yutuq</span>}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-white/20 shrink-0" />
    </Link>
  );
}

export function Spinner() {
  return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 text-lime animate-spin" /></div>;
}

// Mashg'ulotni boshlash: tugallanmagan mashg'ulot bo'lsa — avval so'raladi (bittasi jimgina yo'qolmasin)
export function useStartWorkout() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  return useCallback(async (href: string, label: string) => {
    const draft = user ? loadDraft(user.id) : null;
    if (draft) {
      const ok = await askConfirm({
        title: "Tugallanmagan mashg'ulot bor",
        message: `"${draft.title}" hali saqlanmagan. "${label}"ni boshlasangiz, undagi kiritilgan padxodlar o'chadi.`,
        confirmText: "Yangisini boshlash",
      });
      if (!ok) return;
    }
    router.push(draft ? `${href}${href.includes("?") ? "&" : "?"}new=1` : href);
  }, [router, user]);
}

export function ErrorBox({ message, onRetry, backHref = "/workouts", backText = "Kundalikka qaytish" }: { message: string; onRetry?: () => void; backHref?: string; backText?: string }) {
  return (
    <div className="container-main py-16 text-center">
      <p className="text-sm text-white/40 mb-4">{message}</p>
      {onRetry ? <button type="button" onClick={onRetry} className="btn-soft !py-2 !px-5 text-sm">Qayta urinish</button>
        : <Link href={backHref} className="btn-soft !py-2 !px-5 text-sm">{backText}</Link>}
    </div>
  );
}
