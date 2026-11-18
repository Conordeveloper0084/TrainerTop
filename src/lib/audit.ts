import { supabaseAdmin } from "@/lib/supabase/admin";

// Admin harakatlarini jurnalga yozish. Jurnal xatosi asosiy amalni to'xtatmaydi.
export async function logAdmin(adminId: string, action: string, targetType: string, targetId: string, details: Record<string, any> = {}) {
  try {
    await supabaseAdmin.rpc("log_admin_action", {
      p_admin: adminId, p_action: action, p_type: targetType, p_target: targetId, p_details: details,
    });
  } catch (e) {
    console.error("audit log:", e);
  }
}
