import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function requireAdmin() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return null;
  return user;
}

// GET /api/admin/lessons/[id] — bitta platforma darsligi (edit uchun)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("lessons")
      .select("*")
      .eq("id", params.id)
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// PUT /api/admin/lessons/[id] — platforma darsligini tahrirlash
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const body = await request.json();
    const { title, description, price, pricing_model, price_lifetime, price_monthly, category, difficulty, cover_url, sections, status } = body;

    const updates: any = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description || null;
    if (price_lifetime !== undefined || price !== undefined) {
      updates.price = parseInt(price) || parseInt(price_lifetime) || parseInt(price_monthly) || 0;
    }
    if (pricing_model !== undefined) updates.pricing_model = pricing_model;
    if (price_lifetime !== undefined) updates.price_lifetime = parseInt(price_lifetime) || 0;
    if (price_monthly !== undefined) updates.price_monthly = parseInt(price_monthly) || 0;
    if (category !== undefined) updates.category = category || null;
    if (difficulty !== undefined) updates.difficulty = difficulty || "beginner";
    if (cover_url !== undefined) updates.cover_image_url = cover_url || null;
    if (sections !== undefined) updates.content = { sections };
    if (status !== undefined) updates.status = status;

    const { data, error } = await supabaseAdmin
      .from("lessons")
      .update(updates)
      .eq("id", params.id)
      .eq("is_platform", true)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/lessons/[id] — platforma darsligini o'chirish
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const { error } = await supabaseAdmin
      .from("lessons")
      .delete()
      .eq("id", params.id)
      .eq("is_platform", true);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
