"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

// Tasdiqlash xatini qayta yuborish tugmasi (60 soniyalik kutish bilan).
export default function ResendEmail({ email, initialCooldown = 0 }: { email: string; initialCooldown?: number }) {
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    setSending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` },
      });
      if (error) {
        const tooMany = (error as any).status === 429 || /rate|seconds|too many/i.test(error.message);
        toast.error(
          tooMany
            ? "Juda tez-tez so'raldi. Bir daqiqa kutib qayta urinib ko'ring"
            : "Xatni yuborib bo'lmadi. Keyinroq qayta urinib ko'ring"
        );
      } else {
        toast.success("Tasdiqlash xati qayta yuborildi");
      }
      setCooldown(60);
    } catch {
      toast.error("Xatolik yuz berdi. Qayta urinib ko'ring");
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={send}
      disabled={sending || cooldown > 0}
      className="btn-soft w-full flex items-center justify-center gap-2 disabled:opacity-50"
    >
      {sending && <Loader2 className="h-4 w-4 animate-spin" />}
      {cooldown > 0 ? `Qayta yuborish (${cooldown} s)` : "Xatni qayta yuborish"}
    </button>
  );
}
