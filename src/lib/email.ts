// Oddiy email yuborish (Resend HTTP API). RESEND_API_KEY sozlanmagan bo'lsa — yuborilmaydi (xato tashlamaydi).
export async function sendEmail(opts: { to: string; subject: string; text: string }): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "RESEND_API_KEY sozlanmagan" };
  const from = process.env.SUPPORT_FROM_EMAIL || "TrainerTop Support <support@trainertop.uz>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, text: opts.text, reply_to: "support@trainertop.uz" }),
    });
    if (!res.ok) return { sent: false, reason: `Resend ${res.status}` };
    return { sent: true };
  } catch (e: any) {
    return { sent: false, reason: e?.message || "tarmoq xatosi" };
  }
}
