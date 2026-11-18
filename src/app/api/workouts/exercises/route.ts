import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { EX_COLS, catalogByName, fail, json, ownByName, readExerciseBody, requireUser, toExercise } from "@/lib/workout-server";
import { WORKOUT_LIMITS } from "@/lib/workout";

// GET /api/workouts/exercises — katalog + foydalanuvchining o'z mashqlari (arxivlanganlar yo'q). { exercises: Exercise[] }
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  try {
    const { data, error } = await supabaseAdmin.from("exercises").select(EX_COLS)
      .or(`owner_id.is.null,owner_id.eq.${auth.userId}`).is("archived_at", null).order("name");
    if (error) throw error;
    return json({ exercises: (data || []).map(toExercise) });
  } catch (e) {
    return fail("exercises GET", e);
  }
}

// POST /api/workouts/exercises — o'z mashqini yaratish: { name, muscle_group?, equipment?, is_bodyweight? } → { exercise } (201)
// Foydalanuvchi o'z so'zi bilan yozadi ("temirda anjimaniya"). Shu nomli o'z mashqi bo'lsa — o'sha qaytadi (200, dublikat yo'q).
// Katalogda aynan shu nom bo'lsa — 409 { message, exercise: katalogdagisi } (klient o'shani tanlaydi).
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  try {
    const body = await request.json().catch(() => null);
    const r = readExerciseBody(body, false);
    if ("message" in r) return json({ message: r.message }, 400);
    const own = await ownByName(auth.userId, r.value.name);
    if (own) return json({ exercise: toExercise(own) }, 200);
    const cat = await catalogByName(r.value.name);
    if (cat) return json({ message: "Bu mashq ro'yxatda bor", exercise: toExercise(cat) }, 409);
    const { count, error: cErr } = await supabaseAdmin.from("exercises").select("id", { count: "exact", head: true })
      .eq("owner_id", auth.userId).is("archived_at", null);
    if (cErr) throw cErr;
    if ((count || 0) >= WORKOUT_LIMITS.customExercises) return json({ message: `O'z mashqlaringiz soni chegarasiga yetdi (${WORKOUT_LIMITS.customExercises} ta)` }, 400);
    const { data, error } = await supabaseAdmin.from("exercises").insert({ ...r.value, owner_id: auth.userId }).select(EX_COLS).single();
    if (error) throw error;
    return json({ exercise: toExercise(data) }, 201);
  } catch (e) {
    return fail("exercises POST", e);
  }
}
