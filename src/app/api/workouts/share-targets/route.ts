import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fail, json, requireUser } from "@/lib/workout-server";

// GET /api/workouts/share-targets — hisobotni kimga yuborish mumkin: chatdagi trenerlar → { trainers: [{ id, full_name, avatar_url, conversation_id }] }
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  try {
    const { data, error } = await supabaseAdmin.rpc("workout_share_targets", { p_user: auth.userId });
    if (error) throw error;
    return json({ trainers: data || [] });
  } catch (e) {
    return fail("share-targets", e);
  }
}
