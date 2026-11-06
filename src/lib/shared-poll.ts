import { useCallback, useSyncExternalStore } from "react";

/**
 * Bitta umumiy "poller": necha komponent obuna bo'lmasin, tarmoqqa BITTA so'rov ketadi.
 * - birinchi obunachi kelganda ishga tushadi, oxirgisi ketganda to'xtaydi (va qiymatni tozalaydi);
 * - tab yashirin (boshqa oynada) bo'lsa so'rov yubormaydi, qaytganda darhol yangilaydi;
 * - oldingi so'rov tugamagan bo'lsa yangisini boshlamaydi.
 * Sabab: Navbar (3 nusxa ko'rinish) va MobileBottomNav har biri alohida har 15–30 soniyada so'rov yuborardi.
 */
export function createSharedPoller<T>(fetcher: () => Promise<T>, intervalMs: number, initial: T) {
  let value = initial;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((l) => l());
  const hidden = () => typeof document !== "undefined" && document.hidden;

  const refresh = async () => {
    if (inFlight || hidden()) return;
    inFlight = true;
    try {
      value = await fetcher();
      emit();
    } catch {
      // Tarmoq xatosi: eski qiymat qoladi, keyingi urinishda qayta uriniladi
    } finally {
      inFlight = false;
    }
  };

  const onVisibility = () => { if (!hidden()) void refresh(); };

  const start = () => {
    void refresh();
    timer = setInterval(() => void refresh(), intervalMs);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
    value = initial; // chiqib ketgan foydalanuvchining ma'lumoti keyingisiga ko'rinmasin
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    getSnapshot: () => value,
    refresh,
    /** Qiymatni darhol o'zgartirish (masalan, "hammasi o'qildi" bosilganda) */
    set(next: T) { value = next; emit(); },
  };
}

// ---- Chat: o'qilmagan xabarlar soni (yengil endpoint: faqat son qaytadi) ----
export const chatUnreadPoller = createSharedPoller<number>(
  async () => {
    const res = await fetch("/api/chat/unread", { cache: "no-store" });
    if (!res.ok) throw new Error("unread");
    const d = await res.json();
    return typeof d.count === "number" ? d.count : 0;
  },
  30_000,
  0
);

// ---- Bildirishnomalar ro'yxati (dropdown uchun) ----
export const notificationsPoller = createSharedPoller<any[]>(
  async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) throw new Error("notifications");
    const d = await res.json();
    if (!Array.isArray(d)) throw new Error("notifications");
    return d;
  },
  60_000,
  []
);

const EMPTY: any[] = [];
const noopSubscribe = () => () => {};

export function useChatUnread(enabled: boolean): number {
  const subscribe = useCallback((l: () => void) => (enabled ? chatUnreadPoller.subscribe(l) : noopSubscribe()), [enabled]);
  const value = useSyncExternalStore(subscribe, chatUnreadPoller.getSnapshot, () => 0);
  return enabled ? value : 0;
}

export function useNotifications(enabled: boolean): any[] {
  const subscribe = useCallback((l: () => void) => (enabled ? notificationsPoller.subscribe(l) : noopSubscribe()), [enabled]);
  const value = useSyncExternalStore(subscribe, notificationsPoller.getSnapshot, () => EMPTY);
  return enabled ? value : EMPTY;
}
