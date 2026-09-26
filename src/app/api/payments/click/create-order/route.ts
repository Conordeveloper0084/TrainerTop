import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getBannedUserIds } from "@/lib/bans";

const SERVICE_ID = process.env.CLICK_SERVICE_ID || "";
const MERCHANT_ID = process.env.CLICK_MERCHANT_ID || "";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.trainertop.uz";

// POST /api/payments/click/create-order
// User "Sotib olish" bosganda — buyurtma yaratadi va Click URL qaytaradi
// HAM website (cookie) HAM app (Bearer token) uchun ishlaydi
export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { lesson_id, price_type } = await request.json();
    if (!lesson_id) return NextResponse.json({ message: "lesson_id kerak" }, { status: 400 });

    // 1. Darslik tekshirish
    const { data: lesson } = await supabaseAdmin
      .from("lessons")
      .select("id, title, price, price_lifetime, price_monthly, pricing_model, trainer_id, status")
      .eq("id", lesson_id)
      .single();

    if (!lesson) return NextResponse.json({ message: "Darslik topilmadi" }, { status: 404 });

    // O'chirilgan, qoralama yoki ban qilingan trenerning darsligini sotib olib bo'lmaydi
    if (lesson.status !== "published") return NextResponse.json({ message: "Bu darslik hozir sotuvda emas" }, { status: 400 });
    if ((await getBannedUserIds()).includes(lesson.trainer_id)) {
      return NextResponse.json({ message: "Bu darslik hozir sotuvda emas" }, { status: 400 });
    }

    // O'z darsligini sotib olish mumkin emas
    if (lesson.trainer_id === user.id) {
      return NextResponse.json({ message: "O'z darsligingizni sotib ola olmaysiz" }, { status: 400 });
    }

    // Allaqachon sotib olingan (FAOL). Muddati tugagan OYLIK obunani qayta to'lab yangilash mumkin.
    const { data: existing } = await supabaseAdmin
      .from("purchases")
      .select("id, purchase_type, expires_at")
      .eq("user_id", user.id)
      .eq("lesson_id", lesson_id)
      .eq("status", "paid")
      .maybeSingle();

    const expired = !!existing && existing.purchase_type === "monthly" && !!existing.expires_at
      && new Date(existing.expires_at).getTime() <= Date.now();
    if (existing && !expired) return NextResponse.json({ message: "Siz bu darslikni allaqachon sotib olgansiz" }, { status: 400 });
    // Obunasi tugagan foydalanuvchi faqat oylik to'lovni yangilaydi
    if (expired && price_type !== "monthly") {
      return NextResponse.json({ message: "Obunani yangilash uchun oylik to'lovni tanlang" }, { status: 400 });
    }

    // 2. Narxni aniqlash
    let amount = lesson.price || lesson.price_lifetime || 0;
    if (price_type === "monthly" && lesson.price_monthly > 0) {
      amount = lesson.price_monthly;
    } else if (price_type === "lifetime" && lesson.price_lifetime > 0) {
      amount = lesson.price_lifetime;
    }

    if (amount <= 0) return NextResponse.json({ message: "Narx noto'g'ri" }, { status: 400 });

    // 3. Buyurtma yaratish (price_type ni ID ga qo'shamiz)
    const typeTag = price_type === "monthly" ? "_monthly" : "_lifetime";
    const merchantTransId = `order_${user.id.slice(0, 8)}_${Date.now()}${typeTag}`;

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
