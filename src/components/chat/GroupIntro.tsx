"use client";

import { Lock, MessageCircle, ShieldCheck } from "lucide-react";

interface Props {
  group: { name: string; bio?: string | null; lesson?: { title?: string } | null; owner?: { full_name?: string } | null };
  isOwner: boolean;
  onClose: () => void;
}

// A'zo guruhga BIRINCHI marta kirganda bir marta chiqadigan tanishtiruv. Keyin "Guruh haqida" ichida turadi.
export function GroupIntro({ group, isOwner, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-label="Guruh haqida">
      <div className="bg-dark-surface border border-white/[0.08] rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="w-12 h-12 rounded-2xl bg-lime/10 flex items-center justify-center mb-4"><Lock className="h-6 w-6 text-lime" /></div>
          <h2 className="text-lg font-bold mb-1">{isOwner ? "Guruhingiz tayyor" : "Guruhga xush kelibsiz"}</h2>
          <p className="text-xs text-white/40 mb-4">{group.name}</p>

          <p className="text-sm text-white/70 leading-relaxed mb-4">
            {isOwner ? (
              <>Bu <b>«{group.lesson?.title}»</b> darsligingizning yopiq guruhi. Darslikni sotib olgan har bir kishi avtomatik qo'shiladi, boshqalar guruhni topa olmaydi. Siz guruh adminisiz: nom va tavsifni o'zgartira, rasm qo'ya, xabarlarni o'chira va a'zolarni chiqara olasiz.</>
            ) : (
              <>Bu <b>«{group.lesson?.title}»</b> darsligining yopiq guruhi. Bu yerda faqat darslikni sotib olganlar va trener{group.owner?.full_name ? ` ${group.owner.full_name}` : ""} bor. Darslik bo'yicha savol bering, tushunmagan joylaringizni so'rang va boshqa shogirdlar bilan muhokama qiling.</>
            )}
          </p>

          {group.bio && <div className="bg-dark-card rounded-xl p-3 mb-4"><p className="text-[11px] text-white/30 mb-1">Guruh haqida</p><p className="text-sm text-white/70 whitespace-pre-line">{group.bio}</p></div>}

          <ul className="space-y-2 text-xs text-white/50 mb-5">
            <li className="flex gap-2"><MessageCircle className="h-3.5 w-3.5 text-lime shrink-0 mt-0.5" />Matn, ovozli xabar, rasm va video yuborish mumkin</li>
            <li className="flex gap-2"><ShieldCheck className="h-3.5 w-3.5 text-lime shrink-0 mt-0.5" />Bir-biringizni hurmat qiling. Reklama, haqorat va 18+ kontent taqiqlangan; trener xabarlarni o'chira oladi</li>
          </ul>
          <button onClick={onClose} className="btn-lime w-full !py-2.5 text-sm">Tushunarli</button>
        </div>
      </div>
    </div>
  );
}
