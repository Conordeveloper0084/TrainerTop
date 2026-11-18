import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { EX_COLS, catalogByName, fail, json, readExerciseBody, requireUser, toExercise } from "@/lib/workout-server";
import { UUID_LIKE } from "@/lib/workout";

// PATCH /api/workouts/exercises/{id} — FAQAT o'z mashqini tahrirlash (katalog mashqlari o'zgarmaydi) → { exercise }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return json({ message: "Mashq topilmadi" }, 404);
  try {
    const body = await request.json().catch(() => null);
    const r = readExerciseBody(body, true);
    if ("message" in r) return json({ message: r.message }, 400);
    if (r.value.name && (await catalogByName(r.value.name))) return json({ message: "Bu nom ro'yxatdagi mashqqa tegishli — boshqa nom tanlang" }, 409);
    const { data, error } = await supabaseAdmin.from("exercises").update(r.value)
      .eq("id", params.id).eq("owner_id", auth.userId).is("archived_at", null).select(EX_COLS).maybeSingle();
    if (error) throw error;
    if (!data) return json({ message: "Mashq topilmadi" }, 404);
    return json({ exercise: toExercise(data) });
  } catch (e) {
    return fail("exercise PATCH", e);
  }
}

// DELETE /api/workouts/exercises/{id} — o'z mashqini o'chirish. Tarixda bo'lsa arxivlanadi (natijalar saqlanadi).
// → { result: "deleted" | "archived" }
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return json({ message: "Mashq topilmadi" }, 404);
  try {
    const { data, error } = await supabaseAdmin.rpc("workout_delete_exercise", { p_user: auth.userId, p_id: params.id });
    if (error) throw error;
    return json({ result: data });
  } catch (e) {
    return fail("exercise DELETE", e);
  }
}
