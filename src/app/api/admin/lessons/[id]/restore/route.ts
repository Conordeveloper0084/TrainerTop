import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { mapDbError, UUID_RE } from "@/lib/db-errors";

// POST /api/admin/lessons/[id]/restore — olib tashlangan darslikni oldingi holatiga qaytarish
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Darslik topilmadi" }, { status: 404 });

    const { data, error } = await supabaseAdmin.rpc("restore_lesson", { p_lesson: params.id, p_admin: admin.id });
    if (error) {
      const mapped = mapDbError(error.message);
      if (mapped) return NextResponse.json({ message: mapped.message, code: mapped.code }, { status: mapped.status });
      throw error;
    }
    return NextResponse.json({ success: true, lesson: data });
  } catch (error: any) {
    console.error("Admin lesson restore:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
