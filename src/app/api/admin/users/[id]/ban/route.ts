import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { invalidateBanCache } from "@/lib/bans";
import { mapDbError, UUID_RE } from "@/lib/db-errors";

const DURATIONS: Record<string, number | null> = {
  "1d": 24, "7d": 24 * 7, "30d": 24 * 30, permanent: null,
};

// POST /api/admin/users/[id]/ban
// Body: { reason: string (≥5), duration: "1d"|"7d"|"30d"|"permanent", confirm?: "ban" (doimiy ban uchun majburiy) }
// Ban ikki qatlamda: (1) bazada yozuv (sabab, muddat, tarix) — API'lar darhol to'sadi; (2) Supabase Auth ban —
// qayta kirish va tokenni yangilashni to'sadi.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Foydalanuvchi topilmadi" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const duration = String(body.duration || "");
    if (!(duration in DURATIONS)) return NextResponse.json({ message: "Muddatni tanlang" }, { status: 400 });
    if (reason.length < 5) return NextResponse.json({ message: "Sabab kamida 5 ta belgidan iborat bo'lishi kerak" }, { status: 400 });
    if (reason.length > 500) return NextResponse.json({ message: "Sabab juda uzun" }, { status: 400 });
    if (duration === "permanent" && body.confirm !== "ban") {
      return NextResponse.json({ message: "Doimiy ban uchun \"ban\" so'zini yozib tasdiqlang" }, { status: 400 });
    }

    const hours = DURATIONS[duration];
    const until = hours === null ? null : new Date(Date.now() + hours * 3600 * 1000).toISOString();

    const { error } = await supabaseAdmin.rpc("ban_user", { p_user: params.id, p_admin: admin.id, p_reason: reason, p_until: until });
    if (error) {
      const mapped = mapDbError(error.message);
      if (mapped) return NextResponse.json({ message: mapped.message, code: mapped.code }, { status: mapped.status });
      throw error;
    }
    invalidateBanCache();

    // Auth darajasidagi ban: tizimga qayta kirish va sessiyani yangilashni to'xtatadi
    let authBan = true;
    try {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(params.id, {
        ban_duration: hours === null ? "876000h" : `${hours}h`,
      } as any);
      if (authErr) throw authErr;
    } catch (e) {
      authBan = false;
      console.error("Auth ban xatosi (DB ban baribir amalda):", e);
    }

    return NextResponse.json({ success: true, expires_at: until, auth_ban: authBan });
  } catch (error: any) {
    console.error("Admin ban:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id]/ban — banni olib tashlash. Body (ixtiyoriy): { note }
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Foydalanuvchi topilmadi" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

    const { error } = await supabaseAdmin.rpc("unban_user", { p_user: params.id, p_admin: admin.id, p_note: note || null });
    if (error) {
      const mapped = mapDbError(error.message);
      if (mapped) return NextResponse.json({ message: mapped.message, code: mapped.code }, { status: mapped.status });
      throw error;
    }
    invalidateBanCache();

    try {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(params.id, { ban_duration: "none" } as any);
      if (authErr) throw authErr;
    } catch (e) {
      console.error("Auth unban xatosi:", e);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Admin unban:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
