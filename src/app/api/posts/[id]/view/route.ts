import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// POST /api/posts/[id]/view — view count oshirish
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Oddiy select + update (atomic emas lekin MVP uchun yetarli)
    const { data } = await supabaseAdmin
      .from("posts")
      .select("views_count")
      .eq("id", params.id)
      .single();

    if (data) {
      await supabaseAdmin
        .from("posts")
        .update({ views_count: (data.views_count || 0) + 1 })
        .eq("id", params.id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Xato bo'lsa ham 200 qaytarish — UX buzmaslik uchun
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
