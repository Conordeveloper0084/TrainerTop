import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { UUID_RE } from "@/lib/db-errors";

// GET /api/admin/lessons/[id] — har qanday darslikni TO'LIQ ko'rish (admin uchun, faqat o'qish)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });

    const { data, error } = await supabaseAdmin
      .from("lessons")
      .select("*, profiles:trainer_id (id, full_name, avatar_url, email)")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });

    // Darslik guruhi (chat): nomi, holati va a'zolar soni
    const { data: group } = await supabaseAdmin.from("chat_groups").select("id, name, is_archived").eq("lesson_id", params.id).maybeSingle();
    let members = 0;
    if (group) {
      const { count } = await supabaseAdmin.from("chat_group_members").select("user_id", { count: "exact", head: true }).eq("group_id", group.id).eq("status", "active");
      members = count || 0;
    }
    return NextResponse.json({ ...data, chat_group: group ? { ...group, members } : null });
  } catch (error: any) {
    console.error("Admin lesson GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// PUT /api/admin/lessons/[id] — FAQAT platforma (admin yaratgan) darsliklarini tahrirlash.
// Trenerlarning darsliklarini admin tahrirlay olmaydi (.eq("is_platform", true)).
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });

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
    if (status !== undefined) {
      if (status !== "draft" && status !== "published") return NextResponse.json({ message: "Noto'g'ri status" }, { status: 400 });
      updates.status = status;
    }

    const { data, error } = await supabaseAdmin
      .from("lessons")
      .update(updates)
      .eq("id", params.id)
      .eq("is_platform", true)
      .neq("status", "removed")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "Faqat platforma darsliklarini tahrirlash mumkin" }, { status: 403 });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Admin lesson PUT:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// DELETE mavjud EMAS: darslik butunlay o'chirilmaydi. Olib tashlash: POST /remove (sabab + "delete" yozib tasdiqlash),
// tiklash: POST /restore.
