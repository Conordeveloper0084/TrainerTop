import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getBannedUserIds } from "@/lib/bans";
import { isAdminId } from "@/lib/supabase/require-admin";
import { UUID_RE } from "@/lib/db-errors";
import { stripLessonContent } from "@/lib/lesson-content";

// GET /api/lessons/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabaseAdmin
      .from("lessons")
      .select(`*, profiles:trainer_id (id, full_name, avatar_url, role)`)
      .eq("id", params.id)
      .single();
    if (error) throw error;

    // Kim so'rayapti (cookie yoki Bearer) — bir marta aniqlanadi
    let viewer: any = null;
    try { viewer = (await getApiUser(request)).user; } catch (e) { console.error("viewer error:", e); }
    const viewerIsAdmin = !!viewer && (await isAdminId(viewer.id));
    const viewerIsOwner = !!viewer && viewer.id === data.trainer_id;

    // Admin olib tashlagan yoki ban qilingan trenerning darsligi — faqat egasi va adminga ko'rinadi
    if (data.status === "removed" || (await getBannedUserIds()).includes(data.trainer_id)) {
      if (!(viewerIsOwner || viewerIsAdmin)) return NextResponse.json({ message: "Darslik topilmadi" }, { status: 404 });
    }

    // Sotib olinganligini tekshirish + obuna muddati (cookie yoki Bearer token)
    let is_purchased = false;
    let purchase_type = null;
    let expires_at = null;
    let days_left = null;
    try {
      const user = viewer;
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

    // PULLIK KONTENT: faqat faol xaridor, egasi va admin ko'radi. Boshqalarga faqat modul/video sarlavhalari.
    const canSeeContent = is_purchased || viewerIsOwner || viewerIsAdmin;
    return NextResponse.json({
      ...data,
      content: canSeeContent ? data.content : stripLessonContent(data.content),
      content_locked: !canSeeContent,
      is_purchased, purchase_type, expires_at, days_left,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

// PUT /api/lessons/[id] — update (faqat ruxsat etilgan maydonlar)
const EDITABLE_LESSON_FIELDS = [
  "title", "description", "cover_image_url", "price", "pricing_model", "price_lifetime", "price_monthly",
  "category", "difficulty", "content", "status",
] as const;

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, any> = {};
    for (const f of EDITABLE_LESSON_FIELDS) if (f in body) updates[f] = body[f];

    if ("status" in updates && updates.status !== "draft" && updates.status !== "published") {
      return NextResponse.json({ message: "Noto'g'ri status" }, { status: 400 });
    }
    if ("title" in updates) {
      if (typeof updates.title !== "string" || !updates.title.trim()) return NextResponse.json({ message: "Nom kerak" }, { status: 400 });
      updates.title = updates.title.trim();
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ message: "O'zgartirish yo'q" }, { status: 400 });

    // Admin olib tashlagan darslikni trener qayta ochib/tahrirlab bo'lmaydi
    const { data: current } = await supabaseAdmin.from("lessons").select("status").eq("id", params.id).eq("trainer_id", user.id).maybeSingle();
    if (!current) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    if (current.status === "removed") {
      return NextResponse.json({ message: "Bu darslik administrator tomonidan olib tashlangan" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("lessons")
      .update(updates)
      .eq("id", params.id)
      .eq("trainer_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Lesson PUT:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// DELETE /api/lessons/[id]
// Sotuvi (xaridi) bor darslikni o'chirib bo'lmaydi: xaridorlar puli va trener daromad tarixi saqlanishi kerak.
// Bunday darslik e'londan olinadi (qoralama). Admin olib tashlagan darslikni ham egasi o'chira olmaydi.
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });

    const { data: lesson } = await supabaseAdmin.from("lessons").select("id, status").eq("id", params.id).eq("trainer_id", user.id).maybeSingle();
    if (!lesson) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    if (lesson.status === "removed") {
      return NextResponse.json({ message: "Bu darslik administrator tomonidan olib tashlangan" }, { status: 403 });
    }

    const [purchases, txs] = await Promise.all([
      supabaseAdmin.from("purchases").select("id", { count: "exact", head: true }).eq("lesson_id", params.id),
      supabaseAdmin.from("click_transactions").select("id", { count: "exact", head: true }).eq("lesson_id", params.id),
    ]);
    if ((purchases.count || 0) > 0 || (txs.count || 0) > 0) {
      await supabaseAdmin.from("lessons").update({ status: "draft" }).eq("id", params.id).eq("trainer_id", user.id);
      return NextResponse.json(
        { message: "Sotilgan darslikni o'chirib bo'lmaydi — xaridorlar uni ko'rishda davom etadi. Darslik e'londan olindi (qoralama)." },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin.from("lessons").delete().eq("id", params.id).eq("trainer_id", user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Lesson DELETE:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
