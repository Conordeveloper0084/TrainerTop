import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

// GET /api/announcements/summary — { unread, latest } (chat ro'yxatida rasmiy kanal qatori uchun). Yengil, bitta so'rov.
// Baza yangilanmagan bo'lsa ham chat ishlashda davom etadi (kanal shunchaki ko'rinmaydi).
export async function GET(request: NextRequest) {
  const empty = { unread: 0, latest: null };
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json(empty);
    const { data, error } = await supabaseAdmin.rpc("announcement_summary", { p_user: user.id });
    if (error) { console.error("Announcement summary:", error); return NextResponse.json(empty); }
    return NextResponse.json({ unread: Number(data?.unread) || 0, latest: data?.latest || null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Announcement summary:", error);
    return NextResponse.json(empty);
  }
}
