"use client";

// "Telegram orqali kirish" va "Telegram'ni ulash" uchun umumiy qismlar (rang, ikonka, qurilma id, telefon aniqlash).
export const TG_BLUE = "#229ED9";
export const NEW_TG_USER_FLAG = "tt_tg_new_user";   // Telegram orqali YANGI akkaunt ochilganda bir martalik eslatma uchun

export function getDeviceId(): string | undefined {
  try {
    let id = localStorage.getItem("tt_device_id");
    if (!id) { id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`) + "-web"; localStorage.setItem("tt_device_id", id); }
    return id;
  } catch { return undefined; }
}
export const isMobileUA = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export function PlaneIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}
