import { getTelegramConfig } from "@/lib/telegram-login";

// Telegram Bot API (login boti). Token HECH QACHON log'ga/xatoga yozilmaydi.
export class TelegramApiError extends Error {
  constructor(public method: string, public status: number, description: string) { super(`Telegram ${method}: ${status} ${description}`); }
}

async function call<T = any>(method: string, payload: Record<string, unknown>): Promise<T> {
  const { token } = getTelegramConfig();
  if (!token) throw new TelegramApiError(method, 0, "token sozlanmagan");
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new TelegramApiError(method, res.status, String(data.description || "xato"));
    return data.result as T;
  } catch (e: any) {
    if (e instanceof TelegramApiError) throw e;
    throw new TelegramApiError(method, 0, e?.name === "AbortError" ? "vaqt tugadi" : "tarmoq xatosi");
  } finally { clearTimeout(timer); }
}

export const sendMessage = (chatId: number, text: string, extra: Record<string, unknown> = {}) => call("sendMessage", { chat_id: chatId, text, ...extra });
export const editMessageText = (chatId: number, messageId: number, text: string, extra: Record<string, unknown> = {}) => call("editMessageText", { chat_id: chatId, message_id: messageId, text, ...extra });
export const answerCallbackQuery = (id: string, text?: string) => call("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
// Telegram profil rasmi (eng kattasi, 2 MB gacha). Yo'q/katta/xato bo'lsa null.
export async function downloadProfilePhoto(telegramUserId: number): Promise<{ buffer: Buffer; ext: "jpg" | "png" | "webp"; mime: string } | null> {
  const { token } = getTelegramConfig();
  const photos = await call<{ total_count: number; photos: { file_id: string; file_size?: number }[][] }>("getUserProfilePhotos", { user_id: telegramUserId, limit: 1 });
  const sizes = photos?.photos?.[0]; if (!sizes?.length) return null;
  const pick = [...sizes].reverse().find((s) => !s.file_size || s.file_size <= PHOTO_MAX_BYTES); if (!pick) return null;
  const file = await call<{ file_path?: string; file_size?: number }>("getFile", { file_id: pick.file_id });
  if (!file?.file_path || (file.file_size && file.file_size > PHOTO_MAX_BYTES)) return null;
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer()); if (buffer.length === 0 || buffer.length > PHOTO_MAX_BYTES) return null;
  const ext = /\.png$/i.test(file.file_path) ? "png" : /\.webp$/i.test(file.file_path) ? "webp" : "jpg";
  return { buffer, ext, mime: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg" };
}
