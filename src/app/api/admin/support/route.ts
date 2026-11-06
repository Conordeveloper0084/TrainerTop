import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { tgToken } from "@/lib/telegram";

const PAGE = 50;

// Support bot (Telegram) murojaatlari — bot jadvallari (tg_*) shu bazada. Jadval yo'q/xato bo'lsa jimgina o'tkazib yuboriladi.
async function telegramTickets(status: string, q: string, limit: number): Promise<{ items: any[]; available: boolean }> {
  if (status === "closed") return { items: [], available: true };
  try {
    let query = supabaseAdmin.from("tg_tickets")
      .select("id, status, created_at, last_user_message_at, answered_at, assigned_admin, user:user_id (telegram_id, first_name, username)")
      .order("last_user_message_at", { ascending: false }).limit(limit);
    if (status === "new") query = query.in("status", ["new", "in_progress"]);
    else if (status === "answered") query = query.eq("status", "answered");
    const { data, error } = await query;
    if (error) return { items: [], available: false };
    let rows: any[] = data || [];
    if (q) { const n = q.toLowerCase(); rows = rows.filter((t) => `${t.user?.first_name || ""} ${t.user?.username || ""}`.toLowerCase().includes(n)); }
    const ids = rows.map((t) => t.id);
    const last = new Map<number, any>();
    if (ids.length) {
      const { data: msgs } = await supabaseAdmin.from("tg_messages").select("ticket_id, sender, text, media_type, created_at").in("ticket_id", ids).order("created_at", { ascending: false });
      for (const m of msgs || []) if (!last.has(m.ticket_id)) last.set(m.ticket_id, m);
    }
    const items = rows.map((t) => {
      const lm = last.get(t.id);
      const at = [t.last_user_message_at, t.answered_at].filter(Boolean).sort().pop() || t.created_at;
      return {
        id: `tg-${t.id}`, source: "telegram", user_id: null, name: t.user?.first_name || "Telegram foydalanuvchi",
        email: t.user?.username ? `@${t.user.username}` : null, subject: null,
        status: t.status === "in_progress" ? "new" : t.status, in_progress: t.status === "in_progress",
        created_at: t.created_at, last_message_at: at, answered_at: t.answered_at,
        last_message: lm ? { sender: lm.sender, body: String(lm.text || (lm.media_type ? `[${lm.media_type}]` : "")).slice(0, 140) } : null,
      };
    });
    return { items, available: true };
  } catch { return { items: [], available: false }; }
}
async function telegramCounts(): Promise<{ new: number; answered: number }> {
  try {
    const c = async (statuses: string[]) => (await supabaseAdmin.from("tg_tickets").select("id", { count: "exact", head: true }).in("status", statuses)).count || 0;
    const [n, a] = await Promise.all([c(["new", "in_progress"]), c(["answered"])]);
    return { new: n, answered: a };
  } catch { return { new: 0, answered: 0 }; }
}

// GET /api/admin/support?status=new|answered|closed|all&q=&page=0 — murojaatlar ro'yxati + holatlar soni
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });

    const sp = new URL(request.url).searchParams;
    const status = sp.get("status") || "new";
    const source = ["web", "telegram"].includes(sp.get("source") || "") ? (sp.get("source") as string) : "all";
    const q = (sp.get("q") || "").trim().replace(/[%,()]/g, " ").slice(0, 60);
    const page = Math.max(0, parseInt(sp.get("page") || "0", 10) || 0);

    let query = supabaseAdmin.from("web_support_tickets")
      .select("id, user_id, name, email, subject, status, source, created_at, last_message_at, answered_at")
      .order("last_message_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (["new", "answered", "closed"].includes(status)) query = query.eq("status", status);
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,subject.ilike.%${q}%`);
    const { data: tickets, error } = await query;
    if (error) throw error;

    const ids = (tickets || []).map((t: any) => t.id);
    const last = new Map<string, any>();
    if (ids.length) {
      const { data: msgs } = await supabaseAdmin.from("web_support_messages").select("ticket_id, sender, body, created_at").in("ticket_id", ids).order("created_at", { ascending: false });
      for (const m of msgs || []) if (!last.has(m.ticket_id)) last.set(m.ticket_id, m);
    }
    const count = async (s: string) => (await supabaseAdmin.from("web_support_tickets").select("id", { count: "exact", head: true }).eq("status", s)).count || 0;
    const [cNew, cAnswered, cClosed] = await Promise.all([count("new"), count("answered"), count("closed")]);
    const tgc = source === "web" ? { new: 0, answered: 0 } : await telegramCounts();
    const tg = source === "web" ? { items: [], available: true } : await telegramTickets(status, q, PAGE);

    const web = source === "telegram" ? [] : (tickets || []).map((t: any) => ({ ...t, source: "web", last_message: last.get(t.id) ? { sender: last.get(t.id).sender, body: String(last.get(t.id).body).slice(0, 140) } : null }));
    const merged = [...web, ...tg.items].sort((a: any, b: any) => String(b.last_message_at).localeCompare(String(a.last_message_at))).slice(0, PAGE);

    return NextResponse.json({
      tickets: merged,
      counts: { new: (source === "telegram" ? 0 : cNew) + tgc.new, answered: (source === "telegram" ? 0 : cAnswered) + tgc.answered, closed: source === "telegram" ? 0 : cClosed },
      has_more: (tickets || []).length === PAGE,
      telegram: { available: tg.available, can_reply: !!tgToken() },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Admin support GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
