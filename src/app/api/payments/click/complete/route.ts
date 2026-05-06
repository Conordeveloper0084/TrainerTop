import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SECRET_KEY = process.env.CLICK_SECRET_KEY || "";

async function parseClickRequest(request: NextRequest): Promise<Record<string, string>> {
  const ct = request.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const json = await request.json();
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(json)) result[k] = String(v ?? "");
      return result;
    }
    const fd = await request.formData();
    const result: Record<string, string> = {};
    fd.forEach((v, k) => { result[k] = v.toString(); });
    return result;
  } catch {
    const url = new URL(request.url);
    const result: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { result[k] = v; });
    return result;
  }
}

// POST /api/payments/click/complete
export async function POST(request: NextRequest) {
  try {
    const body = await parseClickRequest(request);

    const click_trans_id = body.click_trans_id || "";
    const service_id = body.service_id || "";
    const merchant_trans_id = body.merchant_trans_id || "";
    const merchant_prepare_id = body.merchant_prepare_id || "0";
    const amount = body.amount || "0";
    const action = body.action || "1";
    const error = body.error || "0";
    const error_note = body.error_note || "";
    const sign_time = body.sign_time || "";
    const sign_string = body.sign_string || "";

    console.log("Click COMPLETE:", JSON.stringify(body));

    // Sign tekshirish
    const mySign = createHash("md5")
      .update(`${click_trans_id}${service_id}${SECRET_KEY}${merchant_trans_id}${merchant_prepare_id}${amount}${action}${sign_time}`)
      .digest("hex");

    if (mySign !== sign_string) {
      return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_confirm_id: 0, error: -1, error_note: "SIGN CHECK FAILED" });
    }

    // Transaction topish
    const { data: transaction } = await supabaseAdmin
      .from("click_transactions").select("*").eq("merchant_trans_id", merchant_trans_id).single();

    if (!transaction) {
      return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_confirm_id: 0, error: -6, error_note: "Transaction does not exist" });
    }

    if (transaction.status === "completed") {
      return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_confirm_id: transaction.id, error: -4, error_note: "Already paid" });
    }

    // Click xatolik — bekor qilish
    if (error !== "0" && error !== "") {
      await supabaseAdmin.from("click_transactions").update({ status: "cancelled", error_code: parseInt(error), error_note }).eq("merchant_trans_id", merchant_trans_id);
      return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_confirm_id: 0, error: -9, error_note: "Transaction cancelled" });
    }

    // Summa tekshirish
    if (Math.abs(parseFloat(amount) - transaction.amount) > 1) {
      return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_confirm_id: 0, error: -2, error_note: "Incorrect parameter amount" });
    }

    // ======= TO'LOV MUVAFFAQIYATLI =======

    // 1. Click transaction yangilash
    await supabaseAdmin.from("click_transactions").update({
      status: "completed", completed_at: new Date().toISOString(), error_code: 0,
    }).eq("merchant_trans_id", merchant_trans_id);

    // 2. Darslik ma'lumotlari
    const { data: lesson } = await supabaseAdmin
      .from("lessons").select("id, trainer_id, price, price_lifetime, price_monthly, title, total_sales")
      .eq("id", transaction.lesson_id).single();

    if (lesson && transaction.user_id) {
      const purchaseAmount = transaction.amount;
      const commission = Math.round(purchaseAmount * 0.1);
      const trainerAmount = purchaseAmount - commission;

      // 3. Purchase yaratish
      await supabaseAdmin.from("purchases").upsert({
        user_id: transaction.user_id,
        lesson_id: lesson.id,
        trainer_id: lesson.trainer_id,
        amount: purchaseAmount,
        commission,
        trainer_amount: trainerAmount,
        payment_method: "click",
        payment_id: click_trans_id,
        status: "paid",
      }, { onConflict: "user_id,lesson_id" });

      // 4. Trener balansi
      const { data: tp } = await supabaseAdmin
        .from("trainer_profiles").select("balance, total_earned").eq("user_id", lesson.trainer_id).single();

      if (tp) {
        await supabaseAdmin.from("trainer_profiles").update({
          balance: (tp.balance || 0) + trainerAmount,
          total_earned: (tp.total_earned || 0) + trainerAmount,
        }).eq("user_id", lesson.trainer_id);
      }

      // 5. Sotuv soni
      await supabaseAdmin.from("lessons").update({
        total_sales: (lesson.total_sales || 0) + 1,
      }).eq("id", lesson.id);

      // 6. Notification
      await supabaseAdmin.from("notifications").insert({
        user_id: lesson.trainer_id,
        type: "sale",
        title: "Yangi sotuv!",
        message: `"${lesson.title}" darsligingiz sotildi. +${trainerAmount.toLocaleString()} so'm`,
      }).catch(() => {});

      console.log(`PAYMENT OK: lesson=${lesson.id}, amount=${purchaseAmount}, trainer=${trainerAmount}`);
    }

    return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_confirm_id: transaction.id, error: 0, error_note: "Success" });
  } catch (err: any) {
    console.error("Complete error:", err);
    return NextResponse.json({ click_trans_id: 0, merchant_trans_id: "", merchant_confirm_id: 0, error: -7, error_note: err.message });
  }
}
