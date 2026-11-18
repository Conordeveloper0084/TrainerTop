import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fail, json, loadOutcomes, requireUser, userToday } from "@/lib/workout-server";
import { flattenSets, isAchievement, validateSessionInput } from "@/lib/workout";

// GET /api/workouts/sessions?limit=20&offset=0 — tarix (eng yangisi birinchi) → { sessions: SessionSummary[] (+achievements), has_more }
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  const sp = new URL(request.url).searchParams;
  const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10) || 20));
  const offset = Math.max(0, parseInt(sp.get("offset") || "0", 10) || 0);
  try {
    const { data, error } = await supabaseAdmin.rpc("workout_session_list", { p_user: auth.userId, p_limit: limit + 1, p_offset: offset });
    if (error) throw error;
    const list = ((data as any[]) || []).slice(0, limit + 1);
    const page = list.slice(0, limit);
    const outcomes = await loadOutcomes(auth.userId, page.map((s) => s.id));
    return json({
      sessions: page.map((s) => ({ ...s, achievements: outcomes.filter((o) => o.session_id === s.id && isAchievement(o)).length })),
      has_more: list.length > limit,
    });
  } catch (e) {
    return fail("sessions GET", e);
  }
}

// POST /api/workouts/sessions — mashg'ulotni saqlash (yaratish YOKI tahrirlash — id klientda yaratiladi, qayta yuborish xavfsiz):
// { id, split_id?, title?, performed_on: "YYYY-MM-DD", duration_sec?, note?, exercises: [{ exercise_id, sets: [{ weight_kg, reps }] }] }
// → { session: SessionDetail (har mashqda outcome), achievements: Outcome[] (faqat yutuqlar), prs: [...], created: boolean }  (201 — yangi, 200 — yangilandi)
// Yutuq: shu mashg'ulotdagi har mashq OLDINGI mashg'ulot bilan solishtiriladi (rekord / vazn oshdi / takror oshdi).
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  try {
    const body = await request.json().catch(() => null);
    const v = validateSessionInput(body, userToday(request));
    if ("message" in v) return json({ message: v.message }, 400);
    const s = v.value;

    // Sarlavha: split nomi (o'sha kundagi nusxa) → klient yuborgan sarlavha → "Mashg'ulot"
    let title = s.title;
    if (s.split_id) {
      const { data: split } = await supabaseAdmin.from("workout_splits").select("name").eq("id", s.split_id).eq("user_id", auth.userId).maybeSingle();
      if (split?.name) title = split.name;
    }
    const { data: created, error } = await supabaseAdmin.rpc("workout_save_session", {
      p_user: auth.userId, p_id: s.id, p_split: s.split_id, p_title: title || "Mashg'ulot", p_date: s.performed_on,
      p_duration: s.duration_sec, p_note: s.note, p_sets: flattenSets(s.exercises),
    });
    if (error) throw error;

    const [{ data: session, error: dErr }, outcomes] = await Promise.all([
      supabaseAdmin.rpc("workout_session_detail", { p_user: auth.userId, p_id: s.id }),
      loadOutcomes(auth.userId, [s.id]),
    ]);
    if (dErr) throw dErr;
    const sess: any = session;
    for (const ex of sess?.exercises || []) ex.outcome = outcomes.find((o) => o.exercise_id === ex.exercise.id) ?? null;
    const achievements = outcomes.filter(isAchievement).map(({ session_id: _s, ...o }) => o);
    // Eski mijozlar uchun (v50): faqat rekordlar
    const prs = achievements.filter((o) => o.type === "record").map((o) => ({ exercise_id: o.exercise_id, type: o.unit === "reps" ? "reps" : "weight", value: o.value, previous: o.previous }));
    return json({ session: sess, achievements, prs, created: created === true }, created === true ? 201 : 200);
  } catch (e) {
    return fail("sessions POST", e);
  }
}
