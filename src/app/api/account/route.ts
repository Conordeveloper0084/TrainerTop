import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { invalidateBanCache } from "@/lib/bans";

const DELETED_NAME = "O'chirilgan foydalanuvchi";

// DELETE /api/account — o'z-o'zidan hisobni o'chirish (Play Market talab qiladi).
//   * Trener bo'lsa: balans > 0 yoki kutilayotgan pul yechish so'rovi bo'lsa rad etiladi
//     (avval Conor pulni qo'lda o'tkazishi kerak — aks holda kimga to'lashini bilmay qoladi).
//   * Xaridlar/sharhlar/postlar tarixi SAQLANIB QOLADI (faqat anonimlashtiriladi) — moliyaviy
//     hisobot va boshqa foydalanuvchilarning xarid tarixi buzilmasligi uchun. Shu sababli profil
//     jadvalidan QATORNI O'CHIRMAYMIZ (CASCADE orqali hammasini yo'q qilib yuborardi), faqat
//     shaxsni aniqlaydigan maydonlarni tozalaymiz.
//   * Supabase Auth hisobini SO'ZMA-SO'Z o'chirib tashlamaymiz — chunki profiles.id ON DELETE
//     CASCADE bilan auth.users'ga bog'langan, uni o'chirish yuqoridagi butun tarixni ham yo'qotib
//     yuborardi. Buning o'rniga DOIMIY ban qo'yamiz — bu allaqachon ishlatiladigan mexanizm orqali
//     hisobni butunlay ishlatib bo'lmaydigan qiladi (getApiUser har so'rovda tekshiradi).
export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const { data: tp } = await supabaseAdmin.from("trainer_profiles").select("balance").eq("user_id", user.id).maybeSingle();
    if (tp) {
      if ((tp.balance || 0) > 0) return NextResponse.json({ message: "Avval balansingizni yechib oling, keyin hisobni o'chirishingiz mumkin" }, { status: 400 });
      const { count } = await supabaseAdmin.from("payouts").select("id", { count: "exact", head: true }).eq("trainer_id", user.id).eq("status", "pending");
      if ((count || 0) > 0) return NextResponse.json({ message: "Kutilayotgan pul yechish so'rovingiz bor. Avval u yakunlanishini kuting" }, { status: 400 });
    }

    await supabaseAdmin.from("profiles").update({ full_name: DELETED_NAME, avatar_url: null, phone: null }).eq("id", user.id);
    if (tp) {
      // Darsliklarni "draft" qilamiz — xarid qilganlar kirishda davom etadi (is_purchased orqali
      // tekshiriladi, lesson.status'ga bog'liq emas), faqat yangi xaridorlarga ko'rinmay qoladi.
      await Promise.all([
        supabaseAdmin.from("trainer_profiles").update({ bio: null, gym_name: null, gym_address: null, gym_photos: [], is_published: false }).eq("user_id", user.id),
        supabaseAdmin.from("lessons").update({ status: "draft" }).eq("trainer_id", user.id),
        supabaseAdmin.from("trainer_payout_cards").delete().eq("trainer_id", user.id),
      ]);
    } else {
      await supabaseAdmin.from("user_profiles").update({ age: null, gender: null, goal: null, interests: [] }).eq("user_id", user.id);
    }

    // Push tokenlari ham tozalanadi — o'chirilgan hisobga bildirishnoma ketmasin
    await supabaseAdmin.from("device_tokens").delete().eq("user_id", user.id);

    await supabaseAdmin.from("user_bans").insert({ user_id: user.id, reason: "Foydalanuvchi o'z hisobini o'chirdi", banned_by: user.id, expires_at: null });
    invalidateBanCache();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Account DELETE:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
