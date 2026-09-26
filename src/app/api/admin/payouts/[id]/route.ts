import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { mapDbError, UUID_RE } from "@/lib/db-errors";

// PUT /api/admin/payouts/[id] — so'rovni hal qilish
// Body: { status: "completed" | "rejected", note?: string }
//  - completed: pul kartaga o'tkazilgan (balans allaqachon kamaygan, o'zgarmaydi)
//  - rejected : sabab (note) MAJBURIY; summa trener balansiga qaytadi va sabab trenerga ko'rinadi
// Hammasi bitta DB tranzaksiyasida: ikki marta bosilsa ham pul ikki marta qaytmaydi.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const { status } = body;
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (status !== "completed" && status !== "rejected") {
      return NextResponse.json({ message: "Noto'g'ri status" }, { status: 400 });
    }
    if (status === "rejected" && note.length < 3) {
      return NextResponse.json({ message: "Rad etish sababini yozing" }, { status: 400 });
    }
    if (note.length > 500) return NextResponse.json({ message: "Izoh juda uzun" }, { status: 400 });

    const { data, error } = await supabaseAdmin.rpc("resolve_payout", {
      p_payout: params.id,
      p_admin: admin.id,
      p_action: status === "completed" ? "complete" : "reject",
      p_note: note || null,
    });

    if (error) {
      const mapped = mapDbError(error.message);
      if (mapped) return NextResponse.json({ message: mapped.message, code: mapped.code }, { status: mapped.status });
      throw error;
    }
    return NextResponse.json({ success: true, payout: data });
  } catch (error: any) {
    console.error("Admin payout resolve:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
