"use client";

import { useState } from "react";
import { Lock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { BuyButton } from "@/components/payments/BuyButton";
import { formatPrice } from "@/lib/utils";

interface Props {
  group: { id: string; name: string; avatar_url?: string | null; lesson_id: string; price_monthly?: number | null };
  onLeft: () => void;
}

// Oylik obunasi tugagan a'zo uchun: guruh ro'yxatda turadi, ichiga kirib bo'lmaydi.
// Oylik to'lovni shu yerning o'zida yangilash yoki guruhdan chiqib ketish mumkin.
export function LockedGroup({ group, onLeft }: Props) {
  const [leaving, setLeaving] = useState(false);
  const price = group.price_monthly && group.price_monthly > 0 ? group.price_monthly : null;

  const leave = async () => {
    if (!window.confirm("Guruhdan chiqib ketasizmi? Oylik to'lovni yangilasangiz, guruh o'zi qaytadi.")) return;
    setLeaving(true);
    try {
      const res = await fetch(`/api/chat/groups/${group.id}/leave`, { method: "POST" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || "Xatolik"); }
      toast.success("Guruhdan chiqdingiz");
      onLeft();
    } catch (e: any) { toast.error(e.message || "Xatolik"); } finally { setLeaving(false); }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6" data-testid="locked-group">
      <div className="max-w-sm w-full text-center">
        <div className="w-20 h-20 rounded-full bg-dark-card mx-auto mb-5 flex items-center justify-center overflow-hidden relative">
          {group.avatar_url ? <img src={group.avatar_url} alt="" className="w-full h-full object-cover opacity-40" /> : null}
          <Lock className="h-8 w-8 text-white/40 absolute" />
        </div>
        <h3 className="text-lg font-bold mb-1">{group.name}</h3>
        <p className="text-sm text-white/50 mb-6 leading-relaxed">
          Bu guruh yopiq. Oylik obunangiz muddati tugagan. Guruhga qaytish uchun oylik to'lovni yangilang.
        </p>
        <BuyButton
          lessonId={group.lesson_id}
          priceType="monthly"
          label={price ? `Oylik to'lovni to'lash · ${formatPrice(price)}` : "Oylik to'lovni to'lash"}
        />
        <button onClick={leave} disabled={leaving} className="mt-3 w-full flex items-center justify-center gap-2 text-xs text-white/40 hover:text-white py-2 disabled:opacity-40">
          <LogOut className="h-3.5 w-3.5" /> Guruhdan chiqib ketish
        </button>
      </div>
    </div>
  );
}
