import { NextRequest } from "next/server";
import { buildProgramReport, fail, json, readPeriod, requireUser, userToday } from "@/lib/workout-server";
import { UUID_LIKE } from "@/lib/workout";

// GET /api/workouts/programs/{id}/report?period=4w|3m|all&today=YYYY-MM-DD — programma hisoboti (egasi uchun)
// → { program, period, summary{sessions, active_weeks, sets, achievements, records}, days[], exercises[], recent[] }
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return json({ message: "Programma topilmadi" }, 404);
  try {
    const report = await buildProgramReport(auth.userId, params.id, readPeriod(new URL(request.url).searchParams.get("period")), userToday(request));
    return report ? json(report) : json({ message: "Programma topilmadi" }, 404);
  } catch (e) {
    return fail("report", e);
  }
}
