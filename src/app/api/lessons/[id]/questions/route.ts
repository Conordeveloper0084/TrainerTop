import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { UUID_RE } from "@/lib/db-errors";
import { QUESTION_MAX } from "@/lib/constants";
import { hasActivePurchase } from "@/lib/lesson-access";
import { runInBackground } from "@/lib/push";
import { notifyLessonQuestion } from "@/lib/push-notify";
import { mirrorLessonQuestion } from "@/lib/lesson-question-mirror";

// GET /api/lessons/[id]/questions
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data } = await supabaseAdmin
      .from("lesson_questions")
      .select("*, user:user_id(full_name, avatar_url)")
      .eq("lesson_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/lessons/[id]/questions — { question, video_title? }
// Auth: cookie (sayt) YOKI Authorization: Bearer (ilova) — boshqa endpointlardagidek `getApiUser`.
// Ban qilingan foydalanuvchi "kirmagan" hisoblanadi (401, getApiUser qoidasi).
// Yozishga FAQAT shu darslikning FAOL xaridori yoki treneri ruxsat; aks holda 403.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user } = await getApiUser(request);
    if (!user) return NextResponse.json({ message: "Login kerak" }, { status: 401 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Darslik topilmadi" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) return NextResponse.json({ message: "Savol yozing" }, { status: 400 });
    if (question.length > QUESTION_MAX) return NextResponse.json({ message: `Savol ${QUESTION_MAX} belgidan oshmasin` }, { status: 400 });
    // video_title — ixtiyoriy: berilsa "shu aniq video haqida savol", bo'lmasa umumiy darslik savoli.
    const videoTitleRaw = typeof body?.video_title === "string" ? body.video_title.trim() : "";
    const video_title = videoTitleRaw ? videoTitleRaw.slice(0, 200) : null;

    const { data: lesson } = await supabaseAdmin.from("lessons").select("id, title, trainer_id").eq("id", params.id).maybeSingle();
    if (!lesson) return NextResponse.json({ message: "Darslik topilmadi" }, { status: 404 });

    const isLessonTrainer = lesson.trainer_id === user.id;
    if (!isLessonTrainer && !(await hasActivePurchase(user.id, params.id))) {
      return NextResponse.json({ message: "Savol berish uchun darslikni sotib oling" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("lesson_questions")
      .insert({ lesson_id: params.id, user_id: user.id, question, video_title })
      .select("*, user:user_id(full_name, avatar_url)")
      .single();

    if (error) throw error;

    // Trenerga push (javobni kutdirmaydi; xato bo'lsa savol yuborilishiga ta'sir qilmaydi)
    if (!isLessonTrainer) {
      runInBackground(notifyLessonQuestion({ lessonId: params.id, lessonTitle: lesson.title, trainerId: lesson.trainer_id, askerId: user.id, question }));
    }
    // VIDEO bo'yicha savol — darslik guruhiga ham tushadi (xato bo'lsa ham savol yuborilishiga ta'sir qilmaydi)
    if (data.video_title) {
      runInBackground(mirrorLessonQuestion({ lessonId: params.id, senderId: user.id, questionId: data.id, videoTitle: data.video_title, text: question, kind: "question" }));
    }
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
