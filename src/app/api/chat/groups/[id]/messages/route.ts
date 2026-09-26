import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getGroupAccess, getMemberMod, isCurrentlyMuted, validateOutgoing, queryMessages, isInitialLoad } from "@/lib/chat";

function denied(access: string) {
  if (access === "expired") {
    return NextResponse.json({ message: "Guruhga kirish uchun oylik to'lovni yangilang", code: "EXPIRED" }, { status: 403 });
  }
  if (access === "removed") {
    return NextResponse.json({ message: "Siz bu guruhdan chiqarilgansiz", code: "REMOVED" }, { status: 403 });
  }
  return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });
}

// GET /api/chat/groups/[id]/messages?before=<ISO>&limit=50 — faqat kirishi bor a'zo (va trener)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    const access = await getGroupAccess(params.id, user.id);
    if (access !== "owner" && access !== "active") return denied(access);

    const sp = new URL(request.url).searchParams;
    // Xabarlarni o'qish va "o'qildi" belgisini qo'yish BIR-BIRIGA bog'liq emas — parallel bajarilsa
    // (ketma-ket emas) chat ochilishi sezilarli tezlashadi (foydalanuvchi o'z belgisini kutib turmaydi).
    const [data] = await Promise.all([
      queryMessages("group_id", params.id, sp),
      isInitialLoad(sp)
        ? supabaseAdmin.from("chat_group_members").update({ last_read_at: new Date().toISOString() }).eq("group_id", params.id).eq("user_id", user.id)
        : Promise.resolve(null),
    ]);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Group messages GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// POST /api/chat/groups/[id]/messages — matn, rasm, ovoz, video
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    const access = await getGroupAccess(params.id, user.id);
    if (access !== "owner" && access !== "active") return denied(access);

    // Yozishi cheklangan (mute) a'zo o'qiy oladi, lekin yoza olmaydi
    if (access === "active") {
      const mod = await getMemberMod(params.id, user.id);
      if (mod && isCurrentlyMuted(mod.muted_until)) {
        return NextResponse.json({ message: "Guruhda yozishingiz cheklangan", code: "MUTED", muted_until: mod.muted_until, reason: mod.mod_reason, note: mod.mod_note }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const v = validateOutgoing(body, user.id);
    if (v.ok === false) return NextResponse.json({ message: v.message }, { status: v.status });

    const { data: msg, error } = await supabaseAdmin
      .from("messages")
      .insert({ group_id: params.id, sender_id: user.id, ...v.row })
      .select(`*, sender:sender_id (id, full_name, avatar_url)`)
      .single();
    if (error) throw error;

    // Yuboruvchining o'zi uchun "o'qildi" (o'z xabari o'qilmagan bo'lib qolmasin)
    await supabaseAdmin.from("chat_group_members").update({ last_read_at: new Date().toISOString() })
      .eq("group_id", params.id).eq("user_id", user.id);
    return NextResponse.json(msg);
  } catch (error: any) {
    console.error("Group messages POST:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
