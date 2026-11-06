import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveBan } from "@/lib/bans";
import { runInBackground } from "@/lib/push";
import { answerCallbackQuery, editMessageText, sendMessage } from "@/lib/telegram-bot";
import { findOrCreateTelegramUser, syncTelegramAvatar, type TgUser } from "@/lib/telegram-auth";
import { BAN_MESSAGE, confirmText, isValidLoginId, normalizePhone, PLATFORMS, type LoginPlatform } from "@/lib/telegram-login";

// Login botining webhook mantig'i. Muhim qoida: /start HECH QACHON sessiya bermaydi va akkaunt yaratmaydi —
// faqat TASDIQ tugmasi (callback) shuni qiladi (birov boshqa odamga havola yuborib uning nomidan kirib olmasligi uchun).

export interface TgUpdate {
  message?: { message_id: number; chat: { id: number; type: string }; from?: TgUser; text?: string; contact?: { phone_number: string; user_id?: number } };
  callback_query?: { id: string; from: TgUser; data?: string; message?: { message_id: number; chat: { id: number; type: string } } };
}

export const TEXT = {
  greeting: "TrainerTop'ga kirish uchun sayt yoki ilovadagi «Telegram orqali kirish» tugmasini bosing.",
  stale: "Bu havola eskirgan yoki allaqachon ishlatilgan. Sayt yoki ilovada «Telegram orqali kirish» tugmasini qayta bosing.",
  confirmBtn: "✅ Kirishni tasdiqlash", cancelBtn: "❌ Bekor qilish",
  cancelled: "❌ Bekor qilindi. Hech narsa o'zgarmadi.",
  done: "✅ Tayyor! Ilovaga (saytga) qayting.",
  askContact: "Ixtiyoriy: telefon raqamingizni ulashishingiz mumkin. Shart emas — to'g'ridan-to'g'ri ilovaga qaytavering.",
  contactBtn: "📱 Raqamni ulashish",
  foreignContact: "Faqat o'zingizning raqamingizni ulashing (pastdagi tugma orqali).",
  notLinked: "Avval saytda yoki ilovada «Telegram orqali kirish» orqali kirishni tasdiqlang.",
  badPhone: "Raqamni o'qib bo'lmadi. Pastdagi tugma orqali qayta ulashing.",
  phoneSaved: "✅ Raqamingiz saqlandi.",
  error: "Xatolik yuz berdi. Bir ozdan keyin sayt yoki ilovada qayta urinib ko'ring.",
};

type LoginRow = { id: string; status: string; expires_at: string; platform: LoginPlatform };
async function getLogin(id: string): Promise<LoginRow | null> {
  const { data } = await supabaseAdmin.from("telegram_login_requests").select("id, status, expires_at, platform").eq("id", id).maybeSingle();
  return (data as LoginRow) ?? null;
}
const isOpen = (r: LoginRow | null): r is LoginRow => !!r && r.status === "pending" && Date.parse(r.expires_at) > Date.now() && PLATFORMS.includes(r.platform);

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  const m = update.message;
  if (!m || m.chat.type !== "private" || !m.from || m.from.is_bot) return;      // faqat shaxsiy suhbat, botlarsiz
  if (m.contact) return handleContact(m.chat.id, m.from, m.contact);
  const text = (m.text || "").trim();
  if (/^\/start(@\w+)?(\s|$)/.test(text)) return handleStart(m.chat.id, text.replace(/^\/start(@\w+)?\s*/, ""));
  await sendMessage(m.chat.id, TEXT.greeting);
}

async function handleStart(chatId: number, payload: string) {
  const loginId = payload.startsWith("login_") ? payload.slice(6) : "";
  if (!isValidLoginId(loginId)) return void (await sendMessage(chatId, TEXT.greeting));
  const row = await getLogin(loginId);
  if (!isOpen(row)) return void (await sendMessage(chatId, TEXT.stale));
  // Faqat tasdiq so'raladi — sessiya/akkaunt YO'Q
  await sendMessage(chatId, confirmText(row.platform), { reply_markup: { inline_keyboard: [[{ text: TEXT.confirmBtn, callback_data: `ok:${row.id}` }, { text: TEXT.cancelBtn, callback_data: `no:${row.id}` }]] } });
}

async function handleCallback(q: NonNullable<TgUpdate["callback_query"]>) {
  const chat = q.message?.chat, msgId = q.message?.message_id;
  const m = /^(ok|no):([0-9a-f-]{36})$/i.exec(q.data || "");
  const finish = async (toast: string, text?: string, extra: Record<string, unknown> = {}) => {
    await answerCallbackQuery(q.id, toast).catch(() => undefined);
    if (text && chat && msgId) await editMessageText(chat.id, msgId, text, { reply_markup: { inline_keyboard: [] }, ...extra }).catch(() => undefined);
  };
  if (!m || !isValidLoginId(m[2]) || !chat || chat.type !== "private" || q.from.is_bot) return void (await finish(""));
  const [, action, loginId] = m;

  if (action === "no") {
    await supabaseAdmin.rpc("tg_login_cancel", { p_login_id: loginId });
    return void (await finish("Bekor qilindi", TEXT.cancelled));
  }

  if (!isOpen(await getLogin(loginId))) return void (await finish("Havola eskirgan", TEXT.stale));
  try {
    const { userId, isNew } = await findOrCreateTelegramUser(q.from);
    if (await getActiveBan(userId)) {
      await supabaseAdmin.rpc("tg_login_cancel", { p_login_id: loginId });
      return void (await finish("Akkaunt bloklangan", BAN_MESSAGE));
    }
    const { data } = await supabaseAdmin.rpc("tg_login_confirm", { p_login_id: loginId, p_telegram_user_id: q.from.id, p_user_id: userId, p_is_new: isNew });
    if (!(Array.isArray(data) ? data.length : data)) return void (await finish("Havola eskirgan", TEXT.stale));   // poyga/eskirdi — hech narsa tasdiqlanmadi
    await finish("Tasdiqlandi", TEXT.done);
    await sendMessage(chat.id, TEXT.askContact, { reply_markup: { keyboard: [[{ text: TEXT.contactBtn, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } }).catch(() => undefined);
    if (isNew) runInBackground(syncTelegramAvatar(userId, q.from.id));
  } catch (e: any) {
    console.error("Telegram tasdiqlash:", e?.message || e);
    await finish("Xatolik", TEXT.error);
  }
}

async function handleContact(chatId: number, from: TgUser, contact: { phone_number: string; user_id?: number }) {
  // Boshqa odamning raqamini yuborib bo'lmaydi: kontakt egasi == yuboruvchi bo'lishi shart
  if (!contact.user_id || contact.user_id !== from.id) return void (await sendMessage(chatId, TEXT.foreignContact));
  const { data: acc } = await supabaseAdmin.from("telegram_accounts").select("telegram_user_id").eq("telegram_user_id", from.id).maybeSingle();
  if (!acc) return void (await sendMessage(chatId, TEXT.notLinked, { reply_markup: { remove_keyboard: true } }));
  const phone = normalizePhone(contact.phone_number);
  if (!phone) return void (await sendMessage(chatId, TEXT.badPhone));
  const { error } = await supabaseAdmin.from("telegram_accounts").update({ phone, updated_at: new Date().toISOString() }).eq("telegram_user_id", from.id);
  if (error) { console.error("Telefon saqlash:", error.message); return void (await sendMessage(chatId, TEXT.error)); }
  await sendMessage(chatId, TEXT.phoneSaved, { reply_markup: { remove_keyboard: true } });
}
