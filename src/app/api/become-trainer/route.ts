import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/supabase/api-auth";
import { becomeTrainer } from "@/lib/auth-server";

// POST /api/become-trainer — foydalanuvchini trener qiladi (cookie yoki Bearer token).
// Javob: { "role": "trainer" | "admin" }. Admin bo'lsa hech narsa o'zgarmaydi. Idempotent.
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const result = await becomeTrainer(user.id);
    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json({ message: "Profil topilmadi" }, { status: 404 });
    }
    console.error("become-trainer:", error);
    return NextResponse.json({ message: "Trener bo'lishda xatolik" }, { status: 500 });
  }
}
