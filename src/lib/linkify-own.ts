// Chat matnidagi FAQAT o'z saytimiz havolalarini bosiladigan qilish (masalan, Kundalik hisoboti havolasi).
// Begona havolalar oddiy matn bo'lib qoladi — chatda firibgarlik (phishing) havolalari tarqalmasligi uchun.
const OWN_HOSTS = ["www.trainertop.uz", "trainertop.uz"];
const URL_RE = /https?:\/\/[^\s<>"']+/g;

export type Segment = { text: string; href?: string };

export function linkifyOwn(text: string, extraHost?: string): Segment[] {
  const hosts = extraHost ? [...OWN_HOSTS, extraHost.toLowerCase()] : OWN_HOSTS;
  const out: Segment[] = [];
  let last = 0;
  const re = new RegExp(URL_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0].replace(/[.,!?;:)]+$/, "");
    let href: string | null = null;
    try {
      const u = new URL(raw);
      if (hosts.includes(u.host.toLowerCase()) && (u.protocol === "https:" || u.host === extraHost)) href = `${u.pathname}${u.search}${u.hash}`;
    } catch { /* noto'g'ri URL — matn */ }
    if (!href) continue;
    const start = m.index;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: raw, href });
    last = start + raw.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text }];
}
