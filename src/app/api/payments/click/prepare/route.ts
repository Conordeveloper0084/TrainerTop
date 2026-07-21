import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SECRET_KEY = process.env.CLICK_SECRET_KEY || "";

// Click so'rovni parse qilish — JSON yoki FormData
async function parseClickRequest(request: NextRequest): Promise<Record<string, string>> {
  const ct = request.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const json = await request.json();
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(json)) result[k] = String(v ?? "");
      return result;
    }
    // form-urlencoded yoki multipart
    const fd = await request.formData();
    const result: Record<string, string> = {};
    fd.forEach((v, k) => { result[k] = v.toString(); });
    return result;
  } catch {
    // URL params fallback
    const url = new URL(request.url);
    const result: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { result[k] = v; });
    return result;
  }
}

// POST /api/payments/click/prepare
export async function POST(request: NextRequest) {
  try {
    const body = await parseClickRequest(request);

    const click_trans_id = body.click_trans_id || "";
    const service_id = body.service_id || "";
    const merchant_trans_id = body.merchant_trans_id || "";
    const amount = body.amount || "0";
    const action = body.action || "0";
    const error = body.error || "0";
    const sign_time = body.sign_time || "";
    const sign_string = body.sign_string || "";

    console.log("Click PREPARE:", JSON.stringify(body));

    // Sign tekshirish
    const mySign = createHash("md5")
      .update(`${click_trans_id}${service_id}${SECRET_KEY}${merchant_trans_id}${amount}${action}${sign_time}`)
      .digest("hex");

    if (mySign !== sign_string) {
      return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_prepare_id: 0, error: -1, error_note: "SIGN CHECK FAILED" });
    }

    if (error !== "0" && error !== "") {
      return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_prepare_id: 0, error: -9, error_note: "Transaction cancelled" });
    }

    // Transaction tekshirish
    const { data: transaction } = await supabaseAdmin
      .from("click_transactions").select("*").eq("merchant_trans_id", merchant_trans_id).single();

    if (!transaction) {
      return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_prepare_id: 0, error: -6, error_note: "Transaction does not exist" });
    }

    if (transaction.status === "completed") {
      return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_prepare_id: 0, error: -4, error_note: "Already paid" });
    }

    if (Math.abs(parseFloat(amount) - transaction.amount) > 1) {
      return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_prepare_id: 0, error: -2, error_note: "Incorrect parameter amount" });
    }

    // Preparing
    const prepareId = Date.now();
    await supabaseAdmin.from("click_transactions").update({
      click_trans_id: parseInt(click_trans_id) || 0,
      click_paydoc_id: parseInt(body.click_paydoc_id || "0") || 0,
      merchant_prepare_id: prepareId,
      status: "preparing",
      sign_time,
    }).eq("merchant_trans_id", merchant_trans_id);

    return NextResponse.json({ click_trans_id: parseInt(click_trans_id) || 0, merchant_trans_id, merchant_prepare_id: prepareId, error: 0, error_note: "Success" });
  } catch (err: any) {
    console.error("Prepare error:", err);
    return NextResponse.json({ click_trans_id: 0, merchant_trans_id: "", merchant_prepare_id: 0, error: -7, error_note: err.message });
  }
}
