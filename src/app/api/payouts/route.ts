import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { digitsOnly, luhnValid, holderValid, normalizeHolder } from "@/lib/card";
import { mapDbError } from "@/lib/db-errors";
import { strictNumber } from "@/lib/num";
import { encryptCardNumber, decryptCardNumber, isPayoutCardKeyConfigured } from "@/lib/crypto-card";

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
// Body — ikki usuldan BIRI:
//   (a) { amount, card_number, card_holder, save_card?: true } — karta qo'lda kiritiladi (avvalgidek);
//       save_card=true bo'lsa, SHU karta (shifrlab) keyingi safar uchun ham saqlanadi.
//   (b) { amount, use_saved_card: true } — oldin saqlangan karta ishlatiladi (qayta kiritilmaydi).
// Karta ILOVA DARAJASIDA shifrlanadi (lib/crypto-card) — xom raqam bazaga yozilmaydi.
// Summa balansdan DARHOL ushlab qolinadi; admin rad etsa qaytariladi (hammasi bitta DB tranzaksiyasida).
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const amount = strictNumber(body.amount);
    if (amount === null || !Number.isInteger(amount) || amount <= 0 || amount > 2_000_000_000) {
      return NextResponse.json({ message: "Summa noto'g'ri" }, { status: 400 });
    }

    let cardEncrypted: string; let last4: string; let holder: string;

    if (body.use_saved_card === true) {
      const { data: saved } = await supabaseAdmin.from("trainer_payout_cards").select("card_number_encrypted, card_last4, card_holder").eq("trainer_id", user.id).maybeSingle();
      if (!saved) return NextResponse.json({ message: "Saqlangan karta topilmadi. Avval karta ma'lumotlarini kiriting", code: "NO_SAVED_CARD" }, { status: 400 });
      cardEncrypted = saved.card_number_encrypted; last4 = saved.card_last4; holder = saved.card_holder;
    } else {
      if (!isPayoutCardKeyConfigured()) { console.error("PAYOUT_CARD_KEY sozlanmagan"); return NextResponse.json({ message: "Server xatolik" }, { status: 500 }); }
      const card = digitsOnly(String(body.card_number ?? ""));
      holder = normalizeHolder(String(body.card_holder ?? ""));
      if (!luhnValid(card)) {
        return NextResponse.json({ message: "Karta raqami noto'g'ri. 16 ta raqamni tekshirib, qayta kiriting", code: "BAD_CARD" }, { status: 400 });
      }
      if (!holderValid(holder)) {
        return NextResponse.json({ message: "Karta egasini lotin harflarida, kartadagidek yozing (masalan: ALI VALIYEV)", code: "BAD_HOLDER" }, { status: 400 });
      }
      cardEncrypted = encryptCardNumber(card); last4 = card.slice(-4);
      if (body.save_card === true) {
        const { error: saveErr } = await supabaseAdmin.from("trainer_payout_cards").upsert(
          { trainer_id: user.id, card_number_encrypted: cardEncrypted, card_last4: last4, card_holder: holder, updated_at: new Date().toISOString() },
          { onConflict: "trainer_id" },
        );
        if (saveErr) console.error("Payout card saqlashda xato (so'rov baribir davom etadi):", saveErr);
      }
    }

    const { data, error } = await supabaseAdmin.rpc("request_payout", {
      p_trainer: user.id,
      p_amount: amount,
      p_card_encrypted: cardEncrypted,
      p_card_last4: last4,
      p_card_holder: holder,
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
