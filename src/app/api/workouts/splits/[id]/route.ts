import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fail, json, readSplitBody, requireUser } from "@/lib/workout-server";
import { UUID_LIKE, WORKOUT_LIMITS } from "@/lib/workout";

// GET /api/workouts/splits/{id} → { split }
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return json({ message: "Kun topilmadi" }, 404);
  try {
    const { data, error } = await supabaseAdmin.rpc("workout_split_get", { p_user: auth.userId, p_id: params.id });
    if (error) throw error;
    if (!data) return json({ message: "Kun topilmadi" }, 404);
    return json({ split: data });
  } catch (e) {
    return fail("split GET", e);
  }
}

// PATCH /api/workouts/splits/{id} — { name?, exercises?: [{ exercise_id, target_sets }] } (to'liq yangi ro'yxat, tartibda) → { split }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return json({ message: "Kun topilmadi" }, 404);
  try {
    const body = await request.json().catch(() => null);
    const r = readSplitBody(body, true);
    if ("message" in r) return json({ message: r.message }, 400);
    const { error } = await supabaseAdmin.rpc("workout_save_split", {
      p_user: auth.userId, p_split: params.id, p_program: null, p_name: r.value.name ?? null, p_items: r.value.items ?? null, p_max_days: WORKOUT_LIMITS.daysPerProgram,
    });
    if (error) throw error;
    const { data: split, error: gErr } = await supabaseAdmin.rpc("workout_split_get", { p_user: auth.userId, p_id: params.id });
    if (gErr) throw gErr;
    return json({ split });
  } catch (e) {
    return fail("split PATCH", e);
  }
}

// DELETE /api/workouts/splits/{id} — kun o'chadi, o'tgan mashg'ulotlar tarixda qoladi → { ok: true }
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return json({ message: "Kun topilmadi" }, 404);
  try {
    const { data, error } = await supabaseAdmin.from("workout_splits").delete().eq("id", params.id).eq("user_id", auth.userId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) return json({ message: "Kun topilmadi" }, 404);
    return json({ ok: true });
  } catch (e) {
    return fail("split DELETE", e);
  }
}
