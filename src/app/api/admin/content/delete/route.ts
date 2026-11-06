import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { cleanupR2Urls } from "@/lib/r2-cleanup";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapContentError(message: string): { message: string; status: number } {
  if (message.startsWith("BAD_TYPE")) return { message: "type 'post' yoki 'lesson' bo'lishi kerak", status: 400 };
  if (message.startsWith("NOT_FOUND")) return { message: "Topilmadi (allaqachon o'chirilgan bo'lishi mumkin)", status: 404 };
  if (message.startsWith("BLOCKED")) return { message: `To'langan xaridi bor — majburlash uchun force:true yuboring: ${message.replace("BLOCKED:", "")}`, status: 409 };
  return { message: "Server xatolik", status: 500 };
}

// POST /api/admin/content/delete — { type: "post"|"lesson", id, force?: boolean, confirm: true }
// Akkauntni qoldirib, faqat shu kontentni o'chiradi. Darslikda to'langan xarid bo'lsa, standart
// holatda RAD ETILADI — xaridor yo'qotmasligi uchun; force:true bo'lsa, xaridlar ham o'chadi.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const type = body.type;
    const id = body.id;
    const force = body.force === true;
    if (type !== "post" && type !== "lesson") return NextResponse.json({ message: "type 'post' yoki 'lesson' bo'lishi kerak" }, { status: 400 });
    if (typeof id !== "string" || !UUID_RE.test(id)) return NextResponse.json({ message: "id noto'g'ri" }, { status: 400 });
    if (body.confirm !== true) return NextResponse.json({ message: "Tasdiqlash kerak (confirm: true)" }, { status: 400 });

    const { data, error } = await supabaseAdmin.rpc("admin_delete_content", { p_type: type, p_id: id, p_admin: admin.id, p_force: force });
    if (error) { const mapped = mapContentError(error.message); return NextResponse.json({ message: mapped.message }, { status: mapped.status }); }

    const mediaUrls: string[] = Array.isArray(data?.media_urls) ? data.media_urls : [];
    const r2 = await cleanupR2Urls(mediaUrls);

    return NextResponse.json({ deleted: data?.deleted || id, r2 });
  } catch (error: any) {
    console.error("Admin content delete:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
