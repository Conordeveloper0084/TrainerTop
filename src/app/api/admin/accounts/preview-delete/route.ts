import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/admin/accounts/preview-delete — { profile_ids: string[] } — FAQAT KO'RISH.
// Hech narsa o'chirmaydi: har bir akkaunt uchun nima o'chishi va qanday to'siqlar (boshqa,
// saqlanadigan foydalanuvchiga tegishli xarid/guruh a'zoligi) borligini qaytaradi.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.profile_ids) ? body.profile_ids.filter((x: unknown) => typeof x === "string" && UUID_RE.test(x)) : [];
    if (ids.length === 0) return NextResponse.json({ message: "profile_ids kerak" }, { status: 400 });

    const { data, error } = await supabaseAdmin.rpc("admin_preview_account_deletion", { p_profile_ids: ids });
    if (error) throw error;
    return NextResponse.json({ report: data });
  } catch (error: any) {
    console.error("Admin accounts preview-delete:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
