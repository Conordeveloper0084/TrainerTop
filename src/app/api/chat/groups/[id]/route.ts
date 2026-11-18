import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { getGroupAccess, getMemberMod, isCurrentlyMuted } from "@/lib/chat";
import { keyFromPublicUrl, keyBelongsToUser } from "@/lib/media";
import { GROUP_NAME_MAX, GROUP_BIO_MAX } from "@/lib/constants";

// GET /api/chat/groups/[id] — guruh haqida (a'zo bo'lmaganga 404: guruh mavjudligi ham sir)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });

    const access = await getGroupAccess(params.id, user.id);
    if (access === "none") return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });

    const { data: g } = await supabaseAdmin
      .from("chat_groups")
      .select("id, lesson_id, owner_id, name, bio, avatar_url, created_at, lesson:lesson_id (id, title, price_monthly, pricing_model), owner:owner_id (id, full_name, avatar_url)")
      .eq("id", params.id).maybeSingle();
    if (!g) return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });

    const [{ count }, { data: me }] = await Promise.all([
      supabaseAdmin.from("chat_group_members").select("user_id", { count: "exact", head: true }).eq("group_id", params.id).eq("status", "active"),
      supabaseAdmin.from("chat_group_members").select("seen_intro_at").eq("group_id", params.id).eq("user_id", user.id).maybeSingle(),
    ]);

    // Chiqarilgan a'zo sababni ko'radi; cheklangan (mute) a'zo muddat va sababni ko'radi
    const mod = access === "removed" || access === "active" ? await getMemberMod(params.id, user.id) : null;
    const muted = access === "active" && !!mod && isCurrentlyMuted(mod.muted_until);
    return NextResponse.json({
      ...g,
      access,
      role: access === "owner" ? "owner" : "member",
      member_count: count || 0,
      seen_intro: !!me?.seen_intro_at,
      muted_until: muted ? mod!.muted_until : null,
      mod: access === "removed" && mod ? { reason: mod.mod_reason, note: mod.mod_note, by_admin: mod.mod_by_admin, at: mod.mod_at } : muted && mod ? { reason: mod.mod_reason, note: mod.mod_note, by_admin: mod.mod_by_admin, at: mod.mod_at } : null,
    });
  } catch (error: any) {
    console.error("Group GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// PATCH /api/chat/groups/[id] — faqat guruh admini (darslik egasi): nom, bio, rasm
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    if ((await getGroupAccess(params.id, user.id)) !== "owner") {
      return NextResponse.json({ message: "Faqat guruh admini o'zgartira oladi" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, any> = {};

    if ("name" in body) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > GROUP_NAME_MAX) return NextResponse.json({ message: `Guruh nomi 1–${GROUP_NAME_MAX} belgi bo'lishi kerak` }, { status: 400 });
      updates.name = name;
    }
    if ("bio" in body) {
      const bio = typeof body.bio === "string" ? body.bio.trim() : "";
      if (bio.length > GROUP_BIO_MAX) return NextResponse.json({ message: `Guruh haqida matn ${GROUP_BIO_MAX} belgidan oshmasligi kerak` }, { status: 400 });
      updates.bio = bio || null;
    }
    if ("avatar_url" in body) {
      if (body.avatar_url === null || body.avatar_url === "") updates.avatar_url = null;
      else {
        const key = keyFromPublicUrl(body.avatar_url);
        if (!key || !keyBelongsToUser(key, user.id) || !/^(avatars|chat)\//.test(key)) {
          return NextResponse.json({ message: "Rasm havolasi noto'g'ri. Rasmni qayta yuklang" }, { status: 400 });
        }
        updates.avatar_url = body.avatar_url;
      }
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ message: "O'zgartirish yo'q" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("chat_groups").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", params.id)
      .select("id, name, bio, avatar_url").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Group PATCH:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
