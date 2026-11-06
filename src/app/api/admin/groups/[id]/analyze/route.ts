import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { buildTranscript, runAnalysis, MIN_ANALYSIS_MESSAGES } from "@/lib/group-analysis";
import { UUID_RE } from "@/lib/db-errors";

const CACHE_MS = 60 * 60 * 1000;     // 1 soat ichida qayta so'ralsa — saqlangan natija (pul sarflanmaydi)
const FORCE_GAP_MS = 5 * 60 * 1000;  // majburiy yangilash: kamida 5 daqiqa oralig'ida

// POST /api/admin/groups/[id]/analyze  { force?: boolean } — oxirgi ~100 ta xabarning AI tahlili
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });
    const { force } = await request.json().catch(() => ({}));

    const { data: g } = await supabaseAdmin.from("chat_groups").select("id, name, owner_id, lesson:lesson_id (title)").eq("id", params.id).maybeSingle();
    if (!g) return NextResponse.json({ message: "Guruh topilmadi" }, { status: 404 });

    const { data: last } = await supabaseAdmin.from("chat_group_analyses").select("result, message_count, created_at")
      .eq("group_id", params.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last) {
      const age = Date.now() - new Date(last.created_at).getTime();
      if (age < CACHE_MS && !(force === true && age >= FORCE_GAP_MS)) return NextResponse.json({ ...last, cached: true });
    }

    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ message: "AI tahlil sozlanmagan (OPENAI_API_KEY yo'q)" }, { status: 503 });

    const { data: rows } = await supabaseAdmin.from("messages").select("sender_id, content, type, created_at")
      .eq("group_id", params.id).is("deleted_at", null).not("content", "is", null).order("created_at", { ascending: false }).limit(100);
    const t = buildTranscript(((rows || []) as any[]).reverse(), (g as any).owner_id);
    if (t.count < MIN_ANALYSIS_MESSAGES) return NextResponse.json({ message: `Tahlil uchun kamida ${MIN_ANALYSIS_MESSAGES} ta matnli xabar kerak (hozir ${t.count})` }, { status: 400 });

    let result;
    try { result = await runAnalysis({ groupName: (g as any).name, lessonTitle: (g as any).lesson?.title || "", transcript: t.text }); }
    catch (e: any) { console.error("AI analysis:", e); return NextResponse.json({ message: "AI tahlil vaqtincha ishlamadi. Keyinroq urinib ko'ring" }, { status: 502 }); }

    const { data: saved, error } = await supabaseAdmin.from("chat_group_analyses")
      .insert({ group_id: params.id, result, message_count: t.count, created_by: admin.id }).select("result, message_count, created_at").single();
    if (error) throw error;
    await logAdmin(admin.id, "group_analyze", "chat_group", params.id, { messages: t.count });
    return NextResponse.json({ ...saved, cached: false });
  } catch (error: any) {
    console.error("Admin group analyze:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
