// Chat sahifasi chuqur havolalari (`/chat?...`). Tartib (birinchi mos kelgani): dm → trainer → group → lesson.
//   ?dm=<suhbat id>      — push `chat/<conversationId>` (1:1 suhbat)
//   ?trainer=<trener id> — trener bilan suhbatni ochadi/yaratadi
//   ?group=<guruh id>    — guruh
//   ?lesson=<darslik id> — shu darslikning guruhi (foydalanuvchi a'zo bo'lgan ro'yxatdan)
export type ChatDeepLink =
  | { type: "dm"; id: string }
  | { type: "trainer"; id: string }
  | { type: "group"; id: string }
  | null;

export function resolveChatDeepLink(
  sp: { get(key: string): string | null },
  groups: { id: string; lesson_id?: string | null }[],
): ChatDeepLink {
  const dm = sp.get("dm");
  if (dm) return { type: "dm", id: dm };
  const trainer = sp.get("trainer");
  if (trainer) return { type: "trainer", id: trainer };
  const group = sp.get("group");
  if (group) return { type: "group", id: group };
  const lesson = sp.get("lesson");
  if (lesson) {
    const g = groups.find((x) => x.lesson_id === lesson);
    if (g) return { type: "group", id: g.id };
  }
  return null;
}
