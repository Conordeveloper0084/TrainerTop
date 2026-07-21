import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Foydalanish shartlari — TrainerTop" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-dark">
      <div className="container-main max-w-3xl py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white mb-8">
          <ArrowLeft className="h-4 w-4" />Bosh sahifa
        </Link>

        <h1 className="text-3xl font-bold mb-2">Foydalanish shartlari</h1>
        <p className="text-sm text-white/40 mb-10">Oxirgi yangilanish: 2026-yil, aprel</p>

        <div className="prose-custom space-y-8">
          <Section title="1. Umumiy qoidalar">
            <p>Trainertop.uz (keyingi o'rinlarda — "Platforma") fitness trenerlar va foydalanuvchilarni bog'laydigan onlayn xizmat hisoblanadi. Platformadan foydalanish orqali siz ushbu shartlarga rozilik bildirasiz.</p>
            <p>Platforma O'zbekiston Respublikasi qonunchiligiga muvofiq faoliyat yuritadi.</p>
          </Section>

          <Section title="2. Ro'yxatdan o'tish">
            <p>Platformadan to'liq foydalanish uchun ro'yxatdan o'tish talab etiladi. Siz quyidagilarga kafolat berasiz:</p>
            <p>— Siz 16 yoshdan katta ekansiz;</p>
            <p>— Taqdim etgan ma'lumotlaringiz to'g'ri va haqiqiy;</p>
            <p>— Akkauntingiz xavfsizligini ta'minlaysiz va parolingizni uchinchi shaxslarga bermaysiz.</p>
          </Section>

          <Section title="3. Trenerlar uchun">
            <p>Trenerlar Platformada o'z profillarini ochib, darsliklar yaratish va sotish huquqiga ega. Trener quyidagilarga rozilik bildiradi:</p>
            <p>— Joylangan barcha kontent (video, rasm, matn) uning shaxsiy mulki yoki foydalanish huquqi mavjudligiga;</p>
            <p>— Platforma har bir sotuvdan 10% komissiya olishiga;</p>
            <p>— Pul yechish so'rovi 1-3 ish kuni ichida ko'rib chiqilishiga;</p>
            <p>— Noqonuniy, zararli yoki aldov kontentni joylamaslikka.</p>
          </Section>

          <Section title="4. Foydalanuvchilar uchun">
            <p>Foydalanuvchilar Platformada trenerlarni topish, darsliklarni sotib olish va chat orqali muloqot qilish imkoniyatiga ega.</p>
            <p>— Sotib olingan darsliklar faqat shaxsiy foydalanish uchun. Boshqalarga tarqatish taqiqlanadi;</p>
            <p>— Darslik kontentini yozib olish, yuklab olish yoki ekran yozuviga olish taqiqlanadi;</p>
            <p>— Sotib olingan darslik uchun pul qaytarilmaydi, agar darslik texnik jihatdan ishlamasa bundan mustasno.</p>
          </Section>

          <Section title="5. To'lov shartlari">
            <p>Platformada to'lovlar Click to'lov tizimi orqali amalga oshiriladi.</p>
            <p>— Narxlar O'zbekiston so'mida ko'rsatiladi;</p>
            <p>— To'lov amalga oshgandan keyin foydalanuvchi darslikka kirish huquqiga ega bo'ladi;</p>
            <p>— Click to'lov tizimi komissiyasi alohida olinishi mumkin;</p>
            <p>— Trener daromadi 10% platforma komissiyasidan keyin hisoblanadi.</p>
          </Section>

          <Section title="6. Intellektual mulk">
            <p>Platformadagi barcha dizayn, logo, kod va tizim Trainertop jamoasiga tegishli. Trenerlar tomonidan joylangan kontent esa trenerlarning shaxsiy mulki hisoblanadi.</p>
            <p>Platforma trener kontentini faqat Platforma doirasida ko'rsatish va reklama qilish uchun foydalanish huquqiga ega.</p>
          </Section>

          <Section title="7. Taqiqlangan harakatlar">
            <p>Platformada quyidagilar taqiqlanadi:</p>
            <p>— Soxta akkauntlar yaratish;</p>
            <p>— Boshqa foydalanuvchilarni aldash yoki bezovta qilish;</p>
            <p>— Tizim xavfsizligini buzishga urinish;</p>
            <p>— Darslik kontentini ruxsatsiz tarqatish;</p>
            <p>— Spam yoki noqonuniy kontent joylashtirish.</p>
          </Section>

          <Section title="8. Javobgarlik chegarasi">
            <p>Platforma trenerlar tomonidan taqdim etilgan mashq dasturlari natijasida yuzaga kelishi mumkin bo'lgan sog'liqqa oid oqibatlar uchun javobgar emas. Har bir foydalanuvchi mashqlarni o'z mas'uliyatida bajaradi.</p>
            <p>Texnik nosozliklar yoki uchinchi tomon xizmatlari (Click, internet provayder) sababli yuzaga kelgan muammolar uchun platforma javobgar emas.</p>
          </Section>

          <Section title="9. Shartlar o'zgarishi">
            <p>Platforma ushbu foydalanish shartlarini istalgan vaqtda o'zgartirish huquqini o'zida saqlaydi. O'zgarishlar platformada e'lon qilinadi va darhol kuchga kiradi.</p>
          </Section>

          <Section title="10. Bog'lanish">
            <p>Savollar va takliflar uchun bizga murojaat qiling:</p>
            <p>— Email: support@trainertop.uz</p>
            <p>— Sayt: trainertop.uz/support</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="text-sm text-white/60 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}
