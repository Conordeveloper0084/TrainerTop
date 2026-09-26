import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { tgSendMessage, tgToken } from "@/lib/telegram";

const idOf = (raw: string) => (/^\d{1,15}$/.test(raw) ? Number(raw) : null);

// GET /api/admin/support/tg/[id] — Telegram bot murojaati va yozishmasi (bot jadvallari: tg_tickets, tg_messages)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    const id = idOf(params.id); if (id === null) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    const { data: t } = await supabaseAdmin.from("tg_tickets")
      .select("id, status, created_at, last_user_message_at, answered_at, assigned_admin, user:user_id (telegram_id, first_name, username, is_blocked)").eq("id", id).maybeSingle();
    if (!t) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    const { data: msgs } = await supabaseAdmin.from("tg_messages").select("id, sender, text, media_type, file_id, created_at").eq("ticket_id", id).order("created_at", { ascending: true });
    const u: any = (t as any).user || {};
    return NextResponse.json({
      id: `tg-${t.id}`, source: "telegram", name: u.first_name || "Telegram foydalanuvchi", username: u.username || null, blocked: !!u.is_blocked,
      status: t.status, in_progress: t.status === "in_progress" && !!t.assigned_admin, created_at: t.created_at, answered_at: t.answered_at,
      messages: (msgs || []).map((m: any) => ({ id: m.id, sender: m.sender, body: m.text, media_type: m.media_type, file_id: m.file_id, created_at: m.created_at })),
      can_reply: !!tgToken(),
    });
  } catch (error: any) {
    console.error("Admin tg ticket GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// POST /api/admin/support/tg/[id] — { body, force? } javobni Telegram orqali foydalanuvchiga yuboradi.
// Boshqa admin bot ichida "ishlanmoqda" qilgan bo'lsa — force bo'lmaguncha rad etiladi (ikki marta javob bermaslik uchun).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    const id = idOf(params.id); if (id === null) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    const { body: raw, force } = await request.json().catch(() => ({}));
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) return NextResponse.json({ message: "Javob matnini yozing" }, { status: 400 });
    if (text.length > 4000) return NextResponse.json({ message: "Javob juda uzun (maksimum 4000 belgi)" }, { status: 400 });
    if (!tgToken()) return NextResponse.json({ message: "Telegramga javob yuborish uchun TELEGRAM_BOT_TOKEN kerak (Vercel env)" }, { status: 503 });

    const { data: t } = await supabaseAdmin.from("tg_tickets").select("id, status, assigned_admin, user:user_id (telegram_id, is_blocked)").eq("id", id).maybeSingle();
    if (!t) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    const u: any = (t as any).user || {};
    if (u.is_blocked) return NextResponse.json({ message: "Foydalanuvchi botni bloklagan — javob yetkazib bo'lmaydi" }, { status: 409 });
    if (t.status === "in_progress" && t.assigned_admin && force !== true) {
      return NextResponse.json({ message: "Bu murojaat ustida botda boshqa admin ishlayapti", code: "CLAIMED" }, { status: 409 });
    }

    const sent = await tgSendMessage(u.telegram_id, text);
    if (sent.ok === false) return NextResponse.json({ message: `Telegramga yuborilmadi: ${sent.reason}` }, { status: sent.blocked ? 409 : 502 });

    await supabaseAdmin.from("tg_messages").insert({ ticket_id: id, sender: "admin", admin_id: null, text });
    await supabaseAdmin.from("tg_tickets").update({ status: "answered", answered_at: new Date().toISOString() }).eq("id", id);
    await logAdmin(admin.id, "support_reply_tg", "tg_ticket", String(id), {});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Admin tg reply:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
