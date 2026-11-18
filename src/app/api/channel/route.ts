import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ChannelIdentity } from "@/lib/announcements";

const DEFAULT: ChannelIdentity = { name: "TrainerTop", avatar_url: null, bio: null, username: "TrainerTop", subscribers: 0 };

// GET /api/channel — OCHIQ: rasmiy kanal identifikatori (nom, rasm, bio, @username) + obunachilar soni
// (Telegram'dagi kabi — kanal hamma foydalanuvchining chat ro'yxatida avtomatik turadi, shuning uchun "obunachi" =
// platformadagi umumiy foydalanuvchilar soni). Chatda va h.k. ko'rsatish uchun.
// Kesh YO'Q: admin nom/rasmni o'zgartirgach, hamma darhol yangisini ko'rishi kerak (5 daqiqalik CDN keshi eski
// rasm/nomni qaytarib berib, "saqlanmayapti"дек ko'rinishga sabab bo'lgan edi).
export async function GET() {
  try {
    const [{ data, error }, { count }] = await Promise.all([
      supabaseAdmin.from("channel_settings").select("name, avatar_url, bio, username").eq("id", 1).maybeSingle(),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    if (error || !data) { console.error("Channel GET:", error); return NextResponse.json(DEFAULT); }
    return NextResponse.json(
      { name: data.name || DEFAULT.name, avatar_url: data.avatar_url ?? null, bio: data.bio ?? null, username: data.username ?? null, subscribers: count || 0 },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Channel GET:", error);
    return NextResponse.json(DEFAULT);
  }
}
