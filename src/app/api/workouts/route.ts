import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { countAchievements, fail, json, loadOutcomes, requireUser, userToday } from "@/lib/workout-server";
import { isAchievement, weekStreak } from "@/lib/workout";

// GET /api/workouts?today=YYYY-MM-DD — Kundalik bosh sahifasi:
// { programs: Program[] (birinchisi — asosiy), recent: SessionSummary[≤5] (+achievements),
//   week: { start, today, days[7], sessions, prev_sessions, achievements, records, streak_weeks }, total_sessions }
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  try {
    const today = userToday(request);
    const { data, error } = await supabaseAdmin.rpc("workout_overview", { p_user: auth.userId, p_today: today });
    if (error) throw error;
    const d: any = data || {};
    const week = d.week || {};
    const recent: any[] = d.recent || [];
    const weekIds: string[] = week.session_ids || [];
    const outcomes = await loadOutcomes(auth.userId, Array.from(new Set([...weekIds, ...recent.map((s) => s.id)])));
    const weekOut = outcomes.filter((o) => weekIds.includes(o.session_id));
    const { session_ids: _ids, ...weekRest } = week;
    return json({
      programs: d.programs || [],
      recent: recent.map((s) => ({ ...s, achievements: outcomes.filter((o) => o.session_id === s.id && isAchievement(o)).length })),
      week: { ...weekRest, ...countAchievements(weekOut), streak_weeks: weekStreak(d.active_weeks || [], week.start || today) },
      total_sessions: Number(d.total_sessions) || 0,
    });
  } catch (e) {
    return fail("overview", e);
  }
}
