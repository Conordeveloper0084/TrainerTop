import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fail, json, requireUser } from "@/lib/workout-server";
import { UUID_LIKE, WORKOUT_LIMITS, normalizeName } from "@/lib/workout";

type Ctx = { params: { id: string } };
const notFound = () => json({ message: "Programma topilmadi" }, 404);

// GET /api/workouts/programs/{id} → { program: { id, name, position, days: Split[], sessions_count, sessions_30d, last_performed_on, last_split_id } }
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return notFound();
  try {
    const { data, error } = await supabaseAdmin.rpc("workout_program_get", { p_user: auth.userId, p_id: params.id });
    if (error) throw error;
    return data ? json({ program: data }) : notFound();
  } catch (e) {
    return fail("program GET", e);
  }
}

// PATCH /api/workouts/programs/{id} — { name?, primary?: true } (primary — bosh sahifada birinchi bo'ladi) → { program }
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return notFound();
  try {
    const body = await request.json().catch(() => null);
    const patch: Record<string, any> = {};
    if (body?.name !== undefined) {
      const name = normalizeName(body.name, WORKOUT_LIMITS.programName);
      if (!name) return json({ message: `Programma nomini kiriting (${WORKOUT_LIMITS.programName} belgigacha)` }, 400);
      patch.name = name;
    }
    if (body?.primary === true) {
      const { data: all, error: aErr } = await supabaseAdmin.from("workout_programs").select("position").eq("user_id", auth.userId);
      if (aErr) throw aErr;
      patch.position = Math.min(0, ...((all || []) as any[]).map((p) => Number(p.position))) - 1;
    }
    if (Object.keys(patch).length === 0) return json({ message: "O'zgartirish yo'q" }, 400);
    const { data, error } = await supabaseAdmin.from("workout_programs").update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", params.id).eq("user_id", auth.userId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) return notFound();
    const { data: program, error: gErr } = await supabaseAdmin.rpc("workout_program_get", { p_user: auth.userId, p_id: params.id });
    if (gErr) throw gErr;
    return json({ program });
  } catch (e) {
    return fail("program PATCH", e);
  }
}

// DELETE /api/workouts/programs/{id} — programma va uning kunlari o'chadi; yozilgan mashg'ulotlar tarixda qoladi → { ok: true }
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return notFound();
  try {
    const { data, error } = await supabaseAdmin.from("workout_programs").delete().eq("id", params.id).eq("user_id", auth.userId).select("id");
    if (error) throw error;
    return data && data.length > 0 ? json({ ok: true }) : notFound();
  } catch (e) {
    return fail("program DELETE", e);
  }
}
