import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";
import { runInBackground } from "@/lib/push";
import { notifyDirectMessage } from "@/lib/push-notify";
import {
  EQUIPMENT, MUSCLE_GROUPS, UUID_LIKE, WORKOUT_LIMITS, normalizeName,
  addDays, classifyOutcome, isAchievement, isValidDate, outcomeRowFromHistory, suggestNext, tashkentToday, totalReps,
  type Outcome, type OutcomeRow, type PrevBest, type WSet, type WorkoutExercise,
} from "@/lib/workout";

// KUNDALIK — server yordamchilari (API route'lar uchun). Barcha ma'lumot faqat joriy foydalanuvchiniki.

export const NO_STORE = { "Cache-Control": "private, no-store" };
export const json = (body: any, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

// Kirgan foydalanuvchi yoki 401 javobi
export async function requireUser(request: NextRequest): Promise<{ userId: string } | { res: NextResponse }> {
  const { user } = await getApiUser(request);
  if (!user) return { res: json({ message: "Kundalikdan foydalanish uchun tizimga kiring" }, 401) };
  return { userId: user.id };
}

// Foydalanuvchining "bugun"i: klient ?today=YYYY-MM-DD yuboradi (telefon/brauzer sanasi). Server sanasidan ±1 kundan
// uzoq bo'lsa yoki yo'q bo'lsa — Toshkent sanasi. (Haftalik statistika foydalanuvchi kalendariga mos bo'lishi uchun.)
export function userToday(request: NextRequest, now = new Date()): string {
  const base = tashkentToday(now);
  const q = new URL(request.url).searchParams.get("today");
  if (q && isValidDate(q) && q >= addDays(base, -1) && q <= addDays(base, 1)) return q;
  return base;
}

// DB xatolarini tushunarli xabarga aylantirish
export function workoutError(error: any): { status: number; message: string } | null {
  const msg = String(error?.message || "");
  if (msg.includes("WORKOUT_SESSION_FORBIDDEN")) return { status: 409, message: "Bu mashg'ulotni saqlab bo'lmadi. Sahifani yangilab, qayta urinib ko'ring" };
  if (msg.includes("WORKOUT_EXERCISE_NOT_FOUND")) return { status: 404, message: "Mashq topilmadi yoki o'chirilgan" };
  if (msg.includes("WORKOUT_SPLIT_NOT_FOUND")) return { status: 404, message: "Kun topilmadi" };
  if (msg.includes("WORKOUT_SPLIT_LIMIT")) return { status: 400, message: `Bitta programmada ko'pi bilan ${WORKOUT_LIMITS.daysPerProgram} kun` };
  if (msg.includes("WORKOUT_PROGRAM_NOT_FOUND")) return { status: 404, message: "Programma topilmadi" };
  if (msg.includes("WORKOUT_PROGRAM_LIMIT")) return { status: 400, message: `Ko'pi bilan ${WORKOUT_LIMITS.programs} ta programma` };
  if (msg.includes("WORKOUT_SHARE_NO_CHAT")) return { status: 400, message: "Avval shu trener bilan chatda yozishing — keyin hisobotni yuborish mumkin" };
  if (error?.code === "23505") return { status: 409, message: "Bu nom allaqachon bor — boshqa nom tanlang" };
  if (error?.code === "23514") return { status: 400, message: "Qiymatlar noto'g'ri" };
  return null;
}
export function fail(where: string, error: any) {
  const m = workoutError(error);
  if (m) return json({ message: m.message }, m.status);
  console.error(`Workouts ${where}:`, error);
  return json({ message: "Server xatolik" }, 500);
}

const num = (v: any) => (v === null || v === undefined ? 0 : Number(v));
export const toSets = (xs: any): WSet[] => (Array.isArray(xs) ? xs.map((s) => ({ weight_kg: num(s.weight_kg), reps: num(s.reps) })) : []);

// Oldingi natijalar va eng yaxshilari (bitta mashg'ulot ochilganda / saqlanganda). before — shu sanagacha (shu kun ham)
export async function loadPrevious(userId: string, exerciseIds: string[], exclude: string | null, before: string | null = null) {
  const previous: Record<string, { session_id: string; performed_on: string; sets: WSet[] }> = {};
  const bests: Record<string, PrevBest> = {};
  if (exerciseIds.length === 0) return { previous, bests };
  const [last, best] = await Promise.all([
    supabaseAdmin.rpc("workout_last_sets", { p_user: userId, p_exercises: exerciseIds, p_exclude: exclude, p_before: before }),
    supabaseAdmin.rpc("workout_exercise_bests", { p_user: userId, p_exercises: exerciseIds, p_exclude: exclude, p_before: before }),
  ]);
  if (last.error) throw last.error;
  if (best.error) throw best.error;
  for (const r of (last.data as any[]) || []) {
    const p = (previous[r.exercise_id] ??= { session_id: r.session_id, performed_on: r.performed_on, sets: [] });
    p.sets.push({ weight_kg: num(r.weight_kg), reps: num(r.reps) });
  }
  for (const r of (best.data as any[]) || []) {
    bests[r.exercise_id] = { max_weight: num(r.max_weight), max_e1rm: num(r.max_e1rm), max_reps: num(r.max_reps), sessions_count: num(r.sessions_count) };
  }
  return { previous, bests };
}

// Bitta mashq statistikasi (tarixdan). history — eng yangisi birinchi. Tushunarli raqamlar: eng og'ir vazn, eng ko'p takror,
// "boshlaganidan beri" o'zgarish, oxirgi mashg'ulot natijasi (yutuq turi). Hajm/1RM ko'rsatilmaydi.
export interface HistoryItem { session_id: string; performed_on: string; title: string; sets: WSet[] }
export function sessionStat(sets: WSet[]) {
  const max_weight = Math.max(0, ...sets.map((s) => s.weight_kg));
  return {
    max_weight,
    reps_at_top: Math.max(0, ...sets.filter((s) => s.weight_kg === max_weight).map((s) => s.reps)),
    max_reps: Math.max(0, ...sets.map((s) => s.reps)),
    total_reps: totalReps(sets),
  };
}
export function exerciseStats(exercise: WorkoutExercise, history: HistoryItem[]) {
  const bw = !!exercise.is_bodyweight;
  const pure = bw && history.every((h) => h.sets.every((s) => s.weight_kg === 0));   // faqat o'z vazni bilan (qo'shimcha yuksiz)
  const items = history.map((h, i) => ({ ...h, ...sessionStat(h.sets), outcome: classifyOutcome(outcomeRowFromHistory(exercise.id, bw, history, i)) }));
  let wRec: (typeof items)[number] | null = null, rRec: (typeof items)[number] | null = null;
  for (const it of items) {
    // Eng og'ir vazn: teng vaznda — ko'proq takror qilingani; u ham teng bo'lsa — birinchi erishilgani
    if (it.max_weight > 0 && (!wRec || it.max_weight > wRec.max_weight || (it.max_weight === wRec.max_weight && it.reps_at_top >= wRec.reps_at_top))) wRec = it;
    if (it.max_reps > 0 && (!rRec || it.max_reps >= rRec.max_reps)) rRec = it;
  }
  const first = items[items.length - 1], last = items[0];
  return {
    exercise, pure_bodyweight: pure, sessions_count: items.length,
    records: {
      max_weight: wRec ? { value: wRec.max_weight, reps: wRec.reps_at_top, performed_on: wRec.performed_on, session_id: wRec.session_id } : null,
      max_reps: rRec ? { value: rRec.max_reps, weight_kg: Math.max(0, ...rRec.sets.filter((s) => s.reps === rRec!.max_reps).map((s) => s.weight_kg)), performed_on: rRec.performed_on, session_id: rRec.session_id } : null,
    },
    // Boshlaganidan beri: birinchi mashg'ulot → oxirgi mashg'ulot
    since_start: first && items.length > 1 ? {
      first_date: first.performed_on, first_max_weight: first.max_weight, first_max_reps: first.max_reps,
      last_date: last.performed_on, last_max_weight: last.max_weight, last_max_reps: last.max_reps,
      delta_kg: Math.round((last.max_weight - first.max_weight) * 100) / 100, delta_reps: last.max_reps - first.max_reps,
    } : null,
    // Oxirgi mashg'ulot oldingisiga nisbatan (yutuq turi bilan bir xil qoida)
    last_outcome: items.length > 1 ? { current: items[0].performed_on, previous: items[1].performed_on, ...items[0].outcome } : null,
    chart: items.slice(0, 30).reverse().map((it) => ({ performed_on: it.performed_on, max_weight: it.max_weight, reps_at_top: it.reps_at_top, max_reps: it.max_reps })),
    next_target: last ? suggestNext(last.sets, bw) : null,
    history: items.slice(0, 50),
  };
}

// Yutuqlar (berilgan mashg'ulotlar uchun): har mashq — tasniflangan natija
export async function loadOutcomes(userId: string, sessionIds: string[]): Promise<(Outcome & { session_id: string })[]> {
  if (sessionIds.length === 0) return [];
  const { data, error } = await supabaseAdmin.rpc("workout_outcome_rows", { p_user: userId, p_sessions: sessionIds });
  if (error) throw error;
  return ((data as any[]) || []).map((r) => ({ ...classifyOutcome(r as OutcomeRow), session_id: r.session_id }));
}
export function countAchievements(outcomes: Outcome[]) {
  return { achievements: outcomes.filter(isAchievement).length, records: outcomes.filter((o) => o.type === "record").length };
}

// --- Mashqlar ---
export const EX_COLS = "id, slug, owner_id, name, name_uz, aliases, muscle_group, equipment, is_bodyweight, archived_at";
export const toExercise = (e: any) => ({
  id: e.id, slug: e.slug ?? null, name: e.name, name_uz: e.name_uz ?? null, aliases: e.aliases ?? null, muscle_group: e.muscle_group,
  equipment: e.equipment, is_bodyweight: !!e.is_bodyweight, is_custom: e.owner_id != null, archived: e.archived_at != null,
});

// Kiritilgan mashq ma'lumotini tekshirish (yaratish va tahrirlash uchun umumiy)
export function readExerciseBody(body: any, partial: boolean): { ok: true; value: Record<string, any> } | { ok: false; message: string } {
  const v: Record<string, any> = {};
  if (!partial || body?.name !== undefined) {
    const name = normalizeName(body?.name, WORKOUT_LIMITS.exerciseName);
    if (!name) return { ok: false, message: `Mashq nomini kiriting (${WORKOUT_LIMITS.exerciseName} belgigacha)` };
    v.name = name;
  }
  if (!partial || body?.muscle_group !== undefined) {
    const g = body?.muscle_group ?? "other";   // o'z nomi bilan yozilgan mashqda mushak guruhi ixtiyoriy
    if (!MUSCLE_GROUPS.some((m) => m.id === g)) return { ok: false, message: "Mushak guruhi noto'g'ri" };
    v.muscle_group = g;
  }
  if (body?.equipment !== undefined || !partial) {
    const eq = body?.equipment ?? "other";
    if (!EQUIPMENT.some((m) => m.id === eq)) return { ok: false, message: "Jihoz noto'g'ri" };
    v.equipment = eq;
  }
  if (body?.is_bodyweight !== undefined) v.is_bodyweight = body.is_bodyweight === true;
  else if (!partial) v.is_bodyweight = v.equipment === "bodyweight";
  if (partial && Object.keys(v).length === 0) return { ok: false, message: "O'zgartirish yo'q" };
  return { ok: true, value: v };
}

// Xuddi shu nomli mashq (katta-kichik harf farqsiz): katalogda yoki foydalanuvchining o'zida (faol) — dublikat yaratilmasin
const likeEsc = (name: string) => name.replace(/[\\%_]/g, (c) => `\\${c}`);
export async function catalogByName(name: string): Promise<any | null> {
  const { data } = await supabaseAdmin.from("exercises").select(EX_COLS).is("owner_id", null).ilike("name", likeEsc(name)).limit(1);
  return (data || [])[0] ?? null;
}
export async function ownByName(userId: string, name: string): Promise<any | null> {
  const { data } = await supabaseAdmin.from("exercises").select(EX_COLS).eq("owner_id", userId).is("archived_at", null).ilike("name", likeEsc(name)).limit(1);
  return (data || [])[0] ?? null;
}


// --- Kunlar (split) va programmalar ---
export interface SplitItem { exercise_id: string; target_sets: number }
// Mashqlar ro'yxati: exercises: [{ exercise_id, target_sets? }] (yoki eski exercise_ids: string[]). Takrorlar olib tashlanadi.
export function readItems(body: any): { ok: true; value: SplitItem[] | undefined } | { ok: false; message: string } {
  let raw: any[] | undefined;
  if (Array.isArray(body?.exercises)) raw = body.exercises;
  else if (Array.isArray(body?.exercise_ids)) raw = body.exercise_ids.map((id: any) => ({ exercise_id: id }));
  else if (body?.exercises !== undefined || body?.exercise_ids !== undefined) return { ok: false, message: "Mashqlar ro'yxati noto'g'ri" };
  if (!raw) return { ok: true, value: undefined };
  const seen = new Set<string>(); const out: SplitItem[] = [];
  for (const x of raw) {
    const id = typeof x?.exercise_id === "string" ? x.exercise_id.toLowerCase() : "";
    if (!UUID_LIKE.test(id)) return { ok: false, message: "Mashqlar ro'yxati noto'g'ri" };
    if (seen.has(id)) continue;
    seen.add(id);
    const t = x?.target_sets == null ? WORKOUT_LIMITS.defaultSets : Number(x.target_sets);
    if (!Number.isInteger(t) || t < WORKOUT_LIMITS.targetSetsMin || t > WORKOUT_LIMITS.targetSetsMax) return { ok: false, message: `Padxodlar soni ${WORKOUT_LIMITS.targetSetsMin}–${WORKOUT_LIMITS.targetSetsMax} oralig'ida bo'lsin` };
    out.push({ exercise_id: id, target_sets: t });
  }
  if (out.length > WORKOUT_LIMITS.splitExercises) return { ok: false, message: `Bitta kunda ko'pi bilan ${WORKOUT_LIMITS.splitExercises} ta mashq` };
  return { ok: true, value: out };
}

// Kun: yaratishda name majburiy; tahrirlashda name va/yoki exercises
export function readSplitBody(body: any, partial: boolean): { ok: true; value: { name?: string; items?: SplitItem[] } } | { ok: false; message: string } {
  const v: { name?: string; items?: SplitItem[] } = {};
  if (!partial || body?.name !== undefined) {
    const name = normalizeName(body?.name, WORKOUT_LIMITS.splitName);
    if (!name) return { ok: false, message: `Kun nomini kiriting (${WORKOUT_LIMITS.splitName} belgigacha)` };
    v.name = name;
  }
  const it = readItems(body);
  if ("message" in it) return it;
  v.items = it.value;
  if (partial && v.name === undefined && v.items === undefined) return { ok: false, message: "O'zgartirish yo'q" };
  return { ok: true, value: v };
}

// Programma: { name, days?: [{ name, exercises? }] }
export function readProgramBody(body: any): { ok: true; value: { name: string; days: { name: string; exercises: SplitItem[] }[] } } | { ok: false; message: string } {
  const name = normalizeName(body?.name, WORKOUT_LIMITS.programName);
  if (!name) return { ok: false, message: `Programma nomini kiriting (${WORKOUT_LIMITS.programName} belgigacha)` };
  const rawDays = body?.days === undefined ? [] : body.days;
  if (!Array.isArray(rawDays)) return { ok: false, message: "Kunlar ro'yxati noto'g'ri" };
  if (rawDays.length > WORKOUT_LIMITS.daysPerProgram) return { ok: false, message: `Bitta programmada ko'pi bilan ${WORKOUT_LIMITS.daysPerProgram} kun` };
  const days: { name: string; exercises: SplitItem[] }[] = []; const names = new Set<string>();
  for (const d of rawDays) {
    const dn = normalizeName(typeof d === "string" ? d : d?.name, WORKOUT_LIMITS.splitName);
    if (!dn) return { ok: false, message: "Har kunga nom bering" };
    if (names.has(dn.toLowerCase())) return { ok: false, message: `"${dn}" nomi ikki marta yozilgan` };
    names.add(dn.toLowerCase());
    const it = readItems(typeof d === "string" ? {} : d);
    if ("message" in it) return it;
    days.push({ name: dn, exercises: it.value ?? [] });
  }
  return { ok: true, value: { name, days } };
}

// ---------------- Hisobot ----------------
export type Period = "4w" | "3m" | "all";
export function readPeriod(v: string | null): Period { return v === "3m" || v === "all" ? v : "4w"; }
export function periodFrom(p: Period, today: string): string | null {
  return p === "4w" ? addDays(today, -27) : p === "3m" ? addDays(today, -89) : null;
}

// Programma hisoboti (owner'ning ma'lumoti). Egasi ham, ulashilgan trener ham AYNAN shuni ko'radi.
export async function buildProgramReport(ownerId: string, programId: string, period: Period, today: string) {
  const from = periodFrom(period, today);
  const [{ data: program, error: pErr }, { data: sessions, error: sErr }] = await Promise.all([
    supabaseAdmin.rpc("workout_program_get", { p_user: ownerId, p_id: programId }),
    supabaseAdmin.rpc("workout_program_sessions", { p_user: ownerId, p_program: programId, p_from: from }),
  ]);
  if (pErr) throw pErr;
  if (sErr) throw sErr;
  if (!program) return null;
  const list: any[] = (sessions as any[]) || [];   // eskidan yangiga
  const outcomes = await loadOutcomes(ownerId, list.map((s) => s.id));
  const bySession = new Map<string, Outcome[]>();
  for (const o of outcomes) { const a = bySession.get(o.session_id) || []; a.push(o); bySession.set(o.session_id, a); }

  // Mashqlar bo'yicha: davr boshidagi va oxirgi natija, eng yaxshisi, grafik
  const exMap = new Map<string, { exercise: any; points: { performed_on: string; session_id: string; sets: WSet[] }[] }>();
  for (const s of list) for (const x of s.exercises || []) {
    const e = exMap.get(x.exercise.id) || { exercise: x.exercise, points: [] };
    e.points.push({ performed_on: s.performed_on, session_id: s.id, sets: toSets(x.sets) });
    exMap.set(x.exercise.id, e);
  }
  const dayOrder = new Map<string, number>();
  ((program as any).days || []).forEach((d: any, di: number) => (d.exercises || []).forEach((e: any, ei: number) => { if (!dayOrder.has(e.id)) dayOrder.set(e.id, di * 100 + ei); }));
  const exercises = Array.from(exMap.values()).map(({ exercise, points }) => {
    const st = points.map((p) => ({ ...p, ...sessionStat(p.sets) }));
    const first = st[0], last = st[st.length - 1];
    const best = st.reduce((b, x) => (x.max_weight > b.max_weight || (x.max_weight === b.max_weight && x.reps_at_top > b.reps_at_top) ? x : b), st[0]);
    const pure = !!exercise.is_bodyweight && st.every((x) => x.max_weight === 0);
    return {
      exercise, pure_bodyweight: pure, sessions_count: st.length,
      first: { performed_on: first.performed_on, max_weight: first.max_weight, reps_at_top: first.reps_at_top, max_reps: first.max_reps },
      last: { performed_on: last.performed_on, max_weight: last.max_weight, reps_at_top: last.reps_at_top, max_reps: last.max_reps },
      best: { performed_on: best.performed_on, max_weight: best.max_weight, reps_at_top: best.reps_at_top, max_reps: Math.max(...st.map((x) => x.max_reps)) },
      delta_kg: Math.round((last.max_weight - first.max_weight) * 100) / 100, delta_reps: last.max_reps - first.max_reps,
      achievements: outcomes.filter((o) => o.exercise_id === exercise.id && isAchievement(o)).length,
      chart: st.map((x) => ({ performed_on: x.performed_on, max_weight: x.max_weight, max_reps: x.max_reps })),
    };
  }).sort((a, b) => (dayOrder.get(a.exercise.id) ?? 9999) - (dayOrder.get(b.exercise.id) ?? 9999) || b.sessions_count - a.sessions_count);

  const weeks = new Set(list.map((s) => { const d = new Date(`${s.performed_on}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }));
  const daysStat = ((program as any).days || []).map((d: any) => ({
    id: d.id, name: d.name, sessions: list.filter((s) => s.split_id === d.id).length,
    last_performed_on: list.filter((s) => s.split_id === d.id).map((s) => s.performed_on).sort().pop() ?? null,
  }));
  return {
    program: { id: (program as any).id, name: (program as any).name },
    period: { key: period, from: from ?? (list[0]?.performed_on ?? null), to: today },
    summary: { sessions: list.length, active_weeks: weeks.size, sets: list.reduce((n, s) => n + Number(s.sets_count || 0), 0), ...countAchievements(outcomes) },
    days: daysStat,
    exercises,
    recent: list.slice(-10).reverse().map((s) => ({
      id: s.id, title: s.title, performed_on: s.performed_on, exercises_count: (s.exercises || []).length, sets_count: Number(s.sets_count || 0),
      achievements: (bySession.get(s.id) || []).filter(isAchievement).length,
    })),
  };
}

// ---------------- Chat: hisobot havolasini yuborish ----------------
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.trainertop.uz";
// Oddiy chat matn xabari (chat API bilan bir xil yon ta'sirlar: oxirgi xabar, o'qilmaganlar, bildirishnoma, push)
export async function sendChatText(conversationId: string, senderId: string, senderName: string, content: string) {
  const { data: conv, error: cErr } = await supabaseAdmin.from("conversations").select("id, trainer_id, user_id, trainer_unread, user_unread").eq("id", conversationId).maybeSingle();
  if (cErr) throw cErr;
  if (!conv) return false;
  const { error } = await supabaseAdmin.from("messages").insert({ conversation_id: conversationId, sender_id: senderId, type: "text", content });
  if (error) throw error;
  const iAmTrainer = conv.trainer_id === senderId;
  const recipient = iAmTrainer ? conv.user_id : conv.trainer_id;
  const preview = content.split("\n")[0].slice(0, 100);
  await supabaseAdmin.from("conversations").update({
    last_message: preview, last_message_at: new Date().toISOString(),
    [iAmTrainer ? "user_unread" : "trainer_unread"]: ((iAmTrainer ? conv.user_unread : conv.trainer_unread) || 0) + 1,
  }).eq("id", conversationId);
  await supabaseAdmin.from("notifications").insert({ user_id: recipient, type: "message", title: "Yangi xabar", body: `${senderName}: ${preview.slice(0, 50)}`, data: { conversation_id: conversationId } });
  runInBackground(notifyDirectMessage({ conversationId, senderId, recipientId: recipient, senderName, type: "text", content }));
  return true;
}
