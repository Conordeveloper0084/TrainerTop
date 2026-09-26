// Telegram Bot API (support bot javoblari va fayllar). TELEGRAM_BOT_TOKEN bo'lmasa — faqat o'qish rejimi.
const API = "https://api.telegram.org";
export const tgToken = () => process.env.TELEGRAM_BOT_TOKEN || "";

export async function tgSendMessage(chatId: number | string, text: string): Promise<{ ok: true } | { ok: false; reason: string; blocked?: boolean }> {
  const token = tgToken();
  if (!token) return { ok: false, reason: "TELEGRAM_BOT_TOKEN sozlanmagan" };
  try {
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (res.ok) return { ok: true };
    const d: any = await res.json().catch(() => ({}));
    if (res.status === 403) return { ok: false, blocked: true, reason: "Foydalanuvchi botni bloklagan" };
    return { ok: false, reason: d?.description || `Telegram ${res.status}` };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "tarmoq xatosi" };
  }
}

// Telegram file_id → fayl oqimi (token brauzerga CHIQMAYDI, server o'zi olib beradi)
export async function tgFetchFile(fileId: string): Promise<{ body: ReadableStream | null; contentType: string } | null> {
  const token = tgToken();
  if (!token) return null;
  try {
    const info = await fetch(`${API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const j: any = await info.json().catch(() => ({}));
    const path = j?.result?.file_path;
    if (!info.ok || !path) return null;
    const file = await fetch(`${API}/file/bot${token}/${path}`);
    if (!file.ok) return null;
    return { body: file.body, contentType: file.headers.get("content-type") || "application/octet-stream" };
  } catch { return null; }
}
