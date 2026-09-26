// Admin uchun guruh "salomatligi" belgisi va qulay formatlar (sof funksiyalar)
export interface GroupStatRow { is_archived?: boolean; messages_total: number; messages_7d: number; senders_7d: number }

export function groupHealth(r: GroupStatRow): { label: string; tone: "green" | "yellow" | "gray" | "red" } {
  if (r.is_archived) return { label: "Yopilgan", tone: "red" };
  if (!r.messages_total) return { label: "Bo'sh", tone: "gray" };
  if (!r.messages_7d) return { label: "Jim", tone: "gray" };
  if (r.senders_7d >= 2 && r.messages_7d >= 5) return { label: "Jonli", tone: "green" };
  return { label: "Sust", tone: "yellow" };
}

export function formatResponseTime(seconds: number | string | null | undefined): string {
  const s = Number(seconds);
  if (!Number.isFinite(s) || seconds === null || seconds === undefined) return "—";
  if (s < 90) return "1 daqiqadan kam";
  if (s < 3600 * 1.5) return `${Math.round(s / 60)} daqiqa`;
  if (s < 3600 * 36) return `${Math.round(s / 3600)} soat`;
  return `${Math.round(s / 86400)} kun`;
}
