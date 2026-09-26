import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getBannedUserIds } from "@/lib/bans";
import { UUID_RE } from "@/lib/db-errors";

const COMMENT_MAX = 500;

// GET /api/announcements/[id]/comments — kanal postiga yozilgan izohlar (banlangan foydalanuvchiniki chiqmaydi)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) return NextResponse.json([]);
    const { data, error } = await supabaseAdmin
      .from("announcement_comments")
      .select(`id, body, created_at, user_id, profiles:user_id (full_name, avatar_url, username)`)
      .eq("announcement_id", params.id).is("deleted_at", null)
      .order("created_at", { ascending: true }).limit(200);
    if (error) throw error;
    const banned = await getBannedUserIds();
    return NextResponse.json((data || []).filter((c: any) => !banned.includes(c.user_id)));
  } catch (error: any) {
    console.error("Announcement comments GET:", error);
    return NextResponse.json([]);
  }
}

// POST /api/announcements/[id]/comments — { body } — faqat kanal postiga (kind='all', o'chirilmagan) izoh qoldirish mumkin
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Post topilmadi" }, { status: 404 });

    const raw = (await request.json().catch(() => ({})))?.body;
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) return NextResponse.json({ message: "Izoh matni kerak" }, { status: 400 });
    if (text.length > COMMENT_MAX) return NextResponse.json({ message: `Izoh ${COMMENT_MAX} belgidan oshmasin` }, { status: 400 });

    const { data: post } = await supabaseAdmin.from("announcements").select("id, kind, deleted_at").eq("id", params.id).maybeSingle();
    if (!post || post.deleted_at) return NextResponse.json({ message: "Post topilmadi" }, { status: 404 });
    if (post.kind !== "all") return NextResponse.json({ message: "Faqat kanal postiga izoh qoldirish mumkin" }, { status: 400 });

    const { data, error } = await supabaseAdmin.from("announcement_comments")
      .insert({ announcement_id: params.id, user_id: user.id, body: text })
      .select(`id, body, created_at, user_id, profiles:user_id (full_name, avatar_url, username)`).single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Announcement comments POST:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
