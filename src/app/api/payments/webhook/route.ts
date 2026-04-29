import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// POST /api/payments/webhook — Click.uz webhook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      click_trans_id,
      service_id,
      merchant_trans_id, // bizning purchase.id
      amount,
      action,
      sign_time,
      sign_string,
      error: clickError,
    } = body;

    // Signature tekshirish
    const secretKey = process.env.CLICK_SECRET_KEY!;
    const expectedSign = crypto
      .createHash("md5")
      .update(
        `${click_trans_id}${service_id}${secretKey}${merchant_trans_id}${amount}${action}${sign_time}`
      )
      .digest("hex");

    if (sign_string !== expectedSign) {
      return NextResponse.json(
        {
          error: -1,
          error_note: "SIGN CHECK FAILED",
        },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Action 0 = prepare, Action 1 = complete
    if (action === 0) {
      // Prepare — purchase mavjudmi tekshirish
      const { data: purchase } = await supabase
        .from("purchases")
        .select("id, amount, status")
        .eq("id", merchant_trans_id)
        .single();

      if (!purchase) {
        return NextResponse.json({
          error: -5,
          error_note: "Transaction not found",
        });
      }

      if (purchase.status === "paid") {
        return NextResponse.json({
          error: -4,
          error_note: "Already paid",
        });
      }

      if (purchase.amount !== Math.round(amount)) {
        return NextResponse.json({
          error: -2,
          error_note: "Incorrect amount",
        });
      }

      return NextResponse.json({
        error: 0,
        error_note: "Success",
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: purchase.id,
      });
    }

    if (action === 1) {
      // Complete — to'lov muvaffaqiyatli
      if (clickError && parseInt(clickError) < 0) {
        // To'lov bekor qilingan
        await supabase
          .from("purchases")
          .update({ status: "failed" })
          .eq("id", merchant_trans_id);

        return NextResponse.json({
          error: -9,
          error_note: "Transaction cancelled",
        });
      }

      // Muvaffaqiyatli to'lov
      await supabase
        .from("purchases")
        .update({
          status: "paid",
          payment_id: String(click_trans_id),
        })
        .eq("id", merchant_trans_id);

      return NextResponse.json({
        error: 0,
        error_note: "Success",
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: merchant_trans_id,
      });
    }

    return NextResponse.json({ error: -3, error_note: "Unknown action" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: -8, error_note: "Server error" },
      { status: 500 }
    );
  }
}
