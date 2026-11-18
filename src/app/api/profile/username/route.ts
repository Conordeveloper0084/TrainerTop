import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

const ERRORS: Record<string, [number, string]> = {
  BAD_FORMAT: [400, "Username 3-20 belgi, faqat lotin harf/raqam/pastki chiziq (_) bo'lishi kerak"],
  RESERVED: [400, "Bu username band (tizim tomonidan ishlatiladi)"],
  TAKEN: [409, "Bu username allaqachon band"],
};

// PUT /api/profile/username — { username: string | null } (null = o'chirish, ixtiyoriy bo'lgani uchun)
export async function PUT(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const raw = body?.username;
    if (raw !== null && typeof raw !== "string") return NextResponse.json({ message: ERRORS.BAD_FORMAT[1] }, { status: 400 });
    const trimmed = raw === null ? null : raw.trim();
    const username = trimmed === "" ? null : trimmed;
    if (username !== null && !/^[A-Za-z0-9_]{3,20}$/.test(username)) return NextResponse.json({ message: ERRORS.BAD_FORMAT[1] }, { status: 400 });

    const { data, error } = await supabaseAdmin.rpc("set_username", { p_user: user.id, p_username: username });
    if (error) {
      const key = Object.keys(ERRORS).find((k) => String(error.message || "").includes(k));
      if (key) return NextResponse.json({ message: ERRORS[key][1] }, { status: ERRORS[key][0] });
      throw error;
    }
    return NextResponse.json({ success: true, username: data?.username ?? null });
  } catch (error: any) {
    console.error("Username PUT:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
