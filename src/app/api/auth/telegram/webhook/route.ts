import { NextRequest, NextResponse } from "next/server";
import { getTelegramConfig, safeEqual } from "@/lib/telegram-login";
import { handleUpdate } from "@/lib/telegram-webhook";

// POST /api/auth/telegram/webhook — Telegram login botining webhook'i.
// Har so'rovda X-Telegram-Bot-Api-Secret-Token tekshiriladi (setWebhook'dagi secret_token bilan bir xil). Noto'g'ri/yo'q — 401 va
// HECH NARSA bajarilmaydi. Tekshiruvdan keyin har doim 200 (Telegram xato javobda qayta-qayta yuboraveradi).
export async function POST(request: NextRequest) {
  const cfg = getTelegramConfig();
  if (!cfg.token || !cfg.webhookSecret) return NextResponse.json({ ok: false }, { status: 503 });
  if (!safeEqual(request.headers.get("x-telegram-bot-api-secret-token"), cfg.webhookSecret)) return NextResponse.json({ ok: false }, { status: 401 });
  const update = await request.json().catch(() => null);
  if (update && typeof update === "object") {
    try { await handleUpdate(update); } catch (e: any) { console.error("Telegram webhook:", e?.message || e); }
  }
  return NextResponse.json({ ok: true });
}
