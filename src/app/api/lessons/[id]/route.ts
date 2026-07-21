import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

// GET /api/lessons/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabaseAdmin
      .from("lessons")
      .select(`*, profiles:trainer_id (id, full_name, avatar_url, role)`)
      .eq("id", params.id)
      .single();
    if (error) throw error;

    // Sotib olinganligini tekshirish + obuna muddati (cookie yoki Bearer token)
    let is_purchased = false;
    let purchase_type = null;
    let expires_at = null;
    let days_left = null;
    try {
      const { user } = await getApiUser(request);
      if (user) {
        const { data: purchases } = await supabaseAdmin
          .from("purchases")
          .select("id, purchase_type, expires_at")
          .eq("user_id", user.id)
          .eq("lesson_id", params.id)
          .eq("status", "paid")
          .limit(1);
        
        if (purchases && purchases.length > 0) {
          const purchase = purchases[0];
          purchase_type = purchase.purchase_type || "lifetime";
          expires_at = purchase.expires_at;
          
          if (purchase_type === "monthly" && expires_at) {
            const now = new Date();
            const expDate = new Date(expires_at);
            const diff = expDate.getTime() - now.getTime();
            days_left = Math.ceil(diff / (1000 * 60 * 60 * 24));
            is_purchased = days_left > 0;
          } else {
            is_purchased = true;
            days_left = null; // umrbod
          }
        }
      }
    } catch (e) {
      console.error("is_purchased check error:", e);
    }

    return NextResponse.json({ ...data, is_purchased, purchase_type, expires_at, days_left });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// PUT /api/lessons/[id] — update
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const body = await request.json();
    const { data, error } = await supabaseAdmin
      .from("lessons")
      .update(body)
      .eq("id", params.id)
      .eq("trainer_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// DELETE /api/lessons/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { error } = await supabaseAdmin
      .from("lessons")
      .delete()
      .eq("id", params.id)
      .eq("trainer_id", user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
