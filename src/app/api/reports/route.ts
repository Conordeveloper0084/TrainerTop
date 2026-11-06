import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { MOD_REASONS, MOD_NOTE_MAX } from "@/lib/chat-moderation";
import { UUID_RE } from "@/lib/db-errors";

const DAILY_LIMIT = 20;
const TARGET_TYPES = ["post", "comment", "user", "lesson"] as const;
type TargetType = (typeof TARGET_TYPES)[number];

// Har bir tur uchun: qaysi jadval, qaysi ustunlar snapshot uchun, kim "egasi" (o'ziga shikoyat qilib bo'lmaydi)
const TARGET_CONFIG: Record<TargetType, { table: string; ownerCol: string; snapshotCols: string }> = {
  post: { table: "posts", ownerCol: "trainer_id", snapshotCols: "id, trainer_id, caption, images, video_url, created_at" },
  comment: { table: "post_comments", ownerCol: "user_id", snapshotCols: "id, user_id, post_id, content, created_at" },
  lesson: { table: "lessons", ownerCol: "trainer_id", snapshotCols: "id, trainer_id, title, created_at" },
  user: { table: "profiles", ownerCol: "id", snapshotCols: "id, full_name, avatar_url, role" },
};

// POST /api/reports — umumiy shikoyat: post, izoh, darslik yoki foydalanuvchining o'ziga.
// Body: { target_type: post|comment|user|lesson, target_id, reason, note? }
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const targetType = body.target_type as TargetType;
    if (!TARGET_TYPES.includes(targetType)) return NextResponse.json({ message: "Noto'g'ri tur" }, { status: 400 });
    if (typeof body.target_id !== "string" || !UUID_RE.test(body.target_id)) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });

    const reason = typeof body.reason === "string" ? body.reason : "";
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    if (!MOD_REASONS.some((r) => r.code === reason)) return NextResponse.json({ message: "Shikoyat sababini tanlang" }, { status: 400 });
    if (reason === "other" && (!note || note.length < 3)) return NextResponse.json({ message: "\"Boshqa sabab\" tanlansa izoh yozing" }, { status: 400 });
    if (note && note.length > MOD_NOTE_MAX) return NextResponse.json({ message: `Izoh ${MOD_NOTE_MAX} belgidan oshmasin` }, { status: 400 });

    const cfg = TARGET_CONFIG[targetType];
    const { data: target } = await supabaseAdmin.from(cfg.table).select(cfg.snapshotCols).eq("id", body.target_id).maybeSingle();
    if (!target) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    if ((target as any)[cfg.ownerCol] === user.id) return NextResponse.json({ message: "O'zingizga shikoyat qila olmaysiz" }, { status: 400 });

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabaseAdmin.from("reports").select("id", { count: "exact", head: true }).eq("reporter_id", user.id).gte("created_at", since);
    if ((count || 0) >= DAILY_LIMIT) return NextResponse.json({ message: "Bugun juda ko'p shikoyat yubordingiz. Ertaga urinib ko'ring" }, { status: 429 });

    const { error } = await supabaseAdmin.from("reports").insert({
      target_type: targetType, target_id: body.target_id, reporter_id: user.id, reason, note, snapshot: target,
    });
    if (error) {
      if ((error as any).code === "23505") return NextResponse.json({ message: "Siz bu narsaga allaqachon shikoyat qilgansiz" }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Reports POST:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
