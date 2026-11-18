import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/constants";
import { DeleteAccountPanel } from "@/components/delete-account/DeleteAccountPanel";

export const metadata = { title: "Akkauntni o'chirish — TrainerTop" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="text-sm text-white/60 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-dark">
      <div className="container-main max-w-3xl py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white mb-8">
          <ArrowLeft className="h-4 w-4" />Bosh sahifa
        </Link>

        <h1 className="text-3xl font-bold mb-2">Akkauntni o'chirish</h1>
        <p className="text-sm text-white/40 mb-10">Hisobingizni TrainerTop saytida yoki ilovasida o'zingiz o'chirishingiz mumkin.</p>

        <DeleteAccountPanel />

        <div className="prose-custom space-y-8">
          <Section title="Ilovada qanday o'chiriladi">
            <p>TrainerTop Android ilovasini oching → <strong>Profil</strong> → <strong>Sozlamalar</strong> → pastga tushib <strong>"Hisobni o'chirish"</strong> tugmasini bosing → chiqqan oynada tasdiqlang.</p>
          </Section>

          <Section title="Saytda qanday o'chiriladi">
            <p>Saytga kiring → <strong>Profil</strong> → <strong>Sozlamalar</strong> → pastga tushib <strong>"Xavfli zona"</strong> bo'limidagi <strong>"Hisobni o'chirish"</strong> tugmasini bosing → chiqqan oynada tasdiqlang. Yoki tizimga kirgan bo'lsangiz, shu sahifaning yuqorisidagi tugmadan foydalaning.</p>
          </Section>

          <Section title="Nima o'chiriladi va nima saqlanadi">
            <p>Ism-sharifingiz, profil rasmingiz va telefon raqamingiz o'chiriladi (shaxsingizni aniqlab bo'lmaydigan holga keltiriladi). Agar trener bo'lsangiz — bio, zal ma'lumotlari va rasmlaringiz tozalanadi, profilingiz boshqalarga ko'rinmay qoladi, darsliklaringiz yangi sotuvlar uchun yopiladi (avval sotib olganlar kirishda davom etadi). Bildirishnoma uchun saqlangan qurilma ma'lumoti (push token) o'chiriladi.</p>
            <p><strong>Qonuniy sabablarga ko'ra saqlanadigan narsalar:</strong> xaridlar tarixi, trener sharhlari, postlaringiz va yozgan izohlaringiz — bular butunlay o'chirilmaydi, lekin ism-familiyangiz o'rniga "O'chirilgan foydalanuvchi" ko'rsatiladi. Bu moliyaviy hisobot va boshqa foydalanuvchilarning o'z xarid tarixi buzilib qolmasligi uchun zarur.</p>
            <p>Hisobingizga <strong>qayta kira olmaysiz</strong> — bu doimiy va qaytarib bo'lmaydigan amal.</p>
          </Section>

          <Section title="Qancha vaqtda bajariladi">
            <p>So'rov yuborilgan zahoti, <strong>darhol</strong> amalga oshiriladi.</p>
            <p>Agar trener bo'lsangiz va balansingizda pul qolgan bo'lsa, yoki kutilayotgan pul yechish so'rovingiz bo'lsa — tizim avval shularni hal qilishingizni so'raydi (aks holda kimga qancha pul to'lash kerakligini bilmay qolamiz).</p>
          </Section>

          <Section title="Tizimga kira olmasangiz">
            <p>Agar hisobingizga kira olmasangiz (parolni unutgansiz, email ishlamay qoldi va h.k.), bizga quyidagilardan biri orqali murojaat qiling: email — <a href={`mailto:${SUPPORT_EMAIL}`} className="text-lime hover:underline">{SUPPORT_EMAIL}</a>, yoki Telegram — <a href="https://t.me/TrainerTop_Support_Bot" target="_blank" rel="noopener noreferrer" className="text-lime hover:underline">@TrainerTop_Support_Bot</a>. Hisobingizga tegishli ekaningizni tasdiqlash uchun ro'yxatdan o'tgan email manzilingizni ko'rsating — so'rovingizni qo'lda bajarib beramiz.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
