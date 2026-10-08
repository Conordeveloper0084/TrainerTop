import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

// GET /api/chat/groups — mening guruhlarim (darslik guruhlari).
// access: owner (trener) | active | expired (oylik obuna tugagan: ro'yxatda ko'rinadi, ichiga kirib bo'lmaydi).
// Boshqa hech kimning guruhi qaytmaydi — guruhlarni qidirib topib bo'lmaydi.
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json([]);
    const { data, error } = await supabaseAdmin.rpc("chat_group_list", { p_user: user.id });
    if (error) throw error;
    return NextResponse.json(Array.isArray(data) ? data : [], { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Groups list:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
