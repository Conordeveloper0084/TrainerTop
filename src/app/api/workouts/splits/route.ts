import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fail, json, readSplitBody, requireUser } from "@/lib/workout-server";
import { UUID_LIKE, WORKOUT_LIMITS } from "@/lib/workout";

// POST /api/workouts/splits — programmaga kun qo'shish: { program_id, name, exercises?: [{ exercise_id, target_sets? }] } → { split } (201)
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  try {
    const body = await request.json().catch(() => null);
    if (typeof body?.program_id !== "string" || !UUID_LIKE.test(body.program_id)) return json({ message: "Programma topilmadi" }, 404);
    const r = readSplitBody(body, false);
    if ("message" in r) return json({ message: r.message }, 400);
    const { data: id, error } = await supabaseAdmin.rpc("workout_save_split", {
      p_user: auth.userId, p_split: null, p_program: body.program_id, p_name: r.value.name, p_items: r.value.items ?? [], p_max_days: WORKOUT_LIMITS.daysPerProgram,
    });
    if (error) throw error;
    const { data: split, error: gErr } = await supabaseAdmin.rpc("workout_split_get", { p_user: auth.userId, p_id: id });
    if (gErr) throw gErr;
    return json({ split }, 201);
  } catch (e) {
    return fail("split POST", e);
  }
}
