import { createClient } from "@supabase/supabase-js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveBan } from "@/lib/bans";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";
import { downloadProfilePhoto } from "@/lib/telegram-bot";
import { fullNameFrom, usernameCandidates } from "@/lib/telegram-login";
import { isSyntheticEmail, syntheticEmail, tombstoneEmail } from "@/lib/synthetic-email";

export interface TgUser { id: number; username?: string; first_name?: string; last_name?: string; is_bot?: boolean }

// ---------------------------------------------------------------------------
// Foydalanuvchini topish yoki yaratish (telegram_user_id bo'yicha)
// ---------------------------------------------------------------------------
export async function findOrCreateTelegramUser(tg: TgUser): Promise<{ userId: string; isNew: boolean }> {
  const existing = await findLinked(tg.id);
  if (existing) {
    // Telegram ma'lumotlari o'zgargan bo'lishi mumkin — yangilanadi (xato bo'lsa kirishga xalaqit bermaydi)
    await supabaseAdmin.from("telegram_accounts").update({ username: tg.username ?? null, first_name: tg.first_name ?? null, last_name: tg.last_name ?? null, updated_at: new Date().toISOString() }).eq("telegram_user_id", tg.id);
    return { userId: existing, isNew: false };
  }

  const email = syntheticEmail(tg.id);
  const fullName = fullNameFrom(tg);
  let userId: string;
  const created = await supabaseAdmin.auth.admin.createUser({
    email, email_confirm: true,
    user_metadata: { full_name: fullName, role: "user", provider: "telegram" },
    app_metadata: { provider: "telegram", telegram_id: tg.id },
  });
  if (created.error || !created.data?.user) {
    // Oldingi urinish yarim qolgan bo'lishi mumkin (auth hisobi bor, bog'lanish yo'q) — sintetik email bo'yicha profil topiladi
    const { data: prof } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!prof) throw new Error("Telegram foydalanuvchisini yaratib bo'lmadi");
    userId = prof.id;
  } else userId = created.data.user.id;

  // Profil qatori odatda DB trigger'i bilan yaratiladi; bo'lmasa (yoki kechiksa) o'zimiz ta'minlaymiz
  const { data: prof } = await supabaseAdmin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!prof) {
    const { error: pErr } = await supabaseAdmin.from("profiles").upsert({ id: userId, email, full_name: fullName, role: "user" }, { onConflict: "id" });
    if (pErr) throw pErr;
  }

  const { error: linkErr } = await supabaseAdmin.from("telegram_accounts").insert({ telegram_user_id: tg.id, user_id: userId, username: tg.username ?? null, first_name: tg.first_name ?? null, last_name: tg.last_name ?? null });
  if (linkErr) {
    // Poyga: parallel chaqiruv o'sha Telegram'ni allaqachon bog'lab ulgurgan
    const winner = await findLinked(tg.id);
    if (winner) return { userId: winner, isNew: false };
    throw linkErr;
  }
  await assignUsername(userId, tg.username);
  return { userId, isNew: true };
}

async function findLinked(telegramId: number): Promise<string | null> {
  const { data } = await supabaseAdmin.from("telegram_accounts").select("user_id").eq("telegram_user_id", telegramId).maybeSingle();
  return data?.user_id ?? null;
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
  const { data } = await supabaseAdmin.from("profiles").select("id, full_name, username, avatar_url, role").eq("id", userId).maybeSingle();
  return data ? { id: data.id, full_name: data.full_name, username: data.username ?? null, avatar_url: data.avatar_url ?? null, role: data.role } : { id: userId, full_name: null, username: null, avatar_url: null, role: "user" };
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
