import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fail, json, readProgramBody, requireUser } from "@/lib/workout-server";
import { WORKOUT_LIMITS } from "@/lib/workout";

// POST /api/workouts/programs — { name, days?: [{ name, exercises?: [{ exercise_id, target_sets? }] }] } → { program } (201)
// Programma kunlari va mashqlari bilan BITTA so'rovda, atomar yaratiladi (shablondan yaratish ham shu).
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  try {
    const r = readProgramBody(await request.json().catch(() => null));
    if ("message" in r) return json({ message: r.message }, 400);
    const { data: id, error } = await supabaseAdmin.rpc("workout_create_program", {
      p_user: auth.userId, p_name: r.value.name, p_days: r.value.days, p_max_programs: WORKOUT_LIMITS.programs, p_max_days: WORKOUT_LIMITS.daysPerProgram,
    });
    if (error) throw error;
    const { data: program, error: gErr } = await supabaseAdmin.rpc("workout_program_get", { p_user: auth.userId, p_id: id });
    if (gErr) throw gErr;
    return json({ program }, 201);
  } catch (e) {
    return fail("program POST", e);
  }
}
