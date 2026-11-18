import { NextRequest } from "next/server";
import { fail, json, loadPrevious, requireUser } from "@/lib/workout-server";
import { UUID_LIKE, WORKOUT_LIMITS, isValidDate } from "@/lib/workout";

// GET /api/workouts/previous?exercise_ids=a,b,c&exclude=<session_id>&before=YYYY-MM-DD
// → { previous: { [exercise_id]: { session_id, performed_on, sets: [{weight_kg, reps}] } }, bests: { [exercise_id]: { max_weight, max_e1rm, max_reps, sessions_count } } }
// exclude — tahrirlanayotgan mashg'ulot (o'zi bilan o'zini taqqoslamaslik uchun); before — shu sanagacha (eski mashg'ulotni tahrirlaganda)
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  const sp = new URL(request.url).searchParams;
  const ids = Array.from(new Set((sp.get("exercise_ids") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)));
  if (ids.length > WORKOUT_LIMITS.sessionExercises || ids.some((x) => !UUID_LIKE.test(x))) return json({ message: "Mashqlar ro'yxati noto'g'ri" }, 400);
  const ex = sp.get("exclude");
  if (ex && !UUID_LIKE.test(ex)) return json({ message: "Mashg'ulot id noto'g'ri" }, 400);
  const before = sp.get("before");
  if (before && !isValidDate(before)) return json({ message: "Sana noto'g'ri" }, 400);
  try {
    return json(await loadPrevious(auth.userId, ids, ex || null, before || null));
  } catch (e) {
    return fail("previous", e);
  }
}
