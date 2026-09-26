import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SECRET_KEY = process.env.CLICK_SECRET_KEY || "";

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

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

    if (!SECRET_KEY || !safeEqualHex(mySign, sign_string)) {
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
    // Xarid, trener balansi, hisob daftari, sotuv soni va bildirishnoma BITTA DB tranzaksiyasida.
    // Xato bo'lsa hech narsa yozilmaydi (yarim holat yo'q); takroriy chaqiruv ikki marta hisoblamaydi.
    const purchaseType = String(merchant_trans_id).endsWith("_monthly") ? "monthly" : "lifetime";

    const { data: sale, error: saleError } = await supabaseAdmin.rpc("credit_click_sale", {
      p_merchant_trans_id: merchant_trans_id,
      p_click_trans_id: click_trans_id,
      p_purchase_type: purchaseType,
    });

    if (saleError) {
      console.error("credit_click_sale xatosi:", saleError.message);
      return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_confirm_id: 0, error: -7, error_note: "Failed to update user" });
    }

    if (sale?.status === "already_paid") {
      return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_confirm_id: transaction.id, error: -4, error_note: "Already paid" });
    }

    console.log(`PAYMENT OK: tx=${merchant_trans_id}, gross=${sale?.gross}, commission=${sale?.commission} (${sale?.rate}%), trainer=${sale?.net}`);

    return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_confirm_id: transaction.id, error: 0, error_note: "Success" });
  } catch (err: any) {
    console.error("Complete error:", err);
    return NextResponse.json({ click_trans_id: 0, merchant_trans_id: "", merchant_confirm_id: 0, error: -7, error_note: "Failed to update user" });
  }
}
