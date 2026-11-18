import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fail, json, requireUser } from "@/lib/workout-server";
import { UUID_LIKE } from "@/lib/workout";

// DELETE /api/workouts/shares/{id} — ulashishni to'xtatish (faqat egasi). Havola darhol ishlamay qoladi → { ok: true }
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return json({ message: "Topilmadi" }, 404);
  try {
    const { data, error } = await supabaseAdmin.from("workout_report_shares").update({ revoked_at: new Date().toISOString() })
      .eq("id", params.id).eq("owner_id", auth.userId).is("revoked_at", null).select("id");
    if (error) throw error;
    return data && data.length > 0 ? json({ ok: true }) : json({ message: "Topilmadi" }, 404);
  } catch (e) {
    return fail("share DELETE", e);
  }
}
