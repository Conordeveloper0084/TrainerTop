import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { UUID_RE } from "@/lib/db-errors";

const MAX_IDS = 50;

// POST /api/announcements/view — { ids: string[] } — joriy foydalanuvchi uchun "ko'rilgan" deb belgilaydi
// (har post faqat bir marta hisoblanadi). Yangilangan ko'rishlar sonini {id: son} shaklida qaytaradi.
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: any) => typeof x === "string" && UUID_RE.test(x)).slice(0, MAX_IDS) : [];
    if (ids.length === 0) return NextResponse.json({});

    const { data, error } = await supabaseAdmin.rpc("announcement_mark_viewed", { p_user: user.id, p_ids: ids });
    if (error) throw error;
    return NextResponse.json(data || {});
  } catch (error: any) {
    console.error("Announcement view POST:", error);
    return NextResponse.json({});
  }
}
