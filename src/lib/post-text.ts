// Post matnidagi #hashtag'larni ajratish. Android/iOS bilan BIR XIL qoida: # dan keyin harf (istalgan til, o'zbekcha ham), raqam yoki "_".
// Hozircha hashtag bosilmaydi — faqat rang bilan ajratiladi.
export const HASHTAG_SOURCE = "#[\\p{L}\\p{N}_]+";

export interface TextPart { text: string; tag: boolean }

export function splitHashtags(text: string | null | undefined): TextPart[] {
  if (!text) return [];
  const re = new RegExp(HASHTAG_SOURCE, "gu");
  const parts: TextPart[] = [];
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), tag: false });
    parts.push({ text: m[0], tag: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), tag: false });
  return parts;
}
