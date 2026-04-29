import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { COMMISSION_RATE } from "@/lib/constants";

// POST /api/payments/create — To'lov boshlash
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    }

    const { lesson_id } = await request.json();

    // Darslik mavjudmi
    const { data: lesson } = await supabase
      .from("lessons")
      .select("id, title, price, trainer_id, status")
      .eq("id", lesson_id)
      .eq("status", "published")
      .single();

    if (!lesson) {
      return NextResponse.json({ message: "Darslik topilmadi" }, { status: 404 });
    }

    // Allaqachon sotib olinganmi
    const { data: existing } = await supabase
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("lesson_id", lesson_id)
      .eq("status", "paid")
      .single();

    if (existing) {
      return NextResponse.json(
        { message: "Bu darslik allaqachon sotib olingan" },
        { status: 400 }
      );
    }

    // Komissiya hisoblash
    const commission = Math.round(lesson.price * COMMISSION_RATE);
    const trainerAmount = lesson.price - commission;

    // Purchase yaratish (pending)
    const { data: purchase, error } = await supabase
      .from("purchases")
      .insert({
        user_id: user.id,
        lesson_id,
        trainer_id: lesson.trainer_id,
        amount: lesson.price,
        commission,
        trainer_amount: trainerAmount,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ message: "To'lov yaratishda xatolik" }, { status: 500 });
    }

    // Click.uz to'lov URL yaratish
    const clickUrl = buildClickUrl({
      merchantId: process.env.CLICK_MERCHANT_ID!,
      serviceId: process.env.CLICK_SERVICE_ID!,
      amount: lesson.price,
      transactionId: purchase.id,
      returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/lessons/${lesson_id}?payment=success`,
    });

    return NextResponse.json({
      purchase_id: purchase.id,
      payment_url: clickUrl,
      amount: lesson.price,
    });
  } catch (error) {
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// Click.uz URL builder
function buildClickUrl(params: {
  merchantId: string;
  serviceId: string;
  amount: number;
  transactionId: string;
  returnUrl: string;
}) {
  const baseUrl = "https://my.click.uz/services/pay";
  const url = new URL(baseUrl);
  url.searchParams.set("service_id", params.serviceId);
  url.searchParams.set("merchant_id", params.merchantId);
  url.searchParams.set("amount", params.amount.toString());
  url.searchParams.set("transaction_param", params.transactionId);
  url.searchParams.set("return_url", params.returnUrl);
  return url.toString();
}
