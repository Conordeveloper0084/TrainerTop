import { createClient } from "@supabase/supabase-js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveBan } from "@/lib/bans";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { downloadProfilePhoto } from "@/lib/telegram-bot";
import { fullNameFrom, maskPhone, usernameCandidates } from "@/lib/telegram-login";
import { isSyntheticEmail, syntheticEmail, tombstoneEmail } from "@/lib/synthetic-email";

export interface TgUser { id: number; username?: string; first_name?: string; last_name?: string; is_bot?: boolean }

// ---------------------------------------------------------------------------
// Akkauntni aniqlash (tasdiqdan keyin). Qaror BAZADA, bitta tranzaksiyada (tg_identify):
//   1) Telegram allaqachon bog'langan akkaunt → o'sha (raqami bo'lmasa yoziladi; boshqacha bo'lsa yangilanadi, eskisi tarixga);
//   2) yo'q, lekin shu TASDIQLANGAN raqamli akkaunt bor → Telegram o'sha akkauntga ulanadi (dublikat ochilmaydi);
//   3) hech biri yo'q → yangi akkaunt (raqam bilan);
//   4) to'qnashuv (Telegram B ga, raqam boshqa A ga tegishli) → B ga kiriladi, raqam o'zgarmaydi, hodisa admin uchun yoziladi.
// Auth foydalanuvchisini yaratish bazada mumkin emas, shuning uchun 2 bosqich: tg_identify "needs_new" desa — yaratamiz va
// p_new_user_id bilan qayta chaqiramiz (baza qayta tekshiradi; poyga bo'lsa ortiqcha foydalanuvchi o'chiriladi).
// ---------------------------------------------------------------------------
export type IdentifyOutcome = "existing" | "phone_account" | "new" | "phone_required" | "phone_taken_other_telegram";
export interface IdentifyResult { outcome: IdentifyOutcome; userId: string | null; isNew: boolean; phoneEvent: string; conflict: boolean }

export async function identifyTelegramUser(tg: TgUser, phone: string | null): Promise<IdentifyResult> {
  const call = async (newUserId: string | null) => {
    const { data, error } = await supabaseAdmin.rpc("tg_identify", { p_telegram_user_id: tg.id, p_phone: phone, p_username: tg.username ?? null, p_first_name: tg.first_name ?? null, p_last_name: tg.last_name ?? null, p_new_user_id: newUserId });
    if (error) throw error;
    const r: any = Array.isArray(data) ? data[0] : data;
    if (!r?.outcome) throw new Error("tg_identify: natija qaytmadi");
    return r;
  };
  const shape = (r: any): IdentifyResult => ({ outcome: r.outcome, userId: r.user_id ?? null, isNew: !!r.is_new, phoneEvent: r.phone_event ?? "none", conflict: !!r.conflict });

  let r = await call(null);
  if (r.outcome === "needs_new") {
    const { userId, created } = await createTelegramAuthUser(tg);
    r = await call(userId);
    if (r.outcome === "new") await assignUsername(userId, tg.username);
    else if (created) await discardOrphanUser(userId);         // poyga: boshqa chaqiruv akkaunt ochib ulgurgan
  }
  return shape(r);
}

// Telegram bog'langan foydalanuvchi va uning TASDIQLANGAN raqami (botda raqam so'rash kerakmi — shundan bilinadi)
export async function findLinkedUser(telegramId: number): Promise<{ userId: string; fullName: string | null; phone: string | null } | null> {
  const { data: acc } = await supabaseAdmin.from("telegram_accounts").select("user_id").eq("telegram_user_id", telegramId).maybeSingle();
  if (!acc?.user_id) return null;
  const { data: prof } = await supabaseAdmin.from("profiles").select("full_name, phone").eq("id", acc.user_id).maybeSingle();
  return { userId: acc.user_id, fullName: prof?.full_name ?? null, phone: prof?.phone ?? null };
}

async function createTelegramAuthUser(tg: TgUser): Promise<{ userId: string; created: boolean }> {
  const email = syntheticEmail(tg.id);
  const fullName = fullNameFrom(tg);
  let userId: string, created = true;
  const res = await supabaseAdmin.auth.admin.createUser({
    email, email_confirm: true,
    user_metadata: { full_name: fullName, role: "user", provider: "telegram" },
    app_metadata: { provider: "telegram", telegram_id: tg.id },
  });
  if (res.error || !res.data?.user) {
    // Oldingi urinish yarim qolgan bo'lishi mumkin (auth hisobi bor, bog'lanish yo'q) — sintetik email bo'yicha profil topiladi
    const { data: prof } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!prof) throw new Error("Telegram foydalanuvchisini yaratib bo'lmadi");
    userId = prof.id; created = false;
  } else userId = res.data.user.id;

  // Profil qatori odatda DB trigger'i bilan yaratiladi; bo'lmasa (yoki kechiksa) o'zimiz ta'minlaymiz
  const { data: prof } = await supabaseAdmin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!prof) {
    const { error: pErr } = await supabaseAdmin.from("profiles").upsert({ id: userId, email, full_name: fullName, role: "user" }, { onConflict: "id" });
    if (pErr) throw pErr;
  }
  return { userId, created };
}

async function discardOrphanUser(userId: string): Promise<void> {
  try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch (e: any) { console.error("Ortiqcha Telegram foydalanuvchisini o'chirish:", e?.message || e); }
}

// Telegram username bo'yicha taklif; band/yaroqsiz bo'lsa raqam qo'shib. Hech biri o'tmasa username bo'sh qoladi (keyin o'zi qo'yadi).
export async function assignUsername(userId: string, tgUsername: string | undefined | null): Promise<string | null> {
  for (const cand of usernameCandidates(tgUsername)) {
    const { error } = await supabaseAdmin.rpc("set_username", { p_user: userId, p_username: cand });
    if (!error) return cand;
    if (!/TAKEN|RESERVED|BAD_FORMAT/.test(error.message || "")) { console.error("Username berishda xato:", error.message); return null; }
  }
  return null;
}

// Yangi foydalanuvchi uchun Telegram profil rasmi → R2 (faqat avatar bo'sh bo'lsa). Best-effort: xato kirishga ta'sir qilmaydi.
export async function syncTelegramAvatar(userId: string, telegramId: number): Promise<string | null> {
  try {
    const photo = await downloadProfilePhoto(telegramId); if (!photo) return null;
    const { data: prof } = await supabaseAdmin.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
    if (!prof || prof.avatar_url) return null;
    const key = `avatars/${userId}/img-${Date.now()}-${randomUUID().slice(0, 8)}.${photo.ext}`;
    await r2Client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: photo.buffer, ContentType: photo.mime, CacheControl: "public, max-age=31536000" }));
    const url = `${R2_PUBLIC_URL}/${key}`;
    await supabaseAdmin.from("profiles").update({ avatar_url: url }).eq("id", userId).is("avatar_url", null);
    return url;
  } catch (e: any) { console.error("Telegram avatar:", e?.message || e); return null; }
}

// ---------------------------------------------------------------------------
// Supabase sessiyasi (parolsiz): admin.generateLink(magiclink) → verifyOtp(token_hash) SERVER tomonida.
// Nega aynan shu: standart Supabase sessiyasi (access + REFRESH token) qaytadi — SDK'lar odatdagidek yangilaydi;
// parol o'rnatilmaydi/o'zgartirilmaydi; JWT secret ishlatilmaydi. Token bir martalik (verifyOtp'dan keyin yaroqsiz).
// ---------------------------------------------------------------------------
export type SessionErrorCode = "BANNED" | "USER_NOT_FOUND" | "SESSION_FAILED";
export class SessionError extends Error { constructor(public code: SessionErrorCode, msg?: string) { super(msg || code); } }
export interface IssuedSession { access_token: string; refresh_token: string; expires_in: number; expires_at: number; token_type: string }

export async function issueSession(userId: string): Promise<IssuedSession> {
  if (await getActiveBan(userId)) throw new SessionError("BANNED");
  const { data: u, error: uErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  if (uErr || !email) throw new SessionError("USER_NOT_FOUND");

  const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = (link as any)?.properties?.hashed_token as string | undefined;
  if (lErr || !tokenHash) throw new SessionError("SESSION_FAILED", lErr?.message);

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  let lastMsg = "";
  // 'magiclink' — generateLink(magiclink) tokeni uchun; ba'zi versiyalarda 'email' turi ham shu tokenni qabul qiladi
  for (const type of ["magiclink", "email"] as const) {
    const { data, error } = await anon.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error && data?.session) {
      const s = data.session;
      return { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + s.expires_in, token_type: s.token_type || "bearer" };
    }
    lastMsg = error?.message || "sessiya yo'q";
    if ((error as any)?.code === "user_banned" || /banned/i.test(lastMsg)) throw new SessionError("BANNED");
  }
  throw new SessionError("SESSION_FAILED", lastMsg);
}

export async function getPublicUser(userId: string) {
  const { data } = await supabaseAdmin.from("profiles").select("id, full_name, username, avatar_url, role, phone").eq("id", userId).maybeSingle();
  // Raqamning o'zi HECH QACHON qaytarilmaydi — faqat maska
  return data
    ? { id: data.id, full_name: data.full_name, username: data.username ?? null, avatar_url: data.avatar_url ?? null, role: data.role, phone_masked: maskPhone(data.phone) }
    : { id: userId, full_name: null, username: null, avatar_url: null, role: "user", phone_masked: null };
}

// ---------------------------------------------------------------------------
// Akkauntni o'chirishda (DELETE /api/account): Telegram bog'lanishi o'chadi; sintetik email (Telegram ID'ni ochib turadi)
// "o'chirilgan" belgisiga almashtiriladi — shunda o'sha Telegram keyin yangi akkaunt ochishi mumkin va ID saqlanib qolmaydi.
// ---------------------------------------------------------------------------
export async function unlinkTelegram(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("telegram_accounts").delete().eq("user_id", userId);
  if (error) throw error;
  try {
    const { data: prof } = await supabaseAdmin.from("profiles").select("email").eq("id", userId).maybeSingle();
    if (prof?.email && isSyntheticEmail(prof.email)) {
      const tomb = tombstoneEmail(userId);
      const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: tomb, email_confirm: true });
      if (aErr) throw aErr;
      await supabaseAdmin.from("profiles").update({ email: tomb }).eq("id", userId);
    }
  } catch (e: any) { console.error("Telegram email'ini almashtirish:", e?.message || e); }
}
