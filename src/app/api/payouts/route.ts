import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { digitsOnly, luhnValid, holderValid, normalizeHolder } from "@/lib/card";
import { mapDbError } from "@/lib/db-errors";
import { strictNumber } from "@/lib/num";

// GET /api/payouts — o'z pul yechish so'rovlarim (cookie yoki Bearer token)
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("payouts")
      .select("*")
      .eq("trainer_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Payouts GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// POST /api/payouts — yangi pul yechish so'rovi (cookie yoki Bearer token)
// Body: { amount, card_number, card_holder } — karta HAR SAFAR kiritiladi (saqlanmaydi).
// Summa balansdan DARHOL ushlab qolinadi; admin rad etsa qaytariladi (hammasi bitta DB tranzaksiyasida).
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const amount = strictNumber(body.amount);
    const card = digitsOnly(String(body.card_number ?? ""));
    const holder = normalizeHolder(String(body.card_holder ?? ""));

    if (amount === null || !Number.isInteger(amount) || amount <= 0 || amount > 2_000_000_000) {
      return NextResponse.json({ message: "Summa noto'g'ri" }, { status: 400 });
    }
    if (!luhnValid(card)) {
      return NextResponse.json({ message: "Karta raqami noto'g'ri. 16 ta raqamni tekshirib, qayta kiriting", code: "BAD_CARD" }, { status: 400 });
    }
    if (!holderValid(holder)) {
      return NextResponse.json({ message: "Karta egasini lotin harflarida, kartadagidek yozing (masalan: ALI VALIYEV)", code: "BAD_HOLDER" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc("request_payout", {
      p_trainer: user.id,
      p_amount: amount,
      p_card: card,
      p_holder: holder,
    });

    if (error) {
      const mapped = mapDbError(error.message);
      if (mapped) return NextResponse.json({ message: mapped.message, code: mapped.code }, { status: mapped.status });
      throw error;
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Payouts POST:", error);
    return NextResponse.json({ message: "Server xatolik. Birozdan keyin qayta urinib ko'ring" }, { status: 500 });
  }
}
