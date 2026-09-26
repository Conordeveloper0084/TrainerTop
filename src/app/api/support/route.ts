import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { SUPPORT_LIMITS, validateSupportInput, hashIp, clientIp } from "@/lib/support";

// POST /api/support — saytdagi "Yordam" formasi. Login shart emas (mehmon ham yozadi).
// Murojaat bazaga yoziladi va admin panelidagi "Murojaatlar" bo'limida ko'rinadi.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const v = validateSupportInput(body);
    if (v.ok === false) {
      if (v.spam) return NextResponse.json({ success: true });   // bot: hech narsa saqlamaymiz, lekin bildirmaymiz ham
      return NextResponse.json({ message: v.message }, { status: 400 });
    }
    const { name, email, subject, message } = v.value;

    // Kirgan foydalanuvchi bo'lsa murojaat unga bog'lanadi (javob qo'ng'iroqchaga ham boradi)
    let userId: string | null = null;
    try { userId = (await getApiUser(request)).user?.id ?? null; } catch { userId = null; }

    // Spamdan himoya: bir emaildan soatiga 3 ta, bir IP dan soatiga 5 ta
    const ip = clientIp(request);
    const ipHash = ip ? hashIp(ip) : null;
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const [byEmail, byIp] = await Promise.all([
      supabaseAdmin.from("web_support_tickets").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since),
      ipHash ? supabaseAdmin.from("web_support_tickets").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since) : Promise.resolve({ count: 0 }),
    ]);
    if ((byEmail.count || 0) >= SUPPORT_LIMITS.PER_EMAIL_HOUR || (byIp.count || 0) >= SUPPORT_LIMITS.PER_IP_HOUR) {
      return NextResponse.json({ message: "Juda ko'p murojaat yuborildi. Iltimos, bir ozdan keyin urinib ko'ring" }, { status: 429 });
    }

    const { data: ticket, error } = await supabaseAdmin
      .from("web_support_tickets")
      .insert({ user_id: userId, name, email, subject, ip_hash: ipHash, source: "web" })
      .select("id").single();
    if (error || !ticket) throw error || new Error("ticket yaratilmadi");

    const { error: mErr } = await supabaseAdmin.from("web_support_messages").insert({ ticket_id: ticket.id, sender: "user", body: message });
    if (mErr) {
      await supabaseAdmin.from("web_support_tickets").delete().eq("id", ticket.id);   // yarim murojaat qolmasin
      throw mErr;
    }
    return NextResponse.json({ success: true, id: ticket.id });
  } catch (error: any) {
    console.error("Support POST:", error);
    return NextResponse.json({ message: "Xabarni yuborib bo'lmadi. Keyinroq urinib ko'ring yoki Telegram botga yozing" }, { status: 500 });
  }
}
