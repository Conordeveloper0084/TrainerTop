// KUNDALIK — umumiy (klient + server) hisob-kitoblar va tekshiruvlar. Bu yerda DB yoki fetch yo'q — sof funksiyalar.
// Android/iOS ham AYNAN shu qoidalarni takrorlashi kerak (docs/workouts.md).

export type MuscleGroup = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "legs" | "glutes" | "core" | "other";
export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "other";

export interface WorkoutExercise {
  id: string; slug: string | null; name: string; name_uz: string | null; muscle_group: MuscleGroup; equipment: Equipment;
  is_bodyweight: boolean; is_custom: boolean; archived?: boolean; aliases?: string | null;
  target_sets?: number;   // faqat kun (split) ichida: shu mashq uchun nechta padxod ochiladi (1–10)
}
export interface WSet { weight_kg: number; reps: number }

export const MUSCLE_GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: "chest", label: "Ko'krak" }, { id: "back", label: "Orqa" }, { id: "shoulders", label: "Yelka" }, { id: "biceps", label: "Biseps" },
  { id: "triceps", label: "Triseps" }, { id: "legs", label: "Oyoq" }, { id: "glutes", label: "Dumba" }, { id: "core", label: "Qorin" },
  { id: "other", label: "Boshqa" },
];
export const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: "barbell", label: "Shtanga" }, { id: "dumbbell", label: "Gantel" }, { id: "machine", label: "Trenajyor" },
  { id: "cable", label: "Blok" }, { id: "bodyweight", label: "O'z vazni" }, { id: "other", label: "Boshqa" },
];
export const muscleLabel = (m: string) => MUSCLE_GROUPS.find((x) => x.id === m)?.label ?? m;
export const equipmentLabel = (e: string) => EQUIPMENT.find((x) => x.id === e)?.label ?? e;

export const WORKOUT_LIMITS = {
  programs: 10, programName: 40, daysPerProgram: 14, targetSetsMin: 1, targetSetsMax: 10, defaultSets: 3,
  splits: 20, splitName: 40, splitExercises: 30, customExercises: 200, exerciseName: 60,
  sessionExercises: 40, setsPerExercise: 20, setsTotal: 200, maxWeight: 1000, maxReps: 1000, note: 500, title: 60,
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

// Taxminiy 1RM (Epley): kg × (1 + takror/30). 1 takrorda — og'irlikning o'zi. Server (SQL) bilan bir xil formula.
export function e1rm(weight: number, reps: number): number {
  if (!(weight > 0) || !(reps > 0)) return 0;
  return round2(weight * (1 + reps / 30));
}
export const setsVolume = (sets: WSet[]) => round2(sets.reduce((s, x) => s + x.weight_kg * x.reps, 0));
export const totalReps = (sets: WSet[]) => sets.reduce((s, x) => s + x.reps, 0);

// Eng yaxshi padxod: og'irlikli mashqda — eng katta e1RM (teng bo'lsa og'irroq); o'z vazni bilan (qo'shimcha og'irliksiz) — eng ko'p takror
export function bestSet(sets: WSet[], bodyweight = false): WSet | null {
  if (sets.length === 0) return null;
  const score = (s: WSet) => (bodyweight && s.weight_kg === 0 ? s.reps : e1rm(s.weight_kg, s.reps));
  return sets.reduce((b, s) => (score(s) > score(b) || (score(s) === score(b) && s.weight_kg > b.weight_kg) ? s : b));
}

// Ko'rinish: "100 kg × 12 · 10 · 7" (og'irlik bir xil bo'lsa) yoki "100×12 · 90×10"; o'z vazni bilan: "12 · 10 · 8 takror"
export function formatKg(n: number): string {
  return String(round2(n)).replace(/\.0+$/, "");
}
export function formatSets(sets: WSet[], bodyweight = false): string {
  if (sets.length === 0) return "";
  if (bodyweight && sets.every((s) => s.weight_kg === 0)) return `${sets.map((s) => s.reps).join(" · ")} takror`;
  const same = sets.every((s) => s.weight_kg === sets[0].weight_kg);
  if (same) return `${formatKg(sets[0].weight_kg)} kg × ${sets.map((s) => s.reps).join(" · ")}`;
  return sets.map((s) => `${formatKg(s.weight_kg)}×${s.reps}`).join(" · ");
}
export function formatVolume(kg: number): string {
  const n = Math.round(kg);
  return `${n.toLocaleString("en-US").replace(/,/g, " ")} kg`;
}

// Keyingi safar uchun maqsad (progressive overload) — oddiy, tushunarli qoida:
//  • o'z vazni (qo'shimchasiz): eng kam takrorli padxodga +1 takror;
//  • hamma padxodlar 12+ takror bo'lsa — og'irlikni oshirish vaqti (+2.5 kg, gantel/trenajyorda ham shu qadam);
//  • aks holda: eng og'ir padxodlardan eng kam takrorlisiga +1 takror.
export interface NextTarget { kind: "reps" | "weight"; set_index: number; weight_kg: number; reps: number; text: string }
export function suggestNext(last: WSet[], bodyweight = false): NextTarget | null {
  if (last.length === 0) return null;
  if (bodyweight && last.every((s) => s.weight_kg === 0)) {
    const i = last.reduce((m, s, k) => (s.reps < last[m].reps ? k : m), 0);
    return { kind: "reps", set_index: i, weight_kg: 0, reps: last[i].reps + 1, text: `${i + 1}-padxodda ${last[i].reps + 1} ta qilib ko'ring` };
  }
  const top = Math.max(...last.map((s) => s.weight_kg));
  if (last.every((s) => s.reps >= 12)) {
    const w = round2(top + 2.5);
    return { kind: "weight", set_index: 0, weight_kg: w, reps: Math.min(...last.map((s) => s.reps)), text: `Og'irlikni oshirish vaqti: ${formatKg(w)} kg` };
  }
  let i = -1;
  last.forEach((s, k) => { if (s.weight_kg === top && (i < 0 || s.reps < last[i].reps)) i = k; });
  return { kind: "reps", set_index: i, weight_kg: top, reps: last[i].reps + 1, text: `${i + 1}-padxodda ${formatKg(top)} kg × ${last[i].reps + 1} qilib ko'ring` };
}

// PR (shaxsiy rekord) — FAQAT oldin shu mashq bajarilgan bo'lsa (birinchi marta — taqqoslash yo'q, kubok ham yo'q).
// Har mashqqa ko'pi bilan bitta belgi: og'irlik rekordi > 1RM rekordi > takror rekordi.
export interface PrevBest { max_weight: number; max_e1rm: number; max_reps: number; sessions_count: number }
export interface PR { exercise_id: string; type: "weight" | "e1rm" | "reps"; value: number; previous: number }
export function detectPR(exerciseId: string, sets: WSet[], prev: PrevBest | null | undefined, bodyweight = false): PR | null {
  if (!prev || !(prev.sessions_count > 0) || sets.length === 0) return null;
  const maxW = Math.max(...sets.map((s) => s.weight_kg));
  if (maxW > prev.max_weight && maxW > 0) return { exercise_id: exerciseId, type: "weight", value: maxW, previous: prev.max_weight };
  if (bodyweight && maxW === 0) {
    const maxR = Math.max(...sets.map((s) => s.reps));
    return maxR > prev.max_reps ? { exercise_id: exerciseId, type: "reps", value: maxR, previous: prev.max_reps } : null;
  }
  const best = Math.max(...sets.map((s) => e1rm(s.weight_kg, s.reps)));
  return best > prev.max_e1rm + 0.001 ? { exercise_id: exerciseId, type: "e1rm", value: best, previous: prev.max_e1rm } : null;
}
export function prText(pr: PR): string {
  if (pr.type === "weight") return `Og'irlik rekordi: ${formatKg(pr.value)} kg (oldin ${formatKg(pr.previous)} kg)`;
  if (pr.type === "reps") return `Takror rekordi: ${pr.value} ta (oldin ${pr.previous})`;
  return `Kuch rekordi (1RM): ${formatKg(pr.value)} kg (oldin ${formatKg(pr.previous)} kg)`;
}

// Oxirgi mashg'ulotni oldingisi bilan taqqoslash: kuch oshdimi?
export interface Comparison { e1rm_delta: number; volume_delta: number; reps_delta: number; weight_delta: number; verdict: "up" | "same" | "down" }
export function compareSessions(cur: WSet[], prev: WSet[], bodyweight = false): Comparison | null {
  if (cur.length === 0 || prev.length === 0) return null;
  const bw = bodyweight && cur.every((s) => s.weight_kg === 0) && prev.every((s) => s.weight_kg === 0);
  const best = (xs: WSet[]) => Math.max(...xs.map((s) => e1rm(s.weight_kg, s.reps)));
  const c = {
    e1rm_delta: round2(best(cur) - best(prev)),
    volume_delta: round2(setsVolume(cur) - setsVolume(prev)),
    reps_delta: totalReps(cur) - totalReps(prev),
    weight_delta: round2(Math.max(...cur.map((s) => s.weight_kg)) - Math.max(...prev.map((s) => s.weight_kg))),
  };
  const key = bw ? c.reps_delta : c.e1rm_delta !== 0 ? c.e1rm_delta : c.volume_delta;
  return { ...c, verdict: key > 0 ? "up" : key < 0 ? "down" : "same" };
}

// Ketma-ket faol haftalar (streak). activeWeeks — dushanba sanalari (YYYY-MM-DD), istalgan tartibda.
// Joriy haftada hali mashg'ulot bo'lmasa — streak uzilmagan (o'tgan haftadan sanaladi).
export function weekStreak(activeWeeks: string[], currentWeekStart: string): number {
  const set = new Set(activeWeeks);
  let d = currentWeekStart;
  if (!set.has(d)) d = addDays(d, -7);
  let n = 0;
  while (set.has(d)) { n++; d = addDays(d, -7); }
  return n;
}

// --- Sana yordamchilari (YYYY-MM-DD, UTC hisobida — vaqt zonasi siljishisiz) ---
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isValidDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function addDays(s: string, n: number): string {
  const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function weekStartOf(s: string): string {
  const dow = new Date(`${s}T00:00:00Z`).getUTCDay(); // 0 = yakshanba
  return addDays(s, -((dow + 6) % 7));
}
// Toshkent bo'yicha bugungi sana (server UTC'da ishlaydi; foydalanuvchilar asosan UTC+5)
export function tashkentToday(now = new Date()): string {
  return new Date(now.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
}
// Brauzer/telefonning mahalliy sanasi
export function localToday(now = new Date()): string {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0"), d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
export const WEEKDAYS_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
export function formatDateUz(s: string, today?: string): string {
  if (!isValidDate(s)) return "";
  if (today) {
    if (s === today) return "Bugun";
    if (s === addDays(today, -1)) return "Kecha";
  }
  const [y, m, d] = s.split("-").map(Number);
  const base = `${d}-${MONTHS[m - 1]}`;
  return today && today.slice(0, 4) === String(y) ? base : `${base} ${y}`;
}
export function daysAgo(s: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${s}T00:00:00Z`)) / 86400_000);
}
export function relativeDay(s: string | null | undefined, today: string): string {
  if (!s) return "hali bajarilmagan";
  const n = daysAgo(s, today);
  if (n <= 0) return "bugun";
  if (n === 1) return "kecha";
  if (n < 7) return `${n} kun oldin`;
  if (n < 30) return `${Math.floor(n / 7)} hafta oldin`;
  return formatDateUz(s, today);
}
export function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h} soat ${m} daq` : `${Math.max(1, m)} daq`;
}

// --- Kiritilgan ma'lumotni tekshirish (server ham, klient ham ishlatadi) ---
export const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseWeight(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".").trim()) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n < 0 || n > WORKOUT_LIMITS.maxWeight) return null;
  return round2(n);
}
export function parseReps(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.trim()) : typeof v === "number" ? v : NaN;
  if (!Number.isInteger(n) || n < 1 || n > WORKOUT_LIMITS.maxReps) return null;
  return n;
}

export interface SessionInput {
  id: string; split_id: string | null; title: string | null; performed_on: string; duration_sec: number | null; note: string | null;
  exercises: { exercise_id: string; sets: WSet[] }[];
}
export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

// Mashg'ulot (POST /api/workouts/sessions) tanasini tekshirish. today — foydalanuvchi sanasi (kelajakdagi sana rad etiladi; +1 kun zaxira)
export function validateSessionInput(body: any, today: string): Checked<SessionInput> {
  if (!body || typeof body !== "object") return { ok: false, message: "Noto'g'ri so'rov" };
  if (typeof body.id !== "string" || !UUID_LIKE.test(body.id)) return { ok: false, message: "Mashg'ulot id noto'g'ri" };
  const split_id = body.split_id == null || body.split_id === "" ? null : body.split_id;
  if (split_id !== null && (typeof split_id !== "string" || !UUID_LIKE.test(split_id))) return { ok: false, message: "Split topilmadi" };
  if (!isValidDate(body.performed_on)) return { ok: false, message: "Sana noto'g'ri" };
  if (body.performed_on > addDays(today, 1)) return { ok: false, message: "Kelajakdagi sanani tanlab bo'lmaydi" };
  if (body.performed_on < "2000-01-01") return { ok: false, message: "Sana noto'g'ri" };
  let duration_sec: number | null = null;
  if (body.duration_sec != null) {
    const d = Number(body.duration_sec);
    if (!Number.isFinite(d) || d < 0) return { ok: false, message: "Davomiylik noto'g'ri" };
    duration_sec = Math.min(86400, Math.round(d));
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  if (note && note.length > WORKOUT_LIMITS.note) return { ok: false, message: `Izoh ${WORKOUT_LIMITS.note} belgidan oshmasin` };
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, WORKOUT_LIMITS.title) : null;

  if (!Array.isArray(body.exercises)) return { ok: false, message: "Mashqlar ro'yxati yo'q" };
  if (body.exercises.length > WORKOUT_LIMITS.sessionExercises) return { ok: false, message: `Bitta mashg'ulotda ko'pi bilan ${WORKOUT_LIMITS.sessionExercises} ta mashq` };
  const seen = new Set<string>();
  const exercises: SessionInput["exercises"] = [];
  let total = 0;
  for (const ex of body.exercises) {
    if (!ex || typeof ex.exercise_id !== "string" || !UUID_LIKE.test(ex.exercise_id)) return { ok: false, message: "Mashq topilmadi" };
    if (seen.has(ex.exercise_id)) return { ok: false, message: "Bir mashq ikki marta qo'shilgan" };
    seen.add(ex.exercise_id);
    if (!Array.isArray(ex.sets)) return { ok: false, message: "Padxodlar noto'g'ri" };
    if (ex.sets.length > WORKOUT_LIMITS.setsPerExercise) return { ok: false, message: `Bitta mashqda ko'pi bilan ${WORKOUT_LIMITS.setsPerExercise} padxod` };
    const sets: WSet[] = [];
    for (const s of ex.sets) {
      const w = parseWeight(s?.weight_kg ?? 0); const r = parseReps(s?.reps);
      if (w === null) return { ok: false, message: `Og'irlik 0–${WORKOUT_LIMITS.maxWeight} kg oralig'ida bo'lsin` };
      if (r === null) return { ok: false, message: `Takror soni 1–${WORKOUT_LIMITS.maxReps} oralig'ida butun son bo'lsin` };
      sets.push({ weight_kg: w, reps: r });
    }
    if (sets.length === 0) continue;   // padxodsiz mashq saqlanmaydi
    total += sets.length;
    exercises.push({ exercise_id: ex.exercise_id, sets });
  }
  if (total === 0) return { ok: false, message: "Kamida bitta padxod kiriting" };
  if (total > WORKOUT_LIMITS.setsTotal) return { ok: false, message: `Bitta mashg'ulotda ko'pi bilan ${WORKOUT_LIMITS.setsTotal} padxod` };
  return { ok: true, value: { id: body.id.toLowerCase(), split_id, title, performed_on: body.performed_on, duration_sec, note, exercises } };
}

// RPC uchun yassi ro'yxat: [{ exercise_id, exercise_order, set_order, weight_kg, reps }]
export function flattenSets(exercises: SessionInput["exercises"]) {
  return exercises.flatMap((ex, i) => ex.sets.map((s, k) => ({ exercise_id: ex.exercise_id, exercise_order: i, set_order: k, weight_kg: s.weight_kg, reps: s.reps })));
}

export function normalizeName(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= max ? t : null;
}

// Qidiruv: nom, o'zbekcha nom va aliaslar bo'yicha; katta-kichik harf, apostrof turlari farqsiz
// Apostrof umuman hisobga olinmaydi: "otirib" ham, "o'tirib" ham, "oʻtirib" ham bir xil topiladi
export function normalizeSearch(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/[ʻʼ’‘`']/g, "").replace(/\s+/g, " ").trim();
}
export function matchesExercise(e: Pick<WorkoutExercise, "name" | "name_uz" | "aliases">, q: string): boolean {
  const n = normalizeSearch(q);
  if (!n) return true;
  const hay = normalizeSearch([e.name, e.name_uz || "", e.aliases || ""].join(" | "));
  return n.split(" ").every((w) => hay.includes(w));
}

// Tayyor PROGRAMMA shablonlari (bo'sh holatda bir bosishda yaratiladi). slug — katalogdagi mashqlar.
export const PROGRAM_TEMPLATES: { name: string; hint: string; days: { name: string; slugs: string[] }[] }[] = [
  { name: "Push / Pull / Leg", hint: "3 kun: itarish, tortish, oyoq", days: [
    { name: "Push day", slugs: ["bench-press", "incline-dumbbell-press", "pec-deck", "overhead-press", "lateral-raise", "triceps-pushdown"] },
    { name: "Pull day", slugs: ["deadlift", "pull-up", "lat-pulldown", "seated-cable-row", "face-pull", "barbell-curl", "hammer-curl"] },
    { name: "Leg day", slugs: ["squat", "leg-press", "romanian-deadlift", "leg-extension", "leg-curl", "standing-calf-raise"] },
  ] },
  { name: "Upper / Lower", hint: "4 kun: tepa A, past A, tepa B, past B", days: [
    { name: "Upper A", slugs: ["bench-press", "barbell-row", "overhead-press", "lat-pulldown", "dumbbell-curl", "triceps-pushdown"] },
    { name: "Lower A", slugs: ["squat", "romanian-deadlift", "leg-press", "leg-curl", "standing-calf-raise"] },
    { name: "Upper B", slugs: ["incline-dumbbell-press", "pull-up", "dumbbell-shoulder-press", "seated-cable-row", "hammer-curl", "skull-crusher"] },
    { name: "Lower B", slugs: ["deadlift", "bulgarian-split-squat", "leg-extension", "hip-thrust", "hanging-leg-raise"] },
  ] },
  { name: "Full body", hint: "2 kun: butun tana A va B", days: [
    { name: "Full body A", slugs: ["squat", "bench-press", "barbell-row", "lateral-raise", "crunch"] },
    { name: "Full body B", slugs: ["deadlift", "overhead-press", "lat-pulldown", "leg-press", "dumbbell-curl"] },
  ] },
];

// Navbatdagi kun: oxirgi bajarilgan kundan keyingisi (aylanma). Hech biri bajarilmagan bo'lsa — birinchisi.
export function nextDay<T extends { id: string }>(days: T[], lastSplitId: string | null | undefined): T | null {
  if (days.length === 0) return null;
  const i = lastSplitId ? days.findIndex((d) => d.id === lastSplitId) : -1;
  return i < 0 ? days[0] : days[(i + 1) % days.length];
}

// ---------------- YUTUQLAR ----------------
// Har mashg'ulotdagi har mashq OLDINGI natija bilan solishtiriladi (server: workout_outcome_rows).
//  record    — hamma vaqtdagi eng og'ir vazn (o'z vazni bilan — eng ko'p takror) yangilandi
//  weight_up — o'tgan safargidan og'irroq
//  reps_up   — vazn o'sha, takror ko'proq (eng og'ir padxodda yoki jami)
//  same / down / first — yutuq emas (birinchi marta — solishtirish yo'q, jazolanmaydi)
export type OutcomeType = "first" | "record" | "weight_up" | "reps_up" | "same" | "down";
export interface OutcomeRow {
  session_id?: string; exercise_id: string; is_bodyweight: boolean;
  cur_max_weight: number; cur_reps_at_top: number; cur_total_reps: number; cur_max_reps: number;
  prev_session_id?: string | null; prev_max_weight: number | null; prev_reps_at_top: number | null; prev_total_reps: number | null; prev_max_reps: number | null;
  prior_max_weight: number | null; prior_max_reps: number | null; prior_sessions: number;
}
export interface Outcome { exercise_id: string; type: OutcomeType; unit?: "kg" | "reps"; value?: number; previous?: number; delta_kg?: number; delta_reps?: number }
const n0 = (v: any) => (v == null ? 0 : Number(v));

export function classifyOutcome(r: OutcomeRow): Outcome {
  const id = r.exercise_id;
  if (!(n0(r.prior_sessions) > 0)) return { exercise_id: id, type: "first" };
  const mw = n0(r.cur_max_weight);
  const pure = r.is_bodyweight && mw === 0;
  if (pure) {
    if (n0(r.cur_max_reps) > n0(r.prior_max_reps)) return { exercise_id: id, type: "record", unit: "reps", value: n0(r.cur_max_reps), previous: n0(r.prior_max_reps), delta_reps: n0(r.cur_max_reps) - n0(r.prior_max_reps) };
  } else if (mw > n0(r.prior_max_weight)) {
    return { exercise_id: id, type: "record", unit: "kg", value: mw, previous: n0(r.prior_max_weight), delta_kg: round2(mw - n0(r.prior_max_weight)) };
  }
  if (r.prev_max_weight == null) return { exercise_id: id, type: "same" };
  const pmw = n0(r.prev_max_weight);
  if (!pure) {
    if (mw > pmw) return { exercise_id: id, type: "weight_up", delta_kg: round2(mw - pmw), value: mw, previous: pmw };
    if (mw < pmw) return { exercise_id: id, type: "down", delta_kg: round2(mw - pmw) };
  }
  const top = pure ? [n0(r.cur_max_reps), n0(r.prev_max_reps)] : [n0(r.cur_reps_at_top), n0(r.prev_reps_at_top)];
  const tot = [n0(r.cur_total_reps), n0(r.prev_total_reps)];
  if (top[0] > top[1]) return { exercise_id: id, type: "reps_up", delta_reps: top[0] - top[1] };
  if (top[0] === top[1] && tot[0] > tot[1]) return { exercise_id: id, type: "reps_up", delta_reps: tot[0] - tot[1] };
  if (top[0] < top[1] || tot[0] < tot[1]) return { exercise_id: id, type: "down", delta_reps: top[0] < top[1] ? top[0] - top[1] : tot[0] - tot[1] };
  return { exercise_id: id, type: "same" };
}
export const isAchievement = (o: Pick<Outcome, "type">) => o.type === "record" || o.type === "weight_up" || o.type === "reps_up";

// Qisqa belgi (kartochka/qator yonida) va to'liq matn (natija ro'yxati)
export function outcomeBadge(o: Outcome): string {
  if (o.type === "record") return o.unit === "reps" ? `Rekord: ${o.value} takror` : `Rekord: ${formatKg(o.value || 0)} kg`;
  if (o.type === "weight_up") return `+${formatKg(o.delta_kg || 0)} kg`;
  if (o.type === "reps_up") return `+${o.delta_reps} takror`;
  if (o.type === "down") return "Pastroq";
  if (o.type === "same") return "O'zgarmadi";
  return "Birinchi marta";
}
export function outcomeText(o: Outcome): string {
  if (o.type === "record") return o.unit === "reps" ? `Yangi rekord: ${o.value} takror (oldin ${o.previous})` : `Yangi rekord: ${formatKg(o.value || 0)} kg (oldin ${formatKg(o.previous || 0)} kg)`;
  if (o.type === "weight_up") return `Vazn oshdi: +${formatKg(o.delta_kg || 0)} kg (${formatKg(o.previous || 0)} → ${formatKg(o.value || 0)} kg)`;
  if (o.type === "reps_up") return `Takror oshdi: +${o.delta_reps}`;
  return outcomeBadge(o);
}

// Mashq tarixidan (eng yangisi birinchi) i-mashg'ulot uchun solishtirish qatori — server statistika va hisobotda ishlatadi
export interface HistSession { session_id: string; performed_on: string; sets: WSet[] }
export function outcomeRowFromHistory(exerciseId: string, bodyweight: boolean, hist: HistSession[], i: number): OutcomeRow {
  const stat = (sets: WSet[]) => {
    const mw = Math.max(0, ...sets.map((s) => s.weight_kg));
    return { mw, rat: Math.max(0, ...sets.filter((s) => s.weight_kg === mw).map((s) => s.reps)), tr: totalReps(sets), mr: Math.max(0, ...sets.map((s) => s.reps)) };
  };
  const cur = stat(hist[i].sets);
  const older = hist.slice(i + 1);
  const prev = older[0] ? stat(older[0].sets) : null;
  const prior = older.map((h) => stat(h.sets));
  return {
    exercise_id: exerciseId, is_bodyweight: bodyweight, session_id: hist[i].session_id,
    cur_max_weight: cur.mw, cur_reps_at_top: cur.rat, cur_total_reps: cur.tr, cur_max_reps: cur.mr,
    prev_session_id: older[0]?.session_id ?? null, prev_max_weight: prev ? prev.mw : null, prev_reps_at_top: prev ? prev.rat : null,
    prev_total_reps: prev ? prev.tr : null, prev_max_reps: prev ? prev.mr : null,
    prior_max_weight: prior.length ? Math.max(...prior.map((p) => p.mw)) : null, prior_max_reps: prior.length ? Math.max(...prior.map((p) => p.mr)) : null,
    prior_sessions: prior.length,
  };
}

// Yozish paytida — har padxod yonidagi jonli belgi (o'tgan safargi SHU raqamli padxod va shu paytgacha eng yaxshisi bilan)
export interface SetBadge { kind: "record" | "weight" | "reps"; text: string }
export function setBadge(cur: { weight_kg: number; reps: number }, prevSet: WSet | undefined, best: PrevBest | undefined, bodyweight = false): SetBadge | null {
  const { weight_kg: w, reps: r } = cur;
  if (!(r > 0)) return null;
  if (best && best.sessions_count > 0) {
    if (w > 0 && w > best.max_weight) return { kind: "record", text: "Rekord!" };
    if (bodyweight && w === 0 && best.max_weight === 0 && r > best.max_reps) return { kind: "record", text: "Rekord!" };
  }
  if (prevSet) {
    if (w > prevSet.weight_kg) return { kind: "weight", text: `+${formatKg(w - prevSet.weight_kg)} kg` };
    if (w === prevSet.weight_kg && r > prevSet.reps) return { kind: "reps", text: `+${r - prevSet.reps} takror` };
  }
  return null;
}
