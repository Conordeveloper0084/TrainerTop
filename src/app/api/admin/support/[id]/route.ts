import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { logAdmin } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { SUPPORT_LIMITS } from "@/lib/support";
import { UUID_RE } from "@/lib/db-errors";

// GET /api/admin/support/[id] — murojaat va butun yozishma
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });

    const { data: ticket } = await supabaseAdmin.from("web_support_tickets")
      .select("*, user:user_id (id, full_name, avatar_url, role)").eq("id", params.id).maybeSingle();
    if (!ticket) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    const { data: messages } = await supabaseAdmin.from("web_support_messages").select("*").eq("ticket_id", params.id).order("created_at", { ascending: true });
    const { ip_hash: _ip, ...safe } = ticket as any;
    return NextResponse.json({ ...safe, messages: messages || [], can_email: !!process.env.RESEND_API_KEY });
  } catch (error: any) {
    console.error("Admin support ticket GET:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// POST /api/admin/support/[id] — javob yozish. Yetkazish: kirgan foydalanuvchiga qo'ng'iroqcha, emailga (Resend bo'lsa).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });

    const { body: raw } = await request.json().catch(() => ({}));
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) return NextResponse.json({ message: "Javob matnini yozing" }, { status: 400 });
    if (text.length > SUPPORT_LIMITS.REPLY_MAX) return NextResponse.json({ message: `Javob juda uzun (maksimum ${SUPPORT_LIMITS.REPLY_MAX} belgi)` }, { status: 400 });

    const { data: ticket } = await supabaseAdmin.from("web_support_tickets").select("id, user_id, email, name, subject, status").eq("id", params.id).maybeSingle();
    if (!ticket) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    if (ticket.status === "closed") return NextResponse.json({ message: "Murojaat yopilgan. Avval qayta oching" }, { status: 400 });

    const { data: msg, error } = await supabaseAdmin.from("web_support_messages")
      .insert({ ticket_id: ticket.id, sender: "admin", admin_id: admin.id, body: text }).select("*").single();
    if (error || !msg) throw error || new Error("javob yozilmadi");

    // Yetkazish (xato bo'lsa ham javob saqlangan — admin holatni ko'radi)
    let viaNotification = false, viaEmail = false, emailReason: string | undefined;
    if (ticket.user_id) {
      const { error: nErr } = await supabaseAdmin.from("notifications").insert({
        user_id: ticket.user_id, type: "support", title: "Support javobi", body: text.slice(0, 200), data: { ticket_id: ticket.id },
      });
      viaNotification = !nErr;
    }
    const mail = await sendEmail({
      to: ticket.email,
      subject: `Re: ${ticket.subject || "TrainerTop murojaatingiz"}`,
      text: `Salom, ${ticket.name}!\n\n${text}\n\n—\nTrainerTop support\nYana savol bo'lsa: support@trainertop.uz yoki Telegram: @TrainerTop_Support_Bot`,
    });
    viaEmail = mail.sent; emailReason = mail.reason;
    const delivered = viaNotification && viaEmail ? "both" : viaNotification ? "notification" : viaEmail ? "email" : "none";
    await supabaseAdmin.from("web_support_messages").update({ delivered }).eq("id", msg.id);
    await logAdmin(admin.id, "support_reply", "support_ticket", ticket.id, { delivered });

    return NextResponse.json({ ...msg, delivered, email_reason: viaEmail ? undefined : emailReason });
  } catch (error: any) {
    console.error("Admin support reply:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}

// PATCH /api/admin/support/[id] — { status: "closed" | "new" }
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ message: "Ruxsat yo'q" }, { status: 403 });
    if (!UUID_RE.test(params.id)) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    const { status } = await request.json().catch(() => ({}));
    if (status !== "closed" && status !== "new") return NextResponse.json({ message: "Noto'g'ri holat" }, { status: 400 });
    const updates = status === "closed" ? { status, closed_at: new Date().toISOString() } : { status, closed_at: null };
    const { data, error } = await supabaseAdmin.from("web_support_tickets").update(updates).eq("id", params.id).select("id, status").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "Topilmadi" }, { status: 404 });
    await logAdmin(admin.id, status === "closed" ? "support_close" : "support_reopen", "support_ticket", params.id, {});
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Admin support PATCH:", error);
    return NextResponse.json({ message: "Server xatolik" }, { status: 500 });
  }
}
