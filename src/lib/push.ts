import { createSign } from "crypto";
import { waitUntil } from "@vercel/functions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getBannedUserIds } from "@/lib/bans";
import { deliverWeb, type WebPushRow } from "@/lib/web-push";

// FCM HTTP v1 orqali Android push. Xabar FAQAT `data` (hamma qiymat string) — `notification` bloki
// YO'Q: ilova bildirishnomani o'zi chizadi va sozlamadagi tugmani hurmat qiladi. Android priority HIGH.
// Service account JSON muhit o'zgaruvchisidan olinadi (repoda saqlanmaydi). O'zgaruvchi yo'q yoki
// noto'g'ri bo'lsa push jimgina o'chiq — xabar yuborishning o'zi hech qachon buzilmaydi.

export interface PushMessage { title: string; body: string; route: string; tag: string }
export interface PushOptions { senderId?: string | null }
export interface PushResult { attempted: number; sent: number; removed: number; failed: number }

export const ENV_NAME = "FIREBASE_SERVICE_ACCOUNT_JSON";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const CONCURRENCY = 20;   // bir vaqtdagi FCM so'rovlari
const ID_CHUNK = 200;     // .in("user_id", ...) uzunligi
const TOKEN_PAGE = 1000;  // "hammaga" yuborishda device_tokens sahifasi
const BODY_MAX = 100;

interface ServiceAccount { client_email: string; private_key: string; project_id: string; token_uri: string }

// ---------------------------------------------------------------- sozlama
let saCache: { raw: string; sa: ServiceAccount | null } | null = null;

// Qiymat oddiy JSON ("{...}") yoki base64 kodlangan JSON bo'lishi mumkin (Vercel'da ko'p qatorli
// qiymat bilan muammo bo'lsa). private_key ichidagi "\n" belgilari haqiqiy yangi qatorga aylantiriladi.
function loadServiceAccount(): ServiceAccount | null {
  const raw = (process.env[ENV_NAME] || "").trim();
  if (!raw) return null;
  if (saCache && saCache.raw === raw) return saCache.sa;
  let sa: ServiceAccount | null = null;
  try {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const o = JSON.parse(json);
    if (typeof o.client_email === "string" && typeof o.private_key === "string" && typeof o.project_id === "string" && o.client_email && o.private_key && o.project_id) {
      sa = {
        client_email: o.client_email, private_key: o.private_key.replace(/\\n/g, "\n"), project_id: o.project_id,
        token_uri: typeof o.token_uri === "string" && o.token_uri.startsWith("https://") ? o.token_uri : DEFAULT_TOKEN_URI,
      };
    }
  } catch { /* quyida xabar beriladi */ }
  if (!sa) console.error(`${ENV_NAME} noto'g'ri (JSON yoki base64-JSON bo'lishi, client_email/private_key/project_id bo'lishi kerak) — push o'chiq`);
  saCache = { raw, sa };
  return sa;
}

export function isPushConfigured(): boolean { return !!loadServiceAccount(); }

// ---------------------------------------------------------------- OAuth (service account → access token)
let tokenCache: { key: string; token: string; exp: number } | null = null;
const b64url = (s: string) => Buffer.from(s).toString("base64url");

async function getAccessToken(sa: ServiceAccount, force = false): Promise<string | null> {
  const now = Date.now();
  if (!force && tokenCache && tokenCache.key === sa.client_email && tokenCache.exp - 60_000 > now) return tokenCache.token;
  try {
    const iat = Math.floor(now / 1000);
    const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: FCM_SCOPE, aud: sa.token_uri, iat, exp: iat + 3600 }));
    const sig = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(sa.private_key).toString("base64url");
    const res = await fetch(sa.token_uri, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${sig}` }).toString(),
    });
    if (!res.ok) { console.error("FCM OAuth xatosi:", res.status); return null; }
    const j = await res.json().catch(() => null);
    if (!j || typeof j.access_token !== "string") { console.error("FCM OAuth javobi noto'g'ri"); return null; }
    tokenCache = { key: sa.client_email, token: j.access_token, exp: now + (Number(j.expires_in) || 3600) * 1000 };
    return tokenCache.token;
  } catch (e) {
    console.error("FCM OAuth xatosi:", e);
    return null;
  }
}

// ---------------------------------------------------------------- bitta token'ga yuborish
type Outcome = "sent" | "remove" | "auth" | "error";

async function sendOne(sa: ServiceAccount, accessToken: string, token: string, msg: PushMessage): Promise<Outcome> {
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          data: { title: String(msg.title), body: String(msg.body), route: String(msg.route), tag: String(msg.tag) },
          android: { priority: "HIGH" },
        },
      }),
    });
    if (res.ok) return "sent";
    if (res.status === 401) return "auth";
    const j = await res.json().catch(() => null);
    const status = j?.error?.status;
    const codes: string[] = Array.isArray(j?.error?.details) ? j.error.details.map((d: any) => d?.errorCode).filter(Boolean) : [];
    // Faqat token haqiqatan yaroqsiz bo'lganda o'chiriladi (NOT_FOUND o'zi — masalan loyiha noto'g'ri sozlangan bo'lishi
    // mumkin — o'chirishga sabab emas, faqat UNREGISTERED xato kodi bilan).
    if (codes.includes("UNREGISTERED") || codes.includes("INVALID_ARGUMENT") || status === "INVALID_ARGUMENT") return "remove";
    console.error("FCM xatosi:", res.status, status || "");
    return "error";
  } catch (e) {
    console.error("FCM so'rovi xatosi:", e);
    return "error";
  }
}

async function removeTokens(tokens: string[]) {
  for (let i = 0; i < tokens.length; i += ID_CHUNK) {
    const { error } = await supabaseAdmin.from("device_tokens").delete().in("token", tokens.slice(i, i + ID_CHUNK));
    if (error) console.error("device_tokens tozalash xatosi:", error);
  }
}

async function deliver(sa: ServiceAccount, tokens: string[], msg: PushMessage, result: PushResult) {
  const uniq = Array.from(new Set(tokens));
  result.attempted += uniq.length;
  if (uniq.length === 0) return;
  let access = await getAccessToken(sa);
  if (!access) { result.failed += uniq.length; return; }
  const dead: string[] = [];
  for (let i = 0; i < uniq.length; i += CONCURRENCY) {
    await Promise.all(uniq.slice(i, i + CONCURRENCY).map(async (token) => {
      let out = await sendOne(sa, access as string, token, msg);
      if (out === "auth") {                       // access token muddati tugagan — bir marta yangilab qayta urinamiz
        const fresh = await getAccessToken(sa, true);
        if (fresh) { access = fresh; out = await sendOne(sa, fresh, token, msg); }
      }
      if (out === "sent") result.sent++;
      else if (out === "remove") { result.removed++; dead.push(token); }
      else result.failed++;
    }));
  }
  if (dead.length) await removeTokens(dead);
}

// ---------------------------------------------------------------- oluvchilarni saralash
// Ban qilingan va yuboruvchi bilan o'zaro bloklangan (ikki tomonlama) foydalanuvchilar chiqarib tashlanadi.
async function blockedWith(senderId: string | null | undefined): Promise<Set<string>> {
  const out = new Set<string>();
  if (!senderId) return out;
  const [a, b] = await Promise.all([
    supabaseAdmin.from("blocks").select("blocked_id").eq("blocker_id", senderId),   // yuboruvchi bloklaganlar
    supabaseAdmin.from("blocks").select("blocker_id").eq("blocked_id", senderId),   // yuboruvchini bloklaganlar
  ]);
  for (const r of a.data || []) out.add((r as any).blocked_id);
  for (const r of b.data || []) out.add((r as any).blocker_id);
  return out;
}

// ---------------------------------------------------------------- ommaviy API
export async function sendPush(userIds: string[], msg: PushMessage, opts: PushOptions = {}): Promise<PushResult> {
  const result: PushResult = { attempted: 0, sent: 0, removed: 0, failed: 0 };
  try {
    const sa = loadServiceAccount();
    const [banned, blocked] = await Promise.all([getBannedUserIds(), blockedWith(opts.senderId)]);
    const skip = new Set<string>(banned.concat(Array.from(blocked)));
    if (opts.senderId) skip.add(opts.senderId);
    const ids = Array.from(new Set((userIds || []).filter((u) => typeof u === "string" && u && !skip.has(u))));
    if (ids.length === 0) return result;

    // FCM (Android) va Web Push (iOS Safari/boshqa brauzer) MUSTAQIL yo'llar — biri sozlanmagan
    // bo'lsa ham ikkinchisi ishlayveradi.
    const tokens: string[] = []; const webRows: WebPushRow[] = [];
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const { data, error } = await supabaseAdmin.from("device_tokens").select("token, platform, web_push_keys").in("user_id", ids.slice(i, i + ID_CHUNK));
      if (error) { console.error("device_tokens o'qish xatosi:", error); continue; }
      for (const r of (data || []) as any[]) {
        if (r.platform === "web") webRows.push({ token: r.token, web_push_keys: r.web_push_keys });
        else tokens.push(r.token);
      }
    }
    await Promise.all([sa ? deliver(sa, tokens, msg, result) : Promise.resolve(), deliverWeb(webRows, msg, result)]);
  } catch (e) {
    console.error("sendPush:", e);
  }
  return result;
}

// Hamma foydalanuvchiga (kanal e'loni, auditoriya = hamma): device_tokens sahifalab o'qiladi.
export async function sendPushToAll(msg: PushMessage, opts: PushOptions = {}): Promise<PushResult> {
  const result: PushResult = { attempted: 0, sent: 0, removed: 0, failed: 0 };
  try {
    const sa = loadServiceAccount();
    const [banned, blocked] = await Promise.all([getBannedUserIds(), blockedWith(opts.senderId)]);
    const skip = new Set<string>(banned.concat(Array.from(blocked)));
    if (opts.senderId) skip.add(opts.senderId);
    for (let from = 0; ; from += TOKEN_PAGE) {
      const { data, error } = await supabaseAdmin.from("device_tokens").select("user_id, token, platform, web_push_keys").order("id", { ascending: true }).range(from, from + TOKEN_PAGE - 1);
      if (error) { console.error("device_tokens o'qish xatosi:", error); break; }
      const rawRows = data || [];   // sahifalash tugashini ANIQLASH uchun — filtrlashdan oldingi xom son
      const rows = rawRows.filter((r: any) => !skip.has(r.user_id));
      const tokens = rows.filter((r: any) => r.platform !== "web").map((r: any) => r.token);
      const webRows: WebPushRow[] = rows.filter((r: any) => r.platform === "web").map((r: any) => ({ token: r.token, web_push_keys: r.web_push_keys }));
      await Promise.all([sa ? deliver(sa, tokens, msg, result) : Promise.resolve(), deliverWeb(webRows, msg, result)]);
      if (rawRows.length < TOKEN_PAGE) break;
    }
  } catch (e) {
    console.error("sendPushToAll:", e);
  }
  return result;
}

// Push matni: qisqa matn yoki "Rasm" / "Ovozli xabar" / "Video".
export function pushBody(type: string | null | undefined, content: string | null | undefined): string {
  if (type === "image") return "Rasm";
  if (type === "voice") return "Ovozli xabar";
  if (type === "video") return "Video";
  const t = String(content || "").replace(/\s+/g, " ").trim();
  if (!t) return "Xabar";
  return t.length > BODY_MAX ? `${t.slice(0, BODY_MAX - 1).trimEnd()}…` : t;
}

// Javobni kutdirmaydi: Vercel'da waitUntil bilan funksiya tugagach ham yakunlanadi; xato bo'lsa ham
// asosiy so'rovga ta'sir qilmaydi (log'ga yoziladi).
export function runInBackground(work: Promise<unknown>): void {
  const safe = work.catch((e) => console.error("Push (fon):", e));
  try { waitUntil(safe); } catch { /* waitUntil yo'q muhitda (lokal/test) — promise baribir davom etadi */ }
}

// Testlar uchun keshni tozalash
export function __resetPushCaches() { saCache = null; tokenCache = null; }
