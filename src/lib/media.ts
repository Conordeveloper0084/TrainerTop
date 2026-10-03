import { supabaseAdmin } from "@/lib/supabase/admin";
import { R2_PUBLIC_URL } from "@/lib/r2";
import { VIDEO_UPLOAD_ROLES } from "@/lib/constants";

// Foydalanuvchi roli (profiles.role). Topilmasa null.
export async function getUserRole(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role ?? null;
}

// Trener/admin — hamma joyga. Oddiy foydalanuvchi (atlet) — FAQAT post videosiga (blog); darslik/boshqa papkalarga yo'q.
export function canUploadVideo(role: string | null, folder: string = "lessons"): boolean {
  if (!role) return false;
  if ((VIDEO_UPLOAD_ROLES as readonly string[]).includes(role)) return true;
  return role === "user" && folder === "posts";
}

// Public URL -> R2 key. Bizning R2 domenimiz bo'lmasa null.
export function keyFromPublicUrl(url: unknown): string | null {
  if (typeof url !== "string" || !R2_PUBLIC_URL) return null;
  const prefix = R2_PUBLIC_URL + "/";
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  if (!key || key.includes("..") || key.includes("?") || key.includes("#")) return null;
  return key;
}

// Key formati: <folder>/<userId>/<fayl> — ikkinchi qism egasining id'si bo'lishi shart.
export function keyBelongsToUser(key: unknown, userId: string): boolean {
  if (typeof key !== "string" || key.includes("..")) return false;
  const parts = key.split("/");
  return parts.length >= 3 && parts[1] === userId;
}
