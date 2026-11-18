import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fail, json, loadOutcomes, requireUser } from "@/lib/workout-server";
import { UUID_LIKE } from "@/lib/workout";

// GET /api/workouts/sessions/{id} → { session: SessionDetail } — har mashqda outcome (oldingi mashg'ulotga nisbatan)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return json({ message: "Mashg'ulot topilmadi" }, 404);
  try {
    const { data, error } = await supabaseAdmin.rpc("workout_session_detail", { p_user: auth.userId, p_id: params.id.toLowerCase() });
    if (error) throw error;
    if (!data) return json({ message: "Mashg'ulot topilmadi" }, 404);
    const session: any = data;
    const outcomes = await loadOutcomes(auth.userId, [session.id]);
    for (const ex of session.exercises || []) ex.outcome = outcomes.find((o) => o.exercise_id === ex.exercise.id) ?? null;
    return json({ session });
  } catch (e) {
    return fail("session GET", e);
  }
}

// DELETE /api/workouts/sessions/{id} → { ok: true }
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return json({ message: "Mashg'ulot topilmadi" }, 404);
  try {
    const { data, error } = await supabaseAdmin.from("workout_sessions").delete().eq("id", params.id.toLowerCase()).eq("user_id", auth.userId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) return json({ message: "Mashg'ulot topilmadi" }, 404);
    return json({ ok: true });
  } catch (e) {
    return fail("session DELETE", e);
  }
}
