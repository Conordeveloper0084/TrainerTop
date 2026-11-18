import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { UUID_RE } from "@/lib/db-errors";
import { strictNumber } from "@/lib/num";

// PUT /api/admin/trainers/[id]
// Body: { commission_rate?: number | null, badge?: "grant" | "revoke" | "auto", featured?: "add" | "remove" | "blurb", featured_blurb?: string | null }
//  - commission_rate: 0–100 (individual foiz). null = umumiy foizga qaytarish.
//    FAQAT kelgusi sotuvlarga ta'sir qiladi; oldingi sotuvlar hisob daftarida o'zgarmaydi.
//  - badge: grant = admin beradi (obunachisiz ham), revoke = olib tashlaydi (avtomatik qayta bermaydi),
//           auto = avtomatik qoidaga qaytaradi (shartga mos bo'lsa beriladi)
//  - featured: bosh sahifa "Top trenerlar" ro'yxatiga qo'shish/olib tashlash/matnini yangilash
const FEATURED_ERRORS: Record<string, [number, string]> = {
  FORBIDDEN: [403, "Ruxsat yo'q"],
  TRAINER_NOT_FOUND: [404, "Trener topilmadi"],
  BAD_ACTION: [400, "Noto'g'ri amal"],
  BAD_BLURB: [400, "Qo'shimcha matn 120 belgidan oshmasin"],
};

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Trener topilmadi" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const { data: tp } = await supabaseAdmin
      .from("trainer_profiles")
      .select("user_id, commission_rate, is_verified, badge_source")
      .eq("user_id", params.id)
      .maybeSingle();
    if (!tp) return NextResponse.json({ message: "Trener topilmadi" }, { status: 404 });

    const result: Record<string, any> = {};

    // ---- komissiya
    if ("commission_rate" in body) {
      let rate: number | null = null;
      if (body.commission_rate !== null) {
        rate = strictNumber(body.commission_rate);
        if (rate === null || rate < 0 || rate > 100) {
          return NextResponse.json({ message: "Komissiya 0 dan 100 gacha bo'lishi kerak" }, { status: 400 });
        }
        rate = Math.round(rate * 100) / 100;
      }
      const { error } = await supabaseAdmin.from("trainer_profiles").update({ commission_rate: rate }).eq("user_id", params.id);
      if (error) throw error;
      await logAdmin(admin.id, "commission_change", "trainer", params.id, { from: tp.commission_rate, to: rate });
      try {
        const { data: def } = await supabaseAdmin.from("platform_settings").select("value").eq("key", "default_commission_percent").maybeSingle();
        const shown = rate ?? Number(def?.value ?? 10);
        await supabaseAdmin.from("notifications").insert({
          user_id: params.id, type: "commission", title: "Komissiya o'zgardi",
          body: `Yangi sotuvlar uchun platforma komissiyasi: ${shown}%`, data: {},
        });
      } catch {}
      result.commission_rate = rate;
    }

    // ---- nishon
    if (body.badge !== undefined) {
      if (!["grant", "revoke", "auto"].includes(body.badge)) {
        return NextResponse.json({ message: "Noto'g'ri amal" }, { status: 400 });
      }
      if (body.badge === "grant") {
        const { error } = await supabaseAdmin.from("trainer_profiles")
          .update({ is_verified: true, badge_source: "admin", badge_granted_at: new Date().toISOString() }).eq("user_id", params.id);
        if (error) throw error;
        try {
          await supabaseAdmin.from("notifications").insert({
            user_id: params.id, type: "badge", title: "Tabriklaymiz!", body: "Siz TrainerTop Trener nishonini oldingiz", data: {},
          });
        } catch {}
      } else if (body.badge === "revoke") {
        const { error } = await supabaseAdmin.from("trainer_profiles")
          .update({ is_verified: false, badge_source: "revoked", badge_granted_at: null }).eq("user_id", params.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin.from("trainer_profiles")
          .update({ is_verified: false, badge_source: null, badge_granted_at: null }).eq("user_id", params.id);
        if (error) throw error;
        await supabaseAdmin.rpc("refresh_trainer_badge", { p_trainer: params.id });
      }
      await logAdmin(admin.id, `badge_${body.badge}`, "trainer", params.id, { was: { is_verified: tp.is_verified, source: tp.badge_source } });
      const { data: after } = await supabaseAdmin.from("trainer_profiles").select("is_verified, badge_source").eq("user_id", params.id).single();
      result.is_verified = after?.is_verified;
      result.badge_source = after?.badge_source;
    }

    // ---- bosh sahifa "Top trenerlar"
    if (body.featured !== undefined) {
      if (!["add", "remove", "blurb"].includes(body.featured)) {
        return NextResponse.json({ message: "Noto'g'ri amal" }, { status: 400 });
      }
      const blurb = typeof body.featured_blurb === "string" ? body.featured_blurb : null;
      const { data, error } = await supabaseAdmin.rpc("set_featured_trainer", { p_admin: admin.id, p_trainer: params.id, p_action: body.featured, p_blurb: blurb });
      if (error) {
        const key = Object.keys(FEATURED_ERRORS).find((k) => String(error.message || "").includes(k));
        if (key) return NextResponse.json({ message: FEATURED_ERRORS[key][1] }, { status: FEATURED_ERRORS[key][0] });
        throw error;
      }
      await logAdmin(admin.id, `featured_${body.featured}`, "trainer", params.id, {});
      const { data: after } = await supabaseAdmin.from("trainer_profiles").select("is_featured_home, featured_order, featured_blurb").eq("user_id", params.id).single();
      result.is_featured_home = after?.is_featured_home;
      result.featured_order = after?.featured_order;
      result.featured_blurb = after?.featured_blurb;
    }

    if (Object.keys(result).length === 0) return NextResponse.json({ message: "O'zgartirish yo'q" }, { status: 400 });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Admin trainer update:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
