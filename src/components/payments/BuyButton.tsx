"use client";

import { useState, useEffect } from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

// ====== SOTIB OLISH / OYLIK TO'LOVNI YANGILASH TUGMASI ======
// Darslik sahifasida ham, chatdagi qulflangan guruh ekranida ham ishlatiladi.
export function BuyButton({ lessonId, priceType, label = "Sotib olish", className }: { lessonId: string; priceType: string; label?: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const user = useAuthStore((s) => s.user);

  // Click checkout.js yuklash
  useEffect(() => {
    if (document.querySelector('script[src*="checkout.js"]')) { setScriptLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://my.click.uz/pay/checkout.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  const handleBuy = async () => {
    if (!user) { toast.error("Avval tizimga kiring"); window.location.href = "/login"; return; }

    setLoading(true);
    try {
      // 1. Buyurtma yaratish
      const res = await fetch("/api/payments/click/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: lessonId, price_type: priceType }),
      });

      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Xatolik"); return; }

      // 2. Click popup ochish (saytdan chiqmaydi!)
      if (scriptLoaded && typeof (window as any).createPaymentRequest === "function") {
        (window as any).createPaymentRequest(
          {
            service_id: parseInt(process.env.NEXT_PUBLIC_CLICK_SERVICE_ID || "102627"),
            merchant_id: parseInt(process.env.NEXT_PUBLIC_CLICK_MERCHANT_ID || "60770"),
            amount: data.amount,
            transaction_param: data.order_id,
            merchant_user_id: parseInt(process.env.NEXT_PUBLIC_CLICK_MERCHANT_USER_ID || "83939"),
            lang: "uz",
          },
          (result: any) => {
            console.log("Click payment result:", result);
            if (result && result.status === 2) {
              toast.success("To'lov muvaffaqiyatli! Darslik ochildi.");
              setTimeout(() => window.location.reload(), 2000);
            } else if (result && result.status === 1) {
              toast.info("To'lov tekshirilmoqda...");
              setTimeout(() => window.location.reload(), 5000);
            } else {
              toast.error("To'lov amalga oshmadi yoki bekor qilindi");
            }
          }
        );
      } else {
        // Fallback — redirect (checkout.js yuklanmagan bo'lsa)
        window.location.href = data.payment_url;
      }
    } catch { toast.error("Xatolik yuz berdi"); } finally { setLoading(false); }
  };

  return (
    <button onClick={handleBuy} disabled={loading}
      className={cn("btn-lime w-full !py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50", className)}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
      {loading ? "Kuting..." : label}
    </button>
  );
}
