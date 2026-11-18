import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildProgramReport, fail, json, readPeriod, requireUser, userToday } from "@/lib/workout-server";
import { UUID_LIKE } from "@/lib/workout";

// GET /api/workouts/shared/{id}?period=4w|3m|all — ulashilgan hisobot (faqat tanlangan trener yoki egasi; to'xtatilgan bo'lsa — 404)
// → { owner: { id, full_name, avatar_url }, is_owner, ...hisobot }
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  const gone = () => json({ message: "Hisobot topilmadi yoki egasi ulashishni to'xtatgan" }, 404);
  if (!UUID_LIKE.test(params.id)) return gone();
  try {
    const { data, error } = await supabaseAdmin.rpc("workout_share_access", { p_user: auth.userId, p_share: params.id });
    if (error) throw error;
    const a: any = data;
    if (!a) return gone();
    const report = await buildProgramReport(a.owner_id, a.program_id, readPeriod(new URL(request.url).searchParams.get("period")), userToday(request));
    return report ? json({ owner: a.owner, is_owner: !!a.is_owner, ...report }) : gone();
  } catch (e) {
    return fail("shared", e);
  }
}
