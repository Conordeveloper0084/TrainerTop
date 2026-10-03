import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { becomeTrainer } from "@/lib/auth-server";
import { getBannedUserIds } from "@/lib/bans";
import { sanitizeSearch } from "@/lib/search";
import { logAdmin } from "@/lib/audit";
import { UUID_RE } from "@/lib/db-errors";

// GET /api/admin/users?role=&status=banned&search= — foydalanuvchilar (ban ma'lumoti bilan)
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const sp = new URL(request.url).searchParams;
    const role = sp.get("role") || "";
    const search = sanitizeSearch(sp.get("search"));
    const onlyBanned = sp.get("status") === "banned";

    let query = supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false });
    if (["user", "trainer", "admin"].includes(role)) query = query.eq("role", role);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    if (onlyBanned) {
      const ids = await getBannedUserIds();
      if (ids.length === 0) return NextResponse.json([]);
      query = query.in("id", ids);
    }

    const { data, error } = await query.limit(200);
    if (error) throw error;
    const users = data || [];

    // Amaldagi banlar (sabab va muddat bilan)
    const bans = new Map<string, { reason: string; expires_at: string | null; banned_at: string }>();
    if (users.length > 0) {
      const { data: rows } = await supabaseAdmin
        .from("user_bans")
        .select("user_id, reason, expires_at, banned_at")
        .in("user_id", users.map((u: any) => u.id))
        .is("revoked_at", null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      for (const b of rows || []) bans.set(b.user_id, { reason: b.reason, expires_at: b.expires_at, banned_at: b.banned_at });
    }

    return NextResponse.json(users.map((u: any) => ({ ...u, ban: bans.get(u.id) || null })));
  } catch (error: any) {
    console.error("Admin users GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// PUT /api/admin/users — rolni o'zgartirish
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const { user_id, role } = await request.json().catch(() => ({}));
    if (typeof user_id !== "string" || !UUID_RE.test(user_id) || !["user", "trainer", "admin"].includes(role)) {
      return NextResponse.json({ message: "Noto'g'ri ma'lumot" }, { status: 400 });
    }
    // O'z rolini o'zgartirib, panelga kirish huquqini yo'qotib qo'yishning oldini olamiz
    if (user_id === admin.id) return NextResponse.json({ message: "O'z rolingizni o'zgartira olmaysiz" }, { status: 400 });

    const { data: before } = await supabaseAdmin.from("profiles").select("role").eq("id", user_id).maybeSingle();
    if (!before) return NextResponse.json({ message: "Foydalanuvchi topilmadi" }, { status: 404 });

    if (role === "trainer") {
      // Trener qilinganda trener profili ham yaratiladi (aks holda profil bo'sh qoladi)
      if (before.role === "admin") {
        const { error } = await supabaseAdmin.from("profiles").update({ role: "trainer" }).eq("id", user_id);
        if (error) throw error;
        const { data: tp } = await supabaseAdmin.from("trainer_profiles").select("id").eq("user_id", user_id).maybeSingle();
        if (!tp) await supabaseAdmin.from("trainer_profiles").insert({ user_id });
      } else {
        await becomeTrainer(user_id);
      }
    } else {
      const { error } = await supabaseAdmin.from("profiles").update({ role }).eq("id", user_id);
      if (error) throw error;
    }

    await logAdmin(admin.id, "role_change", "user", user_id, { from: before.role, to: role });
    const { data } = await supabaseAdmin.from("profiles").select("*").eq("id", user_id).single();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Admin users PUT:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// DELETE /api/admin/users?user_id= — foydalanuvchini butunlay o'chirish
// Moliyaviy tarixi (xarid, pul yechish, daromad) bor foydalanuvchi o'chirilmaydi — uni BAN qiling.
export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const user_id = new URL(request.url).searchParams.get("user_id");
    if (!user_id || !UUID_RE.test(user_id)) return NextResponse.json({ message: "user_id kerak" }, { status: 400 });
    if (user_id === admin.id) return NextResponse.json({ message: "O'zingizni o'chira olmaysiz" }, { status: 400 });

    const { data: target } = await supabaseAdmin.from("profiles").select("role").eq("id", user_id).maybeSingle();
    if (!target) return NextResponse.json({ message: "Foydalanuvchi topilmadi" }, { status: 404 });
    if (target.role === "admin") return NextResponse.json({ message: "Adminni o'chirishdan oldin uning rolini o'zgartiring" }, { status: 400 });

    const counts = await Promise.all([
      supabaseAdmin.from("purchases").select("id", { count: "exact", head: true }).or(`user_id.eq.${user_id},trainer_id.eq.${user_id}`),
      supabaseAdmin.from("payouts").select("id", { count: "exact", head: true }).eq("trainer_id", user_id),
      supabaseAdmin.from("trainer_ledger").select("id", { count: "exact", head: true }).eq("trainer_id", user_id),
    ]);
    if (counts.some((c) => (c.count || 0) > 0)) {
      return NextResponse.json(
        { message: "Moliyaviy tarixi bor foydalanuvchini o'chirib bo'lmaydi (hisob-kitob saqlanishi kerak). Uni ban qiling." },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (error) throw error;
    await logAdmin(admin.id, "user_delete", "user", user_id, {});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Admin users DELETE:", error);
    return NextResponse.json({ message: "O'chirib bo'lmadi. Ban qilishni sinab ko'ring" }, { status: 500 });
  }
}
