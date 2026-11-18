import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { UUID_RE } from "@/lib/db-errors";

// GET /api/notifications — HAM website (cookie) HAM app (Bearer) uchun.
// O'qilmagan rasmiy kanal e'lonlari bo'lsa ro'yxat boshiga bitta "yopishqoq" (sticky) qator qo'shiladi:
// u kanal ochilgandagina yo'qoladi (qo'ng'iroqchani ochish uni o'chirmaydi).
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json([]);

    const [{ data }, summary] = await Promise.all([
      supabaseAdmin.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
      Promise.resolve(supabaseAdmin.rpc("announcement_summary", { p_user: user.id })).catch(() => ({ data: null, error: true })),
    ]);
    // Boost xabari (trenerga): bosilsa darslik sahifasiga olib boradi
    const list: any[] = (data || []).map((x: any) => (x.type === "boost" && typeof x.data?.lesson_id === "string" && UUID_RE.test(x.data.lesson_id) ? { ...x, href: `/lessons/${x.data.lesson_id}` } : x));
    const unread = Number((summary as any)?.data?.unread) || 0;
    const latest = (summary as any)?.data?.latest;
    if (unread > 0 && latest) {
      list.unshift({
        id: "announcements", type: "announcement", sticky: true, is_read: false, href: "/chat?official=1", created_at: latest.created_at,
        title: unread === 1 ? "TrainerTop: yangi e'lon" : `TrainerTop: ${unread} ta yangi e'lon`, body: latest.title,
      });
    }
    return NextResponse.json(list, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Notifications GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// PUT /api/notifications — barchasini o'qildi deb belgilash (kanal e'lonlari bundan mustasno: ular kanalni ochganda o'qiladi)
export async function PUT(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    await supabaseAdmin.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Notifications PUT:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
