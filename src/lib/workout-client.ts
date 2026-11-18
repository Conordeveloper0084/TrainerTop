"use client";

import type { WorkoutExercise, WSet } from "@/lib/workout";
import { localToday } from "@/lib/workout";

// KUNDALIK — brauzer tomoni: API chaqiruvlari, mashqlar keshi, yozilayotgan mashg'ulot qoralamasi.

export class ApiError extends Error { constructor(message: string, public status: number, public data: any = null) { super(message); } }

export async function wapi<T = any>(path: string, init?: { method?: string; body?: any }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/workouts${path}`, {
      method: init?.method || "GET", cache: "no-store",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("Internet aloqasi yo'q", 0);
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.message || "Xatolik yuz berdi", res.status, data);
  return data as T;
}
export const withToday = (path: string) => `${path}${path.includes("?") ? "&" : "?"}today=${localToday()}`;

export function newId(): string {
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Mashqlar ro'yxati — sahifalar orasida bitta so'rov (o'z mashqi qo'shilsa/o'chirilsa yangilanadi)
let exCache: Promise<WorkoutExercise[]> | null = null;
export function getExercises(force = false): Promise<WorkoutExercise[]> {
  if (!exCache || force) {
    exCache = wapi<{ exercises: WorkoutExercise[] }>("/exercises").then((d) => d.exercises).catch((e) => { exCache = null; throw e; });
  }
  return exCache;
}
export function _resetExerciseCache() { exCache = null; }

// ---------------- Qoralama (yozilayotgan mashg'ulot) ----------------
// Har o'zgarishda brauzerga yoziladi: sahifa yangilansa, yopilsa yoki internet uzilsa ham kiritilgan padxodlar yo'qolmaydi.
export interface DraftSet { weight: string; reps: string; done: boolean }
export interface DraftExercise { exercise: WorkoutExercise; sets: DraftSet[] }
export interface Draft {
  v: 1; id: string; user_id: string; split_id: string | null; title: string; performed_on: string;
  started_at: number; editing: boolean; note: string; exercises: DraftExercise[];
  duration_sec?: number | null;   // tahrirlashda — asl davomiylik saqlanib qoladi
}
const key = (userId: string) => `tt_workout_draft:${userId}`;

export function loadDraft(userId: string): Draft | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1 || d.user_id !== userId || typeof d.id !== "string" || !Array.isArray(d.exercises)) return null;
    return d as Draft;
  } catch { return null; }
}
export function saveDraft(d: Draft): boolean {
  try { localStorage.setItem(key(d.user_id), JSON.stringify(d)); return true; } catch { return false; }
}
export function clearDraft(userId: string) {
  try { localStorage.removeItem(key(userId)); } catch { /* yo'q */ }
}

export function emptySets(n: number): DraftSet[] {
  return Array.from({ length: Math.max(1, n) }, () => ({ weight: "", reps: "", done: false }));
}

// Padxod qiymati: kiritilgan bo'lsa — o'zi, bo'lmasa — "oldingi" (placeholder) qiymat
export function effectiveSet(s: DraftSet, ph: { weight?: string; reps?: string }): { weight: string; reps: string } {
  return { weight: s.weight.trim() !== "" ? s.weight : ph.weight ?? "", reps: s.reps.trim() !== "" ? s.reps : ph.reps ?? "" };
}

// Qoralamadan saqlanadigan padxodlar: ✓ bosilgan YOKI biror qiymat yozilgan qatorlar. Bo'sh maydon — ekranda kulrang ko'rinib turgan
// "oldingi" qiymat bilan to'ldiriladi (ko'ringan narsa saqlanadi). Tegilmagan bo'sh qatorlar hisobga olinmaydi.
// Noto'g'ri qiymat — xato xabari (qaysi mashq, nechanchi padxod).
export const NOTHING_TO_SAVE = "Kamida bitta padxodni belgilang (✓) yoki takror sonini yozing";
export function draftToPayload(d: Draft, placeholders: (exId: string, i: number) => { weight?: string; reps?: string }):
  { ok: true; exercises: { exercise_id: string; sets: WSet[] }[]; count: number } | { ok: false; message: string } {
  const out: { exercise_id: string; sets: WSet[] }[] = [];
  let count = 0;
  for (const ex of d.exercises) {
    const sets: WSet[] = [];
    for (let i = 0; i < ex.sets.length; i++) {
      const s = ex.sets[i];
      const touched = s.done || s.reps.trim() !== "" || s.weight.trim() !== "";
      if (!touched) continue;
      const v = effectiveSet(s, placeholders(ex.exercise.id, i));
      const w = v.weight.trim() === "" ? 0 : Number(v.weight.replace(",", "."));
      const r = Number(v.reps);
      if (!Number.isFinite(w) || w < 0 || w > 1000) return { ok: false, message: `${ex.exercise.name}, ${i + 1}-padxod: og'irlik noto'g'ri` };
      if (v.reps.trim() === "" || !Number.isInteger(r) || r < 1 || r > 1000) return { ok: false, message: `${ex.exercise.name}, ${i + 1}-padxod: takror sonini kiriting` };
      if (w === 0 && !ex.exercise.is_bodyweight && v.weight.trim() === "") return { ok: false, message: `${ex.exercise.name}, ${i + 1}-padxod: og'irlikni kiriting` };
      sets.push({ weight_kg: Math.round(w * 100) / 100, reps: r });
    }
    if (sets.length > 0) { out.push({ exercise_id: ex.exercise.id, sets }); count += sets.length; }
  }
  if (count === 0) return { ok: false, message: NOTHING_TO_SAVE };
  return { ok: true, exercises: out, count };
}

// Faqat raqam: og'irlik — 0..1000, 2 xonagacha kasr (vergul ham), takror — butun son
export function cleanWeightInput(v: string): string {
  const t = v.replace(",", ".").replace(/[^\d.]/g, "");
  const [a, ...rest] = t.split(".");
  const dec = rest.join("").slice(0, 2);
  return (rest.length > 0 ? `${a.slice(0, 4)}.${dec}` : a.slice(0, 4));
}
export function cleanRepsInput(v: string): string {
  return v.replace(/\D/g, "").slice(0, 4);
}
