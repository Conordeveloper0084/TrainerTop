import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { PLATFORM_COMMENT_MAX } from "@/lib/platform-reviews";

const ERRORS: Record<string, [number, string]> = {
  USER_NOT_FOUND: [404, "Profil topilmadi"], BANNED: [403, "Baho berish mumkin emas"],
  BAD_RATING: [400, "Bahoni 1 dan 5 gacha tanlang"], BAD_COMMENT: [400, `Izoh ${PLATFORM_COMMENT_MAX} belgidan oshmasin`],
};

// GET /api/platform-reviews/mine — mening bahom ({ rating, comment } yoki null)
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    const { data } = await supabaseAdmin.from("platform_reviews").select("rating, comment, updated_at").eq("user_id", user.id).maybeSingle();
    return NextResponse.json(data || null, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("My review GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// PUT /api/platform-reviews/mine — { rating: 1..5, comment? }: baho berish yoki yangilash (bir foydalanuvchi — bitta baho)
export async function PUT(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const rating = body?.rating;
    if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ message: ERRORS.BAD_RATING[1] }, { status: 400 });
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    if (comment.length > PLATFORM_COMMENT_MAX) return NextResponse.json({ message: ERRORS.BAD_COMMENT[1] }, { status: 400 });

    const { data, error } = await supabaseAdmin.rpc("platform_review_submit", { p_user: user.id, p_rating: rating, p_comment: comment || null });
    if (error) {
      const key = Object.keys(ERRORS).find((k) => String(error.message || "").includes(k));
      if (key) return NextResponse.json({ message: ERRORS[key][1] }, { status: ERRORS[key][0] });
      throw error;
    }
    return NextResponse.json({ success: true, created: !!data?.created });
  } catch (error: any) {
    console.error("My review PUT:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// DELETE /api/platform-reviews/mine — bahoni o'chirish
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    const { error } = await supabaseAdmin.from("platform_reviews").delete().eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("My review DELETE:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
