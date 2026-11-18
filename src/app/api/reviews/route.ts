import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// POST /api/reviews — Sharh yozish
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    }

    const { trainer_id, lesson_id, rating, comment } = await request.json();

    if (!trainer_id || !rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { message: "Trener ID va reyting (1-5) kerak" },
        { status: 400 }
      );
    }

    // O'ziga sharh yozish mumkin emas
    if (trainer_id === user.id) {
      return NextResponse.json(
        { message: "O'zingizga sharh yoza olmaysiz" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("reviews")
      .upsert(
        {
          trainer_id,
          user_id: user.id,
          lesson_id: lesson_id || null,
          rating,
          comment: comment || null,
        },
        {
          onConflict: "trainer_id,user_id",
        }
      )
      .select(
        `*, user:profiles!reviews_user_id_fkey(id, full_name, avatar_url)`
      )
      .single();

    if (error) {
      console.error("Review error:", error);
      return NextResponse.json(
        { message: "Sharh yozishda xatolik" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
