import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

// GET /api/payouts — o'z payoutlarim (cookie yoki Bearer token)
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("payouts")
      .select("*")
      .eq("trainer_id", user.id)
      .order("requested_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// POST /api/payouts — yangi pul yechish request (cookie yoki Bearer token)
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { amount, card_number: customCard, card_holder: customHolder } = await request.json();
    if (!amount || amount < 100000) {
      return NextResponse.json({ message: "Minimum 100,000 so'm" }, { status: 400 });
    }

    // Trener balansi va saqlangan karta
    const { data: tp } = await supabaseAdmin
      .from("trainer_profiles")
      .select("balance, card_number, card_holder")
      .eq("user_id", user.id)
      .single();

    if (!tp) return NextResponse.json({ message: "Trener emas" }, { status: 400 });
    if ((tp.balance || 0) < amount) return NextResponse.json({ message: "Yetarli mablag' yo'q" }, { status: 400 });

    // Karta tanlash: custom yoki saqlangan
    const useCard = customCard || tp.card_number;
    const useHolder = customHolder || tp.card_holder;

    if (!useCard) return NextResponse.json({ message: "Karta raqami kerak" }, { status: 400 });
    if (customCard && customCard.length !== 16) {
      return NextResponse.json({ message: "Karta 16 raqam bo'lishi kerak" }, { status: 400 });
    }

    // Pending payout bormi tekshirish
    const { count } = await supabaseAdmin
      .from("payouts")
      .select("*", { count: "exact", head: true })
      .eq("trainer_id", user.id)
      .eq("status", "pending");

    if ((count || 0) > 0) {
      return NextResponse.json({ message: "Sizda hali ko'rib chiqilmagan request bor" }, { status: 400 });
    }

    // Payout yaratish
    const { data, error } = await supabaseAdmin
      .from("payouts")
      .insert({
        trainer_id: user.id,
        amount,
        card_number: useCard,
        card_holder: useHolder,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    // Balansdan yechish
    await supabaseAdmin
      .from("trainer_profiles")
      .update({ balance: (tp.balance || 0) - amount })
      .eq("user_id", user.id);

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
