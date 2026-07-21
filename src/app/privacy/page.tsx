import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Maxfiylik siyosati — TrainerTop" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-dark">
      <div className="container-main max-w-3xl py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white mb-8">
          <ArrowLeft className="h-4 w-4" />Bosh sahifa
        </Link>

        <h1 className="text-3xl font-bold mb-2">Maxfiylik siyosati</h1>
        <p className="text-sm text-white/40 mb-10">Oxirgi yangilanish: 2026-yil, aprel</p>

        <div className="prose-custom space-y-8">
          <Section title="1. Kirish">
            <p>Trainertop.uz (keyingi o'rinlarda — "Biz") foydalanuvchilarning shaxsiy ma'lumotlarini himoya qilishga jiddiy yondashadi. Ushbu maxfiylik siyosati qanday ma'lumotlarni to'plashimiz, qanday foydalanishimiz va qanday himoya qilishimizni tushuntiradi.</p>
          </Section>

          <Section title="2. To'planadigan ma'lumotlar">
            <p>Biz quyidagi ma'lumotlarni to'playmiz:</p>
            <p><strong>Ro'yxatdan o'tishda:</strong> Ism-familiya, email manzil, telefon raqami, tug'ilgan yil.</p>
            <p><strong>Trenerlar uchun qo'shimcha:</strong> Tajriba yillari, yo'nalishlar, shahar, bio, sertifikatlar, karta raqami (pul yechish uchun).</p>
            <p><strong>Foydalanish jarayonida:</strong> IP manzil, brauzer turi, qurilma ma'lumoti, saytda o'tkazgan vaqt.</p>
            <p><strong>To'lovlarda:</strong> To'lov miqdori, vaqti va holati. Karta ma'lumotlari Click to'lov tizimi orqali qayta ishlanadi — biz to'liq karta raqamini saqlamaymiz.</p>
          </Section>

          <Section title="3. Ma'lumotlardan foydalanish">
            <p>To'plangan ma'lumotlar quyidagi maqsadlarda ishlatiladi:</p>
            <p>— Foydalanuvchi akkauntini yaratish va boshqarish;</p>
            <p>— Trener va foydalanuvchilar o'rtasida aloqani ta'minlash;</p>
            <p>— To'lovlarni qayta ishlash va trener daromadini hisoblash;</p>
            <p>— Platformani yaxshilash va xatolarni tuzatish;</p>
            <p>— Xavfsizlik va firibgarlikning oldini olish;</p>
            <p>— Yangiliklar va muhim o'zgarishlar haqida xabar berish (foydalanuvchi roziligi bilan).</p>
          </Section>

          <Section title="4. Ma'lumotlarni saqlash">
            <p>Shaxsiy ma'lumotlar xavfsiz serverlarda saqlanadi. Biz ma'lumotlarni himoya qilish uchun zamonaviy shifrlash texnologiyalaridan foydalanamiz:</p>
            <p>— Ma'lumotlar bazasi shifrlangan aloqa orqali himoyalangan (SSL/TLS);</p>
            <p>— Parollar xesh qilingan holda saqlanadi (hech kim, jumladan biz ham ko'ra olmaymiz);</p>
            <p>— Serverlar xalqaro standartlarga javob beradigan ma'lumot markazlarida joylashgan.</p>
          </Section>

          <Section title="5. Uchinchi tomonlar">
            <p>Biz shaxsiy ma'lumotlarni quyidagi hollarda uchinchi tomonlar bilan bo'lishishimiz mumkin:</p>
            <p>— <strong>Click to'lov tizimi</strong> — to'lovlarni qayta ishlash uchun;</p>
            <p>— <strong>Supabase</strong> — ma'lumotlar bazasi xizmati sifatida;</p>
            <p>— <strong>Cloudflare</strong> — media fayllarni saqlash va tezlashtirish uchun;</p>
            <p>— <strong>Vercel</strong> — veb-saytni joylashtirish uchun;</p>
            <p>— <strong>Qonun talabi bo'yicha</strong> — sud qarori yoki qonun ijro organlari so'rovi bo'lganda.</p>
            <p>Biz shaxsiy ma'lumotlarni reklama maqsadida uchinchi tomonlarga sotmaymiz.</p>
          </Section>

          <Section title="6. Cookie fayllar">
            <p>Platforma cookie fayllardan foydalanadi:</p>
            <p>— Sessiya cookie'lari — akkauntga kirish holatingizni saqlash uchun;</p>
            <p>— Afzalliklar cookie'lari — tilni va mavzu (light/dark mode) sozlamalarini saqlash uchun.</p>
            <p>Siz brauzer sozlamalaridan cookie'larni o'chirib qo'yishingiz mumkin, lekin bu platformaning ba'zi funksiyalarini cheklashi mumkin.</p>
          </Section>

          <Section title="7. Foydalanuvchi huquqlari">
            <p>Siz quyidagi huquqlarga egasiz:</p>
            <p>— Shaxsiy ma'lumotlaringizni ko'rish va tahrirlash (Profil sozlamalarida);</p>
            <p>— Akkauntni o'chirish va barcha ma'lumotlarni yo'q qilishni so'rash;</p>
            <p>— Marketing xabarlaridan voz kechish;</p>
            <p>— Shaxsiy ma'lumotlaringiz qanday ishlatilayotgani haqida so'rash.</p>
            <p>Ushbu huquqlardan foydalanish uchun support@trainertop.uz ga murojaat qiling.</p>
          </Section>

          <Section title="8. Bolalar maxfiyligi">
            <p>Platforma 16 yoshdan kichik shaxslar uchun mo'ljallanmagan. Biz 16 yoshdan kichik shaxslarning ma'lumotlarini ataylab to'plamaymiz. Agar biz bunday ma'lumotlarni aniqlasak, ularni darhol o'chirib tashlaymiz.</p>
          </Section>

          <Section title="9. O'zgartirishlar">
            <p>Biz ushbu maxfiylik siyosatini istalgan vaqtda yangilash huquqini o'zimizda saqlaymiz. O'zgarishlar platformada e'lon qilinadi.</p>
          </Section>

          <Section title="10. Bog'lanish">
            <p>Maxfiylik siyosati bo'yicha savollar uchun:</p>
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
