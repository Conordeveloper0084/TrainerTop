import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { UUID_RE } from "@/lib/db-errors";

// DELETE /api/blocks/[userId] — blokdan chiqarish
export async function DELETE(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    if (!UUID_RE.test(params.userId)) return NextResponse.json({ success: true });   // hech qachon bloklanmagan — muvaffaqiyat (idempotent)

    const { error } = await supabaseAdmin.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", params.userId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Blocks DELETE:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
