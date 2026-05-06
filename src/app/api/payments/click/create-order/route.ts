import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SERVICE_ID = process.env.CLICK_SERVICE_ID || "";
const MERCHANT_ID = process.env.CLICK_MERCHANT_ID || "";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://trainertop.uz";

// POST /api/payments/click/create-order
// User "Sotib olish" bosganda — buyurtma yaratadi va Click URL qaytaradi
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { lesson_id, price_type } = await request.json();
    if (!lesson_id) return NextResponse.json({ message: "lesson_id kerak" }, { status: 400 });

    // 1. Darslik tekshirish
    const { data: lesson } = await supabaseAdmin
      .from("lessons")
      .select("id, title, price, price_lifetime, price_monthly, pricing_model, trainer_id")
      .eq("id", lesson_id)
      .single();

    if (!lesson) return NextResponse.json({ message: "Darslik topilmadi" }, { status: 404 });

    // O'z darsligini sotib olish mumkin emas
    if (lesson.trainer_id === user.id) {
      return NextResponse.json({ message: "O'z darsligingizni sotib ola olmaysiz" }, { status: 400 });
    }

    // Allaqachon sotib olingan
    const { data: existing } = await supabaseAdmin
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("lesson_id", lesson_id)
      .eq("status", "paid")
      .single();

    if (existing) return NextResponse.json({ message: "Siz bu darslikni allaqachon sotib olgansiz" }, { status: 400 });

    // 2. Narxni aniqlash
    let amount = lesson.price || lesson.price_lifetime || 0;
    if (price_type === "monthly" && lesson.price_monthly > 0) {
      amount = lesson.price_monthly;
    } else if (price_type === "lifetime" && lesson.price_lifetime > 0) {
      amount = lesson.price_lifetime;
    }

    if (amount <= 0) return NextResponse.json({ message: "Narx noto'g'ri" }, { status: 400 });

    // 3. Buyurtma yaratish
    const merchantTransId = `order_${user.id.slice(0, 8)}_${Date.now()}`;

    const { data: transaction, error } = await supabaseAdmin
      .from("click_transactions")
      .insert({
        merchant_trans_id: merchantTransId,
        user_id: user.id,
        lesson_id: lesson.id,
        amount,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    // 4. Click to'lov URL yaratish
    const clickUrl = `https://my.click.uz/services/pay?service_id=${SERVICE_ID}&merchant_id=${MERCHANT_ID}&amount=${amount}&transaction_param=${merchantTransId}&return_url=${encodeURIComponent(`${SITE_URL}/lessons/${lesson_id}?payment=success`)}`;

    return NextResponse.json({
      order_id: merchantTransId,
      payment_url: clickUrl,
      amount,
    });
  } catch (error: any) {
    console.error("Create order error:", error);
    return NextResponse.json({ message: error.message || "Xatolik" }, { status: 500 });
  }
}
