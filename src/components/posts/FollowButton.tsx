"use client";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { useFollowStore, useIsFollowing } from "@/lib/store/follow-store";

// "Obuna bo'lish" / "Obuna bo'lingan" — holat umumiy do'kondan (muallif ID bo'yicha), shuning uchun bitta postda bosilsa
// shu muallifning barcha postlarida va profil sahifasida darhol o'zgaradi. `initial` — server bergan qiymat (do'konda hali bo'lmasa).
const defaultNavigate = (url: string) => { window.location.href = url; };

export function FollowButton({ authorId, initial = false, className, onChange, navigate = defaultNavigate }: {
  authorId: string; initial?: boolean; className?: string; onChange?: (r: { following: boolean; followers_count?: number }) => void; navigate?: (url: string) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const following = useIsFollowing(authorId, initial);
  const busy = useFollowStore((s) => !!s.pending[authorId]);
  if (user?.id === authorId) return null;         // o'ziga obuna bo'lib bo'lmaydi

  const click = async () => {
    if (!user) { navigate("/login"); return; }
    // Do'konda hali qiymat yo'q bo'lsa (faqat `initial` ma'lum) — avval uni yozamiz, toggle shundan hisoblaydi
    if (!(authorId in useFollowStore.getState().following)) useFollowStore.getState().seed([[authorId, initial]]);
    const r = await useFollowStore.getState().toggle(authorId);
    if (!r.ok) { if (r.message) toast.error(r.message); else toast.error("Bajarib bo'lmadi. Qayta urinib ko'ring"); return; }
    onChange?.({ following: r.following, followers_count: r.followers_count });
  };

  return (
    <button type="button" onClick={click} disabled={busy} aria-pressed={following} data-testid="follow-btn"
      className={cn("shrink-0 whitespace-nowrap rounded-button px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
        following ? "border border-white/20 text-white/60 hover:border-white/20" : "bg-lime text-black hover:brightness-110", className)}>
      {following ? "Obuna bo'lingan" : "Obuna bo'lish"}
    </button>
  );
}
