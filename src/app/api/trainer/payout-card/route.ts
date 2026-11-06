import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { digitsOnly, luhnValid, holderValid, normalizeHolder } from "@/lib/card";
import { encryptCardNumber, isPayoutCardKeyConfigured } from "@/lib/crypto-card";

// Trener (ixtiyoriy, roziligi bilan) pul yechish kartasini shifrlab saqlashi — har safar
// qayta kiritmasligi uchun. Faqat trenerlar uchun (foydalanuvchida pul yechish yo'q).

// GET /api/trainer/payout-card — { last4, holder } yoki null. TO'LIQ raqam HECH QACHON qaytmaydi.
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { data, error } = await supabaseAdmin.from("trainer_payout_cards").select("card_last4, card_holder").eq("trainer_id", user.id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json(null);
    return NextResponse.json({ last4: data.card_last4, holder: data.card_holder });
  } catch (error: any) {
    console.error("Payout-card GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// PUT /api/trainer/payout-card — { card_number, card_holder } — shifrlab saqlaydi (bor bo'lsa almashtiradi).
export async function PUT(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    if (!isPayoutCardKeyConfigured()) { console.error("PAYOUT_CARD_KEY sozlanmagan"); return NextResponse.json({ message: "Server xatolik" }, { status: 500 }); }

    const { data: tp } = await supabaseAdmin.from("trainer_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!tp) return NextResponse.json({ message: "Faqat trenerlar kartani saqlashi mumkin" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const card = digitsOnly(String(body.card_number ?? ""));
    const holder = normalizeHolder(String(body.card_holder ?? ""));
    if (!luhnValid(card)) return NextResponse.json({ message: "Karta raqami noto'g'ri. 16 ta raqamni tekshirib, qayta kiriting", code: "BAD_CARD" }, { status: 400 });
    if (!holderValid(holder)) return NextResponse.json({ message: "Karta egasini lotin harflarida, kartadagidek yozing (masalan: ALI VALIYEV)", code: "BAD_HOLDER" }, { status: 400 });

    const encrypted = encryptCardNumber(card);
    const last4 = card.slice(-4);
    const { error } = await supabaseAdmin.from("trainer_payout_cards").upsert(
      { trainer_id: user.id, card_number_encrypted: encrypted, card_last4: last4, card_holder: holder, updated_at: new Date().toISOString() },
      { onConflict: "trainer_id" },
    );
    if (error) throw error;
    return NextResponse.json({ last4, holder });
  } catch (error: any) {
    console.error("Payout-card PUT:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// DELETE /api/trainer/payout-card — saqlangan kartani o'chiradi.
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { error } = await supabaseAdmin.from("trainer_payout_cards").delete().eq("trainer_id", user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Payout-card DELETE:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
