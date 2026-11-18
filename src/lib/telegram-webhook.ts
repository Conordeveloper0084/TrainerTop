import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveBan } from "@/lib/bans";
import { runInBackground } from "@/lib/push";
import { answerCallbackQuery, editMessageText, sendMessage } from "@/lib/telegram-bot";
import { findLinkedUser, identifyTelegramUser, syncTelegramAvatar, type TgUser } from "@/lib/telegram-auth";
import { cleanupR2Urls } from "@/lib/r2-cleanup";
import { BAN_MESSAGE, fullNameFrom, isValidLoginId, loginConfirmText, maskPhone, normalizePhone, PLATFORMS, type LoginPlatform } from "@/lib/telegram-login";

// Login botining webhook mantig'i. Muhim qoidalar:
//  • /start HECH QACHON sessiya ham, akkaunt ham bermaydi — faqat TASDIQ tugmasi (birov boshqa odamga havola yuborib uning nomidan kirib olmasligi uchun).
//  • TELEFON RAQAM MAJBURIY: akkauntda tasdiqlangan raqam bo'lmasa, bot avval raqam so'raydi ("📱 Raqamni ulashish"); raqamsiz tasdiq tugmasi chiqmaydi.
//    Raqam Telegram tomonidan tasdiqlangan (contact.user_id == from.id shart — boshqaning kontakti rad etiladi).

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
  askPhoneLogin: "TrainerTop'ga kirish uchun telefon raqamingizni ulashing.\nRaqam akkauntingizga tasdiqlangan raqam sifatida yoziladi va boshqa foydalanuvchilarga ko'rinmaydi.",
  askPhoneLink: "Telegram'ni akkauntingizga ulash uchun telefon raqamingizni ulashing.\nRaqam boshqa foydalanuvchilarga ko'rinmaydi.",
  contactBtn: "📱 Raqamni ulashish",
  needPhoneToast: "Avval raqamingizni ulashing",
  phoneAccepted: (masked: string | null) => `✅ Raqam qabul qilindi${masked ? `: ${masked}` : ""}`,
  foreignContact: "Faqat o'z raqamingizni ulashing (pastdagi «📱 Raqamni ulashish» tugmasi orqali).",
  noOpenRequest: "Avval saytda yoki ilovada «Telegram orqali kirish» tugmasini bosing, so'ng shu yerda raqamingizni ulashing.",
  badPhone: "Raqamni o'qib bo'lmadi. Pastdagi tugma orqali qayta ulashing.",
  phoneTaken: "❗ Bu raqam boshqa Telegram akkauntga ulangan. Yordam xizmatiga yozing: @TrainerTop_Support_Bot",
  error: "Xatolik yuz berdi. Bir ozdan keyin sayt yoki ilovada qayta urinib ko'ring.",
  linkConfirmBtn: "✅ Ulash",
  linked: "✅ Telegram akkauntingizga ulandi. Endi «Telegram orqali kirish» shu akkauntga kiradi. Ilovaga (saytga) qayting.",
  linkedReplaced: "✅ Telegram akkauntingizga ulandi. Avval Telegram orqali ochilgan bo'sh akkaunt o'chirildi. Ilovaga (saytga) qayting.",
  linkTaken: "❗ Bu Telegram boshqa akkauntga ulangan. Yordam xizmatiga yozing: @TrainerTop_Support_Bot",
  linkPhoneTaken: "❗ Bu telefon raqam boshqa akkauntga tegishli. Yordam xizmatiga yozing: @TrainerTop_Support_Bot",
  linkUserHasTelegram: "❗ Akkauntingizga boshqa Telegram allaqachon ulangan. Avval uni akkauntingiz sozlamalaridan uzing.",
  linkRace: "Hozir boshqa amal bajarilmoqda. Ilovada ulashni qayta boshlang.",
};
// Ulashni so'ragan akkaunt nomi bilan (kim ulanayotgani ko'rinsin) — boshqa odamning akkauntiga adashib ulanib qolmaslik uchun ogohlantirish bilan
export const linkText = (name: string, masked?: string | null) => `Telegram'ni TrainerTop akkauntingizga (${name}) ulaysizmi?${masked ? `\nRaqam: ${masked}` : ""}\nAgar bu akkaunt sizniki bo'lmasa, bosmang.`;

type LoginRow = { id: string; status: string; expires_at: string; platform: LoginPlatform; mode?: string; link_user_id?: string | null; phone?: string | null; phone_tg_user_id?: number | null };
async function getLogin(id: string): Promise<LoginRow | null> {
  const { data } = await supabaseAdmin.from("telegram_login_requests").select("id, status, expires_at, platform, mode, link_user_id, phone, phone_tg_user_id").eq("id", id).maybeSingle();
  return (data as LoginRow) ?? null;
}
const isOpen = (r: LoginRow | null): r is LoginRow => !!r && r.status === "pending" && Date.parse(r.expires_at) > Date.now() && PLATFORMS.includes(r.platform);
const sharedPhoneOf = (r: LoginRow, tgId: number): string | null => (r.phone_tg_user_id === tgId && r.phone ? r.phone : null);   // faqat TUGMANI BOSGAN odam o'zi ulashgan raqam
const firstRow = (d: any) => (Array.isArray(d) ? d[0] : d) ?? null;

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  const m = update.message;
  if (!m || m.chat.type !== "private" || !m.from || m.from.is_bot) return;      // faqat shaxsiy suhbat, botlarsiz
  if (m.contact) return handleContact(m.chat.id, m.from, m.contact);
  const text = (m.text || "").trim();
  if (/^\/start(@\w+)?(\s|$)/.test(text)) return handleStart(m.chat.id, m.from, text.replace(/^\/start(@\w+)?\s*/, ""));
  await sendMessage(m.chat.id, TEXT.greeting);
}

// Kim sifatida / qaysi raqam bilan kirilishini oldindan aniqlash (faqat O'QISH; haqiqiy qaror tasdiqda bazada qabul qilinadi)
async function describeIdentity(row: LoginRow, from: TgUser, sharedPhone: string | null): Promise<{ needPhone: boolean; name: string; masked: string | null }> {
  if (row.mode === "link") {
    const { data: prof } = await supabaseAdmin.from("profiles").select("full_name, phone").eq("id", row.link_user_id).maybeSingle();
    const phone = prof?.phone ?? null;
    return { needPhone: !phone && !sharedPhone, name: prof?.full_name || "TrainerTop", masked: maskPhone(phone ?? sharedPhone) };
  }
  const linked = await findLinkedUser(from.id);
  if (linked) return { needPhone: !linked.phone && !sharedPhone, name: linked.fullName || fullNameFrom(from), masked: maskPhone(linked.phone ?? sharedPhone) };
  if (!sharedPhone) return { needPhone: true, name: fullNameFrom(from), masked: null };
  // Telegram bog'lanmagan, lekin shu raqamli akkaunt bor bo'lsa — aynan o'sha akkauntga kiriladi (ismi ko'rsatiladi)
  const { data: owner } = await supabaseAdmin.from("profiles").select("full_name").eq("phone", sharedPhone).maybeSingle();
  return { needPhone: false, name: owner?.full_name || fullNameFrom(from), masked: maskPhone(sharedPhone) };
}

const contactKeyboard = { keyboard: [[{ text: TEXT.contactBtn, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };
const askPhone = (chatId: number, mode: string | undefined) => sendMessage(chatId, mode === "link" ? TEXT.askPhoneLink : TEXT.askPhoneLogin, { reply_markup: contactKeyboard });

async function sendConfirm(chatId: number, row: LoginRow, id: { name: string; masked: string | null }) {
  const isLink = row.mode === "link";
  const text = isLink ? linkText(id.name, id.masked) : loginConfirmText(id.name, id.masked ?? "", row.platform);
  await sendMessage(chatId, text, { reply_markup: { inline_keyboard: [[{ text: isLink ? TEXT.linkConfirmBtn : TEXT.confirmBtn, callback_data: `ok:${row.id}` }, { text: TEXT.cancelBtn, callback_data: `no:${row.id}` }]] } });
}

async function handleStart(chatId: number, from: TgUser, payload: string) {
  const loginId = payload.startsWith("login_") ? payload.slice(6) : "";
  if (!isValidLoginId(loginId)) return void (await sendMessage(chatId, TEXT.greeting));
  const row = await getLogin(loginId);
  if (!isOpen(row)) return void (await sendMessage(chatId, TEXT.stale));
  // Kim /start bosganini eslab qolamiz (keyingi kontakt xabari shu so'rovga tegishli bo'lishi uchun). Sessiya/akkaunt YO'Q.
  await supabaseAdmin.rpc("tg_login_start_seen", { p_login_id: row.id, p_tg_user_id: from.id });
  const id = await describeIdentity(row, from, null);
  if (id.needPhone) return void (await askPhone(chatId, row.mode));        // raqamsiz davom etib bo'lmaydi
  await sendConfirm(chatId, row, id);
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

  const loginRow = await getLogin(loginId);
  if (!isOpen(loginRow)) return void (await finish("Havola eskirgan", TEXT.stale));
  if (loginRow.mode === "link") return handleLinkConfirm(q, loginId, chat.id, finish);     // ulash: akkaunt yaratilmaydi, sessiya berilmaydi
  try {
    const sharedPhone = sharedPhoneOf(loginRow, q.from.id);
    const linked = await findLinkedUser(q.from.id);
    if (linked && await getActiveBan(linked.userId)) {
      await supabaseAdmin.rpc("tg_login_cancel", { p_login_id: loginId });
      return void (await finish("Akkaunt bloklangan", BAN_MESSAGE));
    }
    // Raqamsiz tasdiqlab bo'lmaydi: akkauntda tasdiqlangan raqam ham, ulashilgan raqam ham yo'q → qayta so'raladi
    if (!linked?.phone && !sharedPhone) { await finish(TEXT.needPhoneToast); return void (await askPhone(chat.id, "login")); }

    const idn = await identifyTelegramUser(q.from, sharedPhone);
    if (idn.outcome === "phone_taken_other_telegram") {
      await supabaseAdmin.rpc("tg_login_cancel", { p_login_id: loginId });
      return void (await finish("Kirib bo'lmadi", TEXT.phoneTaken));
    }
    if (idn.outcome === "phone_required" || !idn.userId) { await finish(TEXT.needPhoneToast); return void (await askPhone(chat.id, "login")); }
    if (await getActiveBan(idn.userId)) {                      // raqam bo'yicha topilgan akkaunt bloklangan bo'lishi mumkin
      await supabaseAdmin.rpc("tg_login_cancel", { p_login_id: loginId });
      return void (await finish("Akkaunt bloklangan", BAN_MESSAGE));
    }
    const { data } = await supabaseAdmin.rpc("tg_login_confirm", { p_login_id: loginId, p_telegram_user_id: q.from.id, p_user_id: idn.userId, p_is_new: idn.isNew });
    if (!(Array.isArray(data) ? data.length : data)) return void (await finish("Havola eskirgan", TEXT.stale));   // poyga/eskirdi — hech narsa tasdiqlanmadi
    await finish("Tasdiqlandi", TEXT.done);
    if (idn.isNew) runInBackground(syncTelegramAvatar(idn.userId, q.from.id));
  } catch (e: any) {
    console.error("Telegram tasdiqlash:", e?.message || e);
    await finish("Xatolik", TEXT.error);
  }
}

// "✅ Ulash" bosildi. Hammasi bazadagi tg_link_apply funksiyasida (bitta tranzaksiya): bo'sh dublikat o'chiriladi (raqami ham bo'shaydi),
// bo'sh bo'lmasa yoki raqam boshqa akkauntniki bo'lsa — hech narsa o'zgarmaydi; akkauntda raqam bo'lmasa ulashilgan raqam yoziladi.
async function handleLinkConfirm(q: NonNullable<TgUpdate["callback_query"]>, loginId: string, chatId: number, finish: (toast: string, text?: string, extra?: Record<string, unknown>) => Promise<void>) {
  try {
    const { data, error } = await supabaseAdmin.rpc("tg_link_apply", { p_login_id: loginId, p_telegram_user_id: q.from.id, p_username: q.from.username ?? null, p_first_name: q.from.first_name ?? null, p_last_name: q.from.last_name ?? null });
    if (error) {
      if ((error.message || "").includes("TG_LINK_RACE")) return void (await finish("Qayta urinib ko'ring", TEXT.linkRace));
      throw error;
    }
    const r: any = firstRow(data);
    switch (r?.outcome) {
      case "linked": return void (await finish("Ulandi", TEXT.linked));
      case "linked_replaced":
        if (r.deleted_avatar) runInBackground(cleanupR2Urls([r.deleted_avatar]));   // o'chirilgan dublikatning R2'dagi rasmi
        return void (await finish("Ulandi", TEXT.linkedReplaced));
      case "phone_required": await finish(TEXT.needPhoneToast); return void (await askPhone(chatId, "link"));
      case "conflict_taken": return void (await finish("Ulab bo'lmadi", TEXT.linkTaken));
      case "conflict_phone_taken": return void (await finish("Ulab bo'lmadi", TEXT.linkPhoneTaken));
      case "conflict_user_has_telegram": return void (await finish("Ulab bo'lmadi", TEXT.linkUserHasTelegram));
      default: return void (await finish("Havola eskirgan", TEXT.stale));
    }
  } catch (e: any) {
    console.error("Telegram ulash:", e?.message || e);
    await finish("Xatolik", TEXT.error);
  }
}

// Kontakt keldi ("📱 Raqamni ulashish"): faqat o'zining raqami (contact.user_id == from.id), E.164 ga keltiriladi,
// shu odam so'nggi /start bosgan ochiq so'rovga yoziladi, keyin tasdiq tugmasi chiqadi.
async function handleContact(chatId: number, from: TgUser, contact: { phone_number: string; user_id?: number }) {
  if (!contact.user_id || contact.user_id !== from.id) return void (await sendMessage(chatId, TEXT.foreignContact));   // klaviatura turaveradi
  const phone = normalizePhone(contact.phone_number);
  if (!phone) return void (await sendMessage(chatId, TEXT.badPhone));
  const { data: open, error: oErr } = await supabaseAdmin.rpc("tg_login_find_open", { p_tg_user_id: from.id });
  const found = firstRow(open);
  if (oErr) { console.error("Telefon: ochiq so'rov:", oErr.message); return void (await sendMessage(chatId, TEXT.error, { reply_markup: { remove_keyboard: true } })); }
  if (!found?.id) return void (await sendMessage(chatId, TEXT.noOpenRequest, { reply_markup: { remove_keyboard: true } }));
  const { data: saved, error: sErr } = await supabaseAdmin.rpc("tg_login_set_phone", { p_login_id: found.id, p_tg_user_id: from.id, p_phone: phone });
  if (sErr) { console.error("Telefon saqlash:", sErr.message); return void (await sendMessage(chatId, TEXT.error, { reply_markup: { remove_keyboard: true } })); }
  if (!saved) return void (await sendMessage(chatId, TEXT.stale, { reply_markup: { remove_keyboard: true } }));
  await sendMessage(chatId, TEXT.phoneAccepted(maskPhone(phone)), { reply_markup: { remove_keyboard: true } });        // reply klaviatura olib tashlanadi
  const row = await getLogin(found.id);
  if (!isOpen(row)) return void (await sendMessage(chatId, TEXT.stale));
  await sendConfirm(chatId, row, await describeIdentity(row, from, phone));
}
