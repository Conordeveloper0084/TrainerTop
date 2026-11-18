import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL, fail, json, requireUser, sendChatText } from "@/lib/workout-server";
import { UUID_LIKE } from "@/lib/workout";

type Ctx = { params: { id: string } };

// GET /api/workouts/programs/{id}/shares — kimlar ko'ryapti: { shares: [{ id, created_at, viewer: { id, full_name, avatar_url } }] }
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return json({ message: "Programma topilmadi" }, 404);
  try {
    const { data, error } = await supabaseAdmin.rpc("workout_program_shares", { p_owner: auth.userId, p_program: params.id });
    if (error) throw error;
    return json({ shares: data || [] });
  } catch (e) {
    return fail("shares GET", e);
  }
}

// POST /api/workouts/programs/{id}/shares — { viewer_id } → hisobotni trenerga ulashadi va chatga havola yuboradi.
// Havola JONLI: trener har ochganda eng yangi natijalarni ko'radi. Faqat chatda gaplashgan odamga.
// → { share: { id, url }, created } (201 — yangi; 200 — avval ulashilgan, havola qayta yuborildi)
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireUser(request);
  if ("res" in auth) return auth.res;
  if (!UUID_LIKE.test(params.id)) return json({ message: "Programma topilmadi" }, 404);
  try {
    const body = await request.json().catch(() => null);
    if (typeof body?.viewer_id !== "string" || !UUID_LIKE.test(body.viewer_id)) return json({ message: "Trenerni tanlang" }, 400);
    const { data, error } = await supabaseAdmin.rpc("workout_share_program", { p_owner: auth.userId, p_program: params.id, p_viewer: body.viewer_id });
    if (error) throw error;
    const r: any = data;
    const [{ data: prog }, { data: me }] = await Promise.all([
      supabaseAdmin.from("workout_programs").select("name").eq("id", params.id).maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name").eq("id", auth.userId).maybeSingle(),
    ]);
    const url = `${SITE_URL}/workouts/shared/${r.share_id}`;
    const text = `📊 Mening progress hisobotim: "${(prog as any)?.name || "Programma"}"\nHar doim eng yangi natijalar shu yerda: ${url}`;
    await sendChatText(r.conversation_id, auth.userId, (me as any)?.full_name || "Foydalanuvchi", text);
    return json({ share: { id: r.share_id, url }, created: !!r.created }, r.created ? 201 : 200);
  } catch (e) {
    return fail("shares POST", e);
  }
}
