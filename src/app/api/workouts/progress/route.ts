import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fail, json, requireUser } from "@/lib/workout-server";

// GET /api/workouts/progress — bajarilgan har mashq: { exercises: [{ exercise, sessions_count, last_date, max_weight, max_e1rm, max_reps }] }
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  try {
    const { data, error } = await supabaseAdmin.rpc("workout_progress", { p_user: auth.userId });
    if (error) throw error;
    return json({ exercises: data || [] });
  } catch (e) {
    return fail("progress", e);
  }
}
