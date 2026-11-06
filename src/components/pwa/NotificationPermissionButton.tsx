"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isPushSupported, isIOS, isStandalone, urlBase64ToUint8Array } from "@/lib/pwa";

// "Bildirishnomalarni yoqish" — FAQAT foydalanuvchi tugma bosganda so'raladi (iOS talabi: ruxsat
// sahifa yuklanishida avtomatik so'ralmasligi kerak). Push qo'llab-quvvatlanmasa (eski brauzer)
// yoki iOS'da hali Safari'dan "Bosh ekranga qo'shish" qilinmagan bo'lsa (standalone emas) — tugma
// o'rniga tushuntirish ko'rsatiladi, chunki iOS'da push FAQAT standalone PWA'da ishlaydi.
export function NotificationPermissionButton() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [needsInstallFirst, setNeedsInstallFirst] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ok = isPushSupported();
    setSupported(ok);
    if (ok) setPermission(Notification.permission);
    if (isIOS() && !isStandalone()) setNeedsInstallFirst(true);
  }, []);

  const enable = async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") { if (perm === "denied") toast.error("Bildirishnomalarga ruxsat berilmadi"); return; }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) { console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY sozlanmagan"); toast.error("Server tomonidan sozlanmagan"); return; }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource });

      const json = sub.toJSON();
      const res = await fetch("/api/devices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: sub.endpoint, platform: "web", keys: json.keys }),
      });
      if (!res.ok) { toast.error("Saqlashda xatolik yuz berdi"); return; }
      toast.success("Bildirishnomalar yoqildi");
    } catch (e) {
      console.error("Push obunasi xatosi:", e);
      toast.error("Bildirishnomalarni yoqib bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  if (!supported) return null;

  if (needsInstallFirst) {
    return (
      <div className="flex items-center gap-2.5 text-sm text-white/40">
        <Bell className="h-4 w-4" />Bildirishnomalar uchun avval ilovani bosh ekranga qo'shing
      </div>
    );
  }

  if (permission === "granted") {
    return (
      <div className="flex items-center gap-2.5 text-sm text-lime">
        <BellRing className="h-4 w-4" />Bildirishnomalar yoqilgan
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-2.5 text-sm text-white/40">
        <Bell className="h-4 w-4" />Bildirishnomalar brauzer sozlamalarida bloklangan
      </div>
    );
  }

  return (
    <button onClick={enable} disabled={loading} className="flex items-center gap-2.5 text-sm text-white/70 hover:text-lime transition-colors disabled:opacity-50">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}Bildirishnomalarni yoqish
    </button>
  );
}
