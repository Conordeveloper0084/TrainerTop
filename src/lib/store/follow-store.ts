import { create } from "zustand";
import { useAuthStore } from "@/lib/store/auth-store";

// Obuna holati HAMMA JOYDA BIR XIL: holat trener (muallif) ID bo'yicha bitta do'konda turadi. Bitta postda "Obuna bo'lish" bosilsa,
// shu muallifning barcha postlarida va profil sahifasida darhol o'zgaradi (bekor qilganda ham).
// Manba: server (GET /api/posts → har postda is_following; GET /api/trainers/{id} → isFollowing; GET /api/athletes/{id} → is_following).
interface FollowState {
  following: Record<string, boolean>;
  pending: Record<string, boolean>;
  // Serverdan kelgan qiymatlar. So'rovi ketayotgan (pending) muallifga tegilmaydi — foydalanuvchining hozirgi bosishi ustun.
  seed: (entries: Array<[string | null | undefined, boolean | null | undefined]>) => void;
  toggle: (id: string) => Promise<{ ok: boolean; following: boolean; followers_count?: number; message?: string }>;
  reset: () => void;
}

export const useFollowStore = create<FollowState>((set, get) => ({
  following: {},
  pending: {},

  seed: (entries) => set((s) => {
    let next: Record<string, boolean> | null = null;
    for (const [id, value] of entries) {
      if (!id || typeof value !== "boolean" || s.pending[id] || s.following[id] === value) continue;
      next = next ?? { ...s.following };
      next[id] = value;
    }
    return next ? { following: next } : s;
  }),

  toggle: async (id) => {
    const before = !!get().following[id];
    if (get().pending[id]) return { ok: false, following: before };
    set((s) => ({ following: { ...s.following, [id]: !before }, pending: { ...s.pending, [id]: true } }));   // optimistik — faqat javob kelguncha
    const finish = (value: boolean) => set((s) => { const { [id]: _done, ...pending } = s.pending; return { following: { ...s.following, [id]: value }, pending }; });
    try {
      const res = await fetch("/api/follows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainer_id: id }) });
      const d: any = await res.json().catch(() => ({}));
      if (!res.ok || typeof d.following !== "boolean") { finish(before); return { ok: false, following: before, message: d.message }; }
      finish(d.following);
      return { ok: true, following: d.following, followers_count: typeof d.followers_count === "number" ? d.followers_count : undefined };
    } catch {
      finish(before);
      return { ok: false, following: before };
    }
  },

  reset: () => set({ following: {}, pending: {} }),
}));

// Komponentlar uchun: shu muallifga obunami (hali ma'lum bo'lmasa — fallback)
export const useIsFollowing = (id: string | null | undefined, fallback = false): boolean =>
  useFollowStore((s) => (id && id in s.following ? s.following[id] : fallback));

// Obuna holati kirgan foydalanuvchiga tegishli: chiqilganda yoki akkaunt almashganda tozalanadi (boshqa odamning holati qolib ketmasin).
// (Mehmon → kirish: tozalanmaydi — mehmonda holat yo'q, kirgandan keyingi ro'yxat esa allaqachon to'g'ri qiymatlarni yozgan bo'lishi mumkin.)
useAuthStore.subscribe((state, prev) => {
  const before = prev.user?.id, now = state.user?.id;
  if (before && before !== now) useFollowStore.getState().reset();
});
