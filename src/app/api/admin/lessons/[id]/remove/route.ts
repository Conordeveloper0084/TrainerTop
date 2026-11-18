import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { mapDbError, UUID_RE } from "@/lib/db-errors";

// POST /api/admin/lessons/[id]/remove
// Body: { reason: string (≥5 belgi), confirm: "delete" }
// Darslik saytdan YASHIRILADI (status = removed), xaridlar va daromad tarixi saqlanadi, TIKLASH mumkin.
// "delete" so'zi serverda ham tekshiriladi — faqat interfeysga ishonilmaydi.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Darslik topilmadi" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (body.confirm !== "delete") {
      return NextResponse.json({ message: "Tasdiqlash uchun \"delete\" so'zini yozing" }, { status: 400 });
    }
    if (reason.length < 5) return NextResponse.json({ message: "Sabab kamida 5 ta belgidan iborat bo'lishi kerak" }, { status: 400 });
    if (reason.length > 500) return NextResponse.json({ message: "Sabab juda uzun" }, { status: 400 });

    const { data, error } = await supabaseAdmin.rpc("remove_lesson", { p_lesson: params.id, p_admin: admin.id, p_reason: reason });
    if (error) {
      const mapped = mapDbError(error.message);
      if (mapped) return NextResponse.json({ message: mapped.message, code: mapped.code }, { status: mapped.status });
      throw error;
    }
    return NextResponse.json({ success: true, lesson: data });
  } catch (error: any) {
    console.error("Admin lesson remove:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
