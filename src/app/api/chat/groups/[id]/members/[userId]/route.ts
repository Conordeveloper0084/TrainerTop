import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getGroupAccess } from "@/lib/chat";
import { moderateMember } from "@/lib/moderation";
import { UUID_RE } from "@/lib/db-errors";

// PATCH /api/chat/groups/[id]/members/[userId] — guruh admini (trener) a'zoga chora ko'radi.
// Body: { action: "mute" | "unmute" | "remove" | "restore", reason?, note?, duration? }
//   mute  — yozishni cheklash: duration = 1d | 7d | 30d | forever
//   remove — guruhdan chiqarish (darslikka kirish SAQLANADI)
// mute va remove uchun `reason` (18+, haqorat, spam, mavzudan tashqari, boshqa) MAJBURIY; "boshqa" bo'lsa `note` ham.
// Admin qo'ygan chorani trener o'zgartira olmaydi (DB qoidasi).
export async function PATCH(request: NextRequest, { params }: { params: { id: string; userId: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    if ((await getGroupAccess(params.id, user.id)) !== "owner") {
      return NextResponse.json({ message: "Faqat guruh admini a'zolarni boshqara oladi" }, { status: 403 });
    }
    if (!UUID_RE.test(params.userId)) return NextResponse.json({ message: "A'zo topilmadi" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const r = await moderateMember({ groupId: params.id, target: params.userId, actorId: user.id, actorIsAdmin: false, body });
    if (r.ok === false) return NextResponse.json({ message: r.message }, { status: r.status });
    return NextResponse.json({ success: true, ...r.data });
  } catch (error: any) {
    console.error("Group member moderation:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
