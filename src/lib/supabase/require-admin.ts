import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getApiUser } from "@/lib/supabase/api-auth";

// Admin bo'lsa foydalanuvchini, aks holda null qaytaradi (cookie yoki Bearer token).
export async function requireAdmin(request: NextRequest) {
  const { user } = await getApiUser(request);
  if (!user) return null;
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "admin" ? user : null;
}

// Berilgan foydalanuvchi admin ekanini tekshiradi (route ichida allaqachon user aniqlangan bo'lsa).
export async function isAdminId(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}
