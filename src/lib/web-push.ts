// Web Push (VAPID) — iOS Safari (16.4+, bosh ekranga qo'shilgan holatda) va boshqa Web Push
// qo'llab-quvvatlovchi brauzerlar uchun. Android ilova FCM orqali (lib/push.ts) — bu alohida,
// mustaqil yo'l: VAPID sozlanmagan bo'lsa ham FCM ishlayveradi va aksincha.
//
// NEGA FCM EMAS, STANDART WEB PUSH (VAPID)? Apple WebKit iOS 16.4'dan standart Web Push API'ni
// (Service Worker pushManager.subscribe) to'g'ridan-to'g'ri qo'llab-quvvatlaydi — bu Apple'ning
// o'zi tasdiqlagan, "native" yo'l. Firebase'ning Web SDK'si (FCM for Web) esa texnik jihatdan
// shu API ustiga qurilgan bo'lsa-da, Google tomonidan asosan Chrome uchun sinalgan va Safari'da
// firebase-messaging-sw.js/VAPID interop muammolari ko'p marta xabar qilingan. Shuning uchun
// ishonchlilik ustuvor bo'lgan iOS Safari uchun XOM (Google wrapper'isiz) Web Push to'g'ridan-
// to'g'ri ishlatiladi — kamroq "sehrli" qatlam, Apple'ning o'z hujjatlashtirgan yo'li.
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PushMessage, PushResult } from "@/lib/push";

const VAPID_PUBLIC = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
const VAPID_PRIVATE = (process.env.VAPID_PRIVATE_KEY || "").trim();
const VAPID_SUBJECT = (process.env.VAPID_SUBJECT || "mailto:support@trainertop.uz").trim();
const CONCURRENCY = 20;
const ID_CHUNK = 200;

let configured = false;
try {
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
  }
} catch (e) {
  console.error("Web Push VAPID sozlamasi noto'g'ri:", e);
}

export function isWebPushConfigured(): boolean { return configured; }

export interface WebPushRow { token: string; web_push_keys: { p256dh: string; auth: string } | null }

async function removeSubs(endpoints: string[]) {
  for (let i = 0; i < endpoints.length; i += ID_CHUNK) {
    const { error } = await supabaseAdmin.from("device_tokens").delete().in("token", endpoints.slice(i, i + ID_CHUNK));
    if (error) console.error("web push obunalarini tozalashda xato:", error);
  }
}

async function sendOne(row: WebPushRow, msg: PushMessage): Promise<"sent" | "remove" | "error"> {
  if (!row.web_push_keys?.p256dh || !row.web_push_keys?.auth) return "remove";   // buzilgan yozuv — tozalaymiz
  try {
    await webpush.sendNotification(
      { endpoint: row.token, keys: { p256dh: row.web_push_keys.p256dh, auth: row.web_push_keys.auth } },
      JSON.stringify({ title: msg.title, body: msg.body, route: msg.route, tag: msg.tag }),
    );
    return "sent";
  } catch (e: any) {
    const code = e?.statusCode;
    if (code === 404 || code === 410) return "remove";   // obuna bekor qilingan/eskirgan
    console.error("Web push xatosi:", code || e);
    return "error";
  }
}

export async function deliverWeb(rows: WebPushRow[], msg: PushMessage, result: PushResult) {
  if (!configured) return;
  const uniq = Array.from(new Map(rows.map((r) => [r.token, r])).values());
  result.attempted += uniq.length;
  if (uniq.length === 0) return;
  const dead: string[] = [];
  for (let i = 0; i < uniq.length; i += CONCURRENCY) {
    await Promise.all(uniq.slice(i, i + CONCURRENCY).map(async (row) => {
      const out = await sendOne(row, msg);
      if (out === "sent") result.sent++;
      else if (out === "remove") { result.removed++; dead.push(row.token); }
      else result.failed++;
    }));
  }
  if (dead.length) await removeSubs(dead);
}
