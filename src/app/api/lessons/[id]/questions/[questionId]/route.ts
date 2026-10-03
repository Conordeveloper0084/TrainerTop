import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { UUID_RE } from "@/lib/db-errors";
import { QUESTION_ANSWER_MAX } from "@/lib/constants";

// PATCH /api/lessons/[id]/questions/[questionId] — { answer } — FAQAT shu darslikning treneri javob yoza oladi
// (qayta yozib, javobni tahrirlash ham mumkin). Savol boshqa darslikka tegishli bo'lsa ham 404.
export async function PATCH(request: NextRequest, { params }: { params: { id: string; questionId: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    if (!UUID_RE.test(params.questionId)) return NextResponse.json({ message: "Savol topilmadi" }, { status: 404 });

    const raw = (await request.json().catch(() => ({})))?.answer;
    const answer = typeof raw === "string" ? raw.trim() : "";
    if (!answer) return NextResponse.json({ message: "Javob yozing" }, { status: 400 });
    if (answer.length > QUESTION_ANSWER_MAX) return NextResponse.json({ message: `Javob ${QUESTION_ANSWER_MAX} belgidan oshmasin` }, { status: 400 });

    const { data: q } = await supabaseAdmin.from("lesson_questions").select("id, lesson_id").eq("id", params.questionId).eq("lesson_id", params.id).maybeSingle();
    if (!q) return NextResponse.json({ message: "Savol topilmadi" }, { status: 404 });

    const { data: lesson } = await supabaseAdmin.from("lessons").select("trainer_id").eq("id", params.id).maybeSingle();
    if (!lesson) return NextResponse.json({ message: "Darslik topilmadi" }, { status: 404 });
    if (lesson.trainer_id !== user.id) return NextResponse.json({ message: "Faqat shu darslikning treneri javob bera oladi" }, { status: 403 });

    const { data, error } = await supabaseAdmin.from("lesson_questions")
      .update({ answer, answered_at: new Date().toISOString() }).eq("id", params.questionId)
      .select("*, user:user_id(full_name, avatar_url)").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Lesson question PATCH:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
