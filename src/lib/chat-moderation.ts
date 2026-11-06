// Moderatsiya konstantalari (brauzerda ham, serverda ham ishlatiladi)
export const MOD_REASONS = [
  { code: "adult", label: "18+ kontent" },
  { code: "abuse", label: "Haqorat / so'kinish" },
  { code: "spam", label: "Spam / reklama" },
  { code: "offtopic", label: "Mavzudan tashqari" },
  { code: "other", label: "Boshqa sabab" },
] as const;
export type ModReason = (typeof MOD_REASONS)[number]["code"];

export const MUTE_DURATIONS = [
  { code: "1d", label: "1 kun" }, { code: "7d", label: "7 kun" }, { code: "30d", label: "30 kun" }, { code: "forever", label: "Muddatsiz" },
] as const;
export type MuteDuration = (typeof MUTE_DURATIONS)[number]["code"];

export const MOD_NOTE_MAX = 500;

export function reasonLabel(code: string | null | undefined): string {
  return MOD_REASONS.find((r) => r.code === code)?.label || "Sabab ko'rsatilmagan";
}
export function isMutedNow(until: string | null | undefined): boolean {
  return !!until && (until === "infinity" || new Date(until).getTime() > Date.now());
}
export function formatUntil(until: string | null | undefined): string {
  if (!until) return "";
  if (until === "infinity") return "muddatsiz";
  return new Date(until).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
