import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exerciseStats, fail, json, requireUser, toSets } from "@/lib/workout-server";
import { UUID_LIKE } from "@/lib/workout";

// GET /api/workouts/exercises/{id}/stats — bitta mashq bo'yicha progress:
// { exercise, pure_bodyweight, sessions_count, records{max_weight{value,reps,…}, max_reps{value,weight_kg,…}}, since_start, last_outcome, chart[], next_target, history[] }
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return json({ message: "Mashq topilmadi" }, 404);
  try {
    const { data, error } = await supabaseAdmin.rpc("workout_exercise_history", { p_user: auth.userId, p_exercise: params.id, p_limit: 200 });
    if (error) throw error;
    if (!data) return json({ message: "Mashq topilmadi" }, 404);
    const d: any = data;
    const history = (d.sessions || []).map((s: any) => ({ session_id: s.session_id, performed_on: s.performed_on, title: s.title, sets: toSets(s.sets) }));
    return json(exerciseStats(d.exercise, history));
  } catch (e) {
    return fail("exercise stats", e);
  }
}
