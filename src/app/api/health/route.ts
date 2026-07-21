import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/health — Supabase'ni tirik saqlash uchun
// Cron job har 5 kunda shu endpoint'ga so'rov yuboradi
export async function GET() {
  try {
    // Database'ga oddiy so'rov — Supabase "active" deb hisoblaydi
    const { count, error } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      users: count || 0,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: error.message,
    }, { status: 500 });
  }
}
