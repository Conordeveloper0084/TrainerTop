import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { UUID_RE } from "@/lib/db-errors";
import { BOOST_TEXT_MAX } from "@/lib/announcements";

const ERRORS: Record<string, [number, string]> = {
  FORBIDDEN: [403, "Faqat admin boost qila oladi"],
  LESSON_NOT_FOUND: [404, "Darslik topilmadi"],
  NOT_PUBLISHED: [400, "Faqat e'lon qilingan darslikni boost qilish mumkin"],
  TRAINER_BANNED: [400, "Trener banlangan — darslikni boost qilib bo'lmaydi"],
  BAD_TEXT: [400, `Matn ${BOOST_TEXT_MAX} belgidan oshmasin`],
  BOOST_LIMIT: [429, "7 kunda ko'pi bilan 2 ta boost qilish mumkin (reklama charchamasligi uchun). Keyinroq urinib ko'ring"],
  RECENTLY_BOOSTED: [409, "Bu darslik oxirgi 30 kunda allaqachon boost qilingan"],
};

// GET /api/admin/lessons/[id]/boost — boost holati: 7 kunda nechta ishlatilgan, shu darslik oxirgi marta qachon boost qilingan
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Darslik topilmadi" }, { status: 404 });
    const { data, error } = await supabaseAdmin.rpc("lesson_boost_status", { p_lesson: params.id });
    if (error) throw error;
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Boost status:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// POST /api/admin/lessons/[id]/boost — { text?, client_token? }: darslikni rasmiy kanalda hammaga ko'rsatish; trenerga qo'ng'iroqchada xabar boradi
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Darslik topilmadi" }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length > BOOST_TEXT_MAX) return NextResponse.json({ message: ERRORS.BAD_TEXT[1] }, { status: 400 });
    const token = typeof body.client_token === "string" && UUID_RE.test(body.client_token) ? body.client_token : null;

    const { data, error } = await supabaseAdmin.rpc("lesson_boost", { p_admin: admin.id, p_lesson: params.id, p_text: text || null, p_token: token });
    if (error) {
      const key = Object.keys(ERRORS).find((k) => String(error.message || "").includes(k));
      if (key) return NextResponse.json({ message: ERRORS[key][1] }, { status: ERRORS[key][0] });
      throw error;
    }
    if (!data.duplicate) await logAdmin(admin.id, "lesson_boost", "lesson", params.id, { announcement_id: data.id });
    return NextResponse.json({ success: true, id: data.id, recipients: Number(data.recipients) || 0, duplicate: !!data.duplicate });
  } catch (error: any) {
    console.error("Boost POST:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
