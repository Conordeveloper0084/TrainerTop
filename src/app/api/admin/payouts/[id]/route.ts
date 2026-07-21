import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function requireAdmin() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return user;
}

// PUT /api/admin/payouts/[id] — status o'zgartirish
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const { status, note } = await request.json();
    if (!["completed", "rejected"].includes(status)) {
      return NextResponse.json({ message: "Noto'g'ri status" }, { status: 400 });
    }

    // Payout'ni olish
    const { data: payout } = await supabaseAdmin
      .from("payouts")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!payout) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    if (payout.status !== "pending") {
      return NextResponse.json({ message: "Allaqachon ko'rib chiqilgan" }, { status: 400 });
    }

    // Status yangilash
    const { error } = await supabaseAdmin
      .from("payouts")
      .update({
        status,
        admin_note: note || null,
        completed_at: new Date().toISOString(),
        completed_by: admin.id,
      })
      .eq("id", params.id);

    if (error) throw error;

    // Agar rejected bo'lsa — balansni qaytarish
    if (status === "rejected") {
      const { data: tp } = await supabaseAdmin
        .from("trainer_profiles")
        .select("balance")
        .eq("user_id", payout.trainer_id)
        .single();

      if (tp) {
        await supabaseAdmin
          .from("trainer_profiles")
          .update({ balance: (tp.balance || 0) + payout.amount })
          .eq("user_id", payout.trainer_id);
      }
    }

    // Notification trenerga
    await supabaseAdmin.from("notifications").insert({
      user_id: payout.trainer_id,
      type: "payout",
      title: status === "completed" ? "Pul o'tkazildi" : "Pul yechish rad etildi",
      body: status === "completed"
        ? `${payout.amount.toLocaleString("uz-UZ")} so'm kartangizga o'tkazildi`
        : note || "Pul yechish rad etildi",
      data: { payout_id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
