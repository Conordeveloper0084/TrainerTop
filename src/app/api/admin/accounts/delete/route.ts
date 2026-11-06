import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { cleanupR2Urls } from "@/lib/r2-cleanup";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapPurgeError(message: string): { message: string; status: number } {
  if (message.startsWith("EMPTY_LIST")) return { message: "Ro'yxat bo'sh", status: 400 };
  if (message.startsWith("NOT_FOUND")) return { message: "Ro'yxatdagi akkauntlardan biri topilmadi (allaqachon o'chirilgan bo'lishi mumkin)", status: 404 };
  if (message.startsWith("PROTECTED")) return { message: `Himoyalangan akkaunt o'chirib bo'lmaydi: ${message.replace("PROTECTED:", "")}`, status: 409 };
  if (message.startsWith("BLOCKED")) return { message: `To'siq bor — boshqa (saqlanadigan) foydalanuvchining xaridi yoki guruh a'zoligi bog'liq: ${message.replace("BLOCKED:", "")}`, status: 409 };
  return { message: "Server xatolik", status: 500 };
}

// POST /api/admin/accounts/delete — { profile_ids: string[], confirm: true } — HAQIQIY o'chirish.
// Avval /preview-delete bilan tekshiring. Himoyalangan yoki to'siqli akkaunt bo'lsa — BUTUN
// so'rov rad etiladi, hech narsa o'chmaydi (SQL darajasida atomik). Muvaffaqiyatli bo'lsa, R2'dagi
// bog'liq fayllar HAM o'chiriladi (baza allaqachon o'zgargandan keyin, alohida — best-effort).
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.profile_ids) ? body.profile_ids.filter((x: unknown) => typeof x === "string" && UUID_RE.test(x)) : [];
    if (ids.length === 0) return NextResponse.json({ message: "profile_ids kerak" }, { status: 400 });
    if (body.confirm !== true) return NextResponse.json({ message: "Tasdiqlash kerak (confirm: true)" }, { status: 400 });

    const { data, error } = await supabaseAdmin.rpc("admin_delete_accounts", { p_profile_ids: ids, p_admin: admin.id });
    if (error) { const mapped = mapPurgeError(error.message); return NextResponse.json({ message: mapped.message }, { status: mapped.status }); }

    const mediaUrls: string[] = Array.isArray(data?.media_urls) ? data.media_urls : [];
    const r2 = await cleanupR2Urls(mediaUrls);

    return NextResponse.json({ deleted: data?.deleted || ids, r2 });
  } catch (error: any) {
    console.error("Admin accounts delete:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
