"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NEW_TG_USER_FLAG } from "@/components/auth/telegram-shared";

// Telegram orqali YANGI akkaunt ochilganda BIR MARTALIK eslatma: foydalanuvchi avval email bilan ro'yxatdan o'tgan bo'lishi mumkin
// (dublikat akkaunt). Belgi TelegramLoginButton'da is_new_user=true bo'lganda qo'yiladi; "Tushunarli" yoki "Email bilan kirish" bosilganda o'chadi.
const defaultNavigate = (url: string) => { window.location.href = url; };

export default function NewTelegramUserNotice({ navigate = defaultNavigate }: { navigate?: (url: string) => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(localStorage.getItem(NEW_TG_USER_FLAG) === "1"); } catch { /* e'tiborsiz */ } }, []);
  if (!show) return null;
  const clear = () => { try { localStorage.removeItem(NEW_TG_USER_FLAG); } catch { /* e'tiborsiz */ } setShow(false); };
  const useEmail = async () => { clear(); try { await createClient().auth.signOut(); } catch { /* e'tiborsiz */ } navigate("/login"); };
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md rounded-xl border border-white/15 bg-dark-card p-4 shadow-xl" role="dialog" aria-label="Telegram akkaunti haqida" data-testid="tg-new-user-notice">
      <p className="text-sm font-medium mb-1">Yangi akkaunt ochildi</p>
      <p className="text-xs text-white/60 mb-3">Avval email bilan ro'yxatdan o'tganmisiz? Email bilan kiring va <b>Kirish usullari → Telegram'ni ulash</b> qiling.</p>
      <div className="flex gap-2">
        <button type="button" onClick={useEmail} className="btn-lime !py-1.5 !px-3 text-xs" data-testid="tg-notice-email">Email bilan kirish</button>
        <button type="button" onClick={clear} className="btn-outline !py-1.5 !px-3 text-xs" data-testid="tg-notice-ok">Tushunarli</button>
      </div>
    </div>
  );
}
