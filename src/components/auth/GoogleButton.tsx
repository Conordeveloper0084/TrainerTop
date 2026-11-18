"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

// "Google bilan davom etish" tugmasi (kirish va ro'yxatdan o'tish uchun bir xil).
// Ranglar inline berilgan: light mode'dagi global CSS override'lar (text-black va h.k.) tegmasin.
export default function GoogleButton({
  redirect = "/",
  role,
  label = "Google bilan davom etish",
}: {
  redirect?: string;
  role?: "user" | "trainer";
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  // Google sahifasidan "Orqaga" bilan qaytilsa spinner qotib qolmasin
  useEffect(() => {
    const reset = (e: PageTransitionEvent) => { if (e.persisted) setLoading(false); };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const handleClick = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const params = new URLSearchParams();
      if (redirect && redirect !== "/") params.set("redirect", redirect);
      if (role === "trainer") params.set("role", "trainer");
      const qs = params.toString();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback${qs ? `?${qs}` : ""}` },
      });
      if (error) {
        toast.error("Google orqali kirib bo'lmadi. Keyinroq qayta urinib ko'ring");
        setLoading(false);
      }
      // Muvaffaqiyatli bo'lsa brauzer Google sahifasiga o'tadi
    } catch {
      toast.error("Xatolik yuz berdi. Qayta urinib ko'ring");
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{ backgroundColor: "#ffffff", color: "#1f1f1f", border: "1px solid #dadce0" }}
      className="w-full flex items-center justify-center gap-3 rounded-button px-6 py-3 text-sm font-medium transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.83z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
        </svg>
      )}
      {label}
    </button>
  );
}
