import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/constants";

export const metadata = { title: "Foydalanish shartlari — TrainerTop" };

interface Sec { title: string; body: string[] }

const uz: Sec[] = [
  { title: "1. Umumiy qoidalar", body: [
    `Trainertop.uz va TrainerTop Android ilovasi (birgalikda — "Platforma") fitness trenerlar va foydalanuvchilarni bog'laydigan onlayn xizmat hisoblanadi. Platformadan foydalanish orqali siz ushbu shartlarga rozilik bildirasiz.`,
    `Platforma O'zbekiston Respublikasi qonunchiligiga muvofiq faoliyat yuritadi.`,
  ]},
  { title: "2. Ro'yxatdan o'tish", body: [
    `Platformadan to'liq foydalanish uchun ro'yxatdan o'tish talab etiladi. Ro'yxatdan o'tish orqali siz quyidagilarga kafolat berasiz: 16 yoshdan katta ekansiz; taqdim etgan ma'lumotlaringiz to'g'ri va haqiqiy; akkauntingiz xavfsizligini ta'minlaysiz va parolingizni uchinchi shaxslarga bermaysiz.`,
    `Platforma umuman 13 yoshdan kichik shaxslar uchun mo'ljallanmagan (qarang: Maxfiylik siyosati).`,
  ]},
  { title: "3. Foydalanuvchi kontenti qoidalari", body: [
    `Postlar, izohlar, sharhlar, chat xabarlari va boshqa siz joylaydigan har qanday kontentda quyidagilarga MUTLAQO YO'L QO'YILMAYDI: haqoratli yoki kamsituvchi til; zo'ravonlikka chaqiruv yoki uni ulug'lash; jinsiy tusdagi kontent; bolalarga nisbatan zararli yoki ularni ekspluatatsiya qiluvchi har qanday kontent; firibgarlik, spam yoki aldov; boshqa shaxsning mualliflik huquqini buzuvchi kontent.`,
    `Har qanday post, izoh, sharh yoki foydalanuvchiga nisbatan shikoyat (report) yuborish mumkin; shuningdek, istalgan foydalanuvchini bloklash imkoniyati mavjud — bloklangan foydalanuvchining kontenti faqat sizning lentangizda ko'rinmay qoladi.`,
    `Ushbu qoidalarni buzgan foydalanuvchilar ogohlantiriladi, vaqtincha yoki muddatsiz ban qilinishi, kontenti o'chirilishi mumkin — buning sababi haqida xabar beriladi.`,
  ]},
  { title: "4. Trenerlar uchun", body: [
    `Trenerlar Platformada o'z profillarini ochib, darsliklar yaratish va sotish huquqiga ega. Trener quyidagilarga rozilik bildiradi: joylangan barcha kontent (video, rasm, matn) uning shaxsiy mulki yoki foydalanish huquqi mavjudligiga; Platforma har bir sotuvdan standart 10% komissiya olishiga (admin tomonidan ayrim trenerlar uchun individual stavka belgilanishi mumkin); pul yechish so'rovi ko'rib chiqilishi va tasdiqlanishi talab etilishiga; noqonuniy, zararli yoki aldov kontentni joylamaslikka.`,
    `TrainerTop'dagi trener tavsiyalari va darsliklari tibbiy maslahat yoki tibbiy xizmat hisoblanmaydi. Har qanday mashq dasturini boshlashdan oldin sog'liq holatingizga mos kelishini shifokor bilan tekshirib ko'rish tavsiya etiladi. Trener o'z tavsiyalari natijasi uchun javobgar bo'lib, Platforma vositachi sifatida xizmat qiladi.`,
  ]},
  { title: "5. Foydalanuvchilar uchun", body: [
    `Foydalanuvchilar Platformada trenerlarni topish, darsliklarni sotib olish va chat orqali muloqot qilish imkoniyatiga ega. Sotib olingan darsliklar faqat shaxsiy foydalanish uchun — boshqalarga tarqatish, yozib olish, yuklab olish yoki ekran yozuviga olish taqiqlanadi.`,
  ]},
  { title: "6. To'lov va pul qaytarish", body: [
    `Platformada to'lovlar Click to'lov tizimi orqali amalga oshiriladi; narxlar O'zbekiston so'mida ko'rsatiladi. To'lov amalga oshgandan keyin darslikka kirish huquqi darhol beriladi.`,
    `Sotib olingan darslik uchun pul qaytarilmaydi, bundan darslik texnik sabablarga ko'ra umuman ochilmaydigan/ishlamaydigan holatlar mustasno — bunday holatda ${SUPPORT_EMAIL} ga murojaat qiling, holat individual ko'rib chiqiladi.`,
    `Trener daromadi platforma komissiyasi ayirilgandan keyin hisoblanadi va pul yechish bo'limida ko'rsatiladi.`,
  ]},
  { title: "7. Akkauntni cheklash va o'chirish", body: [
    `Ushbu shartlarni buzgan akkauntlar admin tomonidan vaqtincha yoki muddatsiz ban qilinishi mumkin. Siz o'z akkauntingizni istalgan vaqt o'zingiz o'chirishingiz mumkin: trainertop.uz/delete-account.`,
  ]},
  { title: "8. Intellektual mulk", body: [
    `Platformadagi barcha dizayn, logotip, kod va tizim TrainerTop'ga tegishli. Trenerlar va foydalanuvchilar tomonidan joylangan kontent ularning shaxsiy mulki hisoblanadi; Platforma bu kontentni faqat Platforma doirasida ko'rsatish va targ'ib qilish uchun foydalanish huquqiga ega.`,
  ]},
  { title: "9. Javobgarlikni cheklash", body: [
    `Platforma "mavjud holicha" taqdim etiladi. Biz trenerlar tomonidan berilgan tavsiyalar yoki foydalanuvchilar o'rtasidagi muloqot natijasida yuzaga kelgan zararlar uchun javobgar emasmiz, qonun boshqacha talab qilmasa.`,
  ]},
  { title: "10. O'zgarishlar va bog'lanish", body: [
    `Ushbu shartlarni vaqti-vaqti bilan yangilashimiz mumkin; o'zgarishlar shu sahifada e'lon qilinadi. Savollar uchun: ${SUPPORT_EMAIL}, Telegram: @TrainerTop_Support_Bot.`,
  ]},
];

const en: Sec[] = [
  { title: "1. General", body: [
    `Trainertop.uz and the TrainerTop Android app (together, "the Platform") connect fitness trainers with users. By using the Platform, you agree to these Terms.`,
    `The Platform operates under the laws of the Republic of Uzbekistan.`,
  ]},
  { title: "2. Registration", body: [
    `Full use of the Platform requires registration. By registering, you confirm that: you are over 16; the information you provide is accurate; and you will keep your account secure and not share your password with third parties.`,
    `The Platform is not directed at anyone under 13 (see our Privacy Policy).`,
  ]},
  { title: "3. User content rules", body: [
    `Posts, comments, reviews, chat messages, and any other content you post must NEVER contain: abusive or demeaning language; incitement or glorification of violence; sexual content; content that harms or exploits children in any way; fraud, spam, or scams; content that infringes someone else's copyright.`,
    `You can report any post, comment, review, or user; you can also block any user — a blocked user's content will simply stop appearing in your own feed.`,
    `Accounts that break these rules may be warned, have content removed, or be temporarily or permanently banned; you will be told the reason.`,
  ]},
  { title: "4. For trainers", body: [
    `Trainers may open a profile and create and sell lessons. By doing so, a trainer agrees that: all content they post (video, images, text) is their own or they hold the rights to use it; the Platform takes a standard 10% commission per sale (admin may set an individual rate for specific trainers); payout requests are subject to review and approval; they will not post illegal, harmful, or deceptive content.`,
    `Trainer advice and lessons on TrainerTop are not medical advice or a medical service. We recommend checking with a doctor that any exercise program is suitable for your health before starting. The trainer is responsible for the outcome of their own advice; the Platform acts only as an intermediary.`,
  ]},
  { title: "5. For users", body: [
    `Users can find trainers, purchase lessons, and message through chat. Purchased lessons are for personal use only — redistributing, recording, downloading, or screen-recording them is prohibited.`,
  ]},
  { title: "6. Payment and refunds", body: [
    `Payments on the Platform are processed through Click; prices are shown in Uzbekistani som. Access to a lesson is granted immediately after payment.`,
    `Purchases are non-refundable, except where a lesson is technically broken and cannot be opened/used at all — in that case, contact ${SUPPORT_EMAIL} and we will review it individually.`,
    `Trainer earnings are calculated after the platform commission and shown in the payout section.`,
  ]},
  { title: "7. Account restriction and deletion", body: [
    `Accounts that violate these Terms may be temporarily or permanently banned by an admin. You may delete your own account at any time: trainertop.uz/delete-account.`,
  ]},
  { title: "8. Intellectual property", body: [
    `All design, logos, code, and systems on the Platform belong to TrainerTop. Content posted by trainers and users remains their own property; the Platform may display and promote it only within the Platform.`,
  ]},
  { title: "9. Limitation of liability", body: [
    `The Platform is provided "as is". We are not liable for harm arising from trainer advice or from interactions between users, except where the law requires otherwise.`,
  ]},
  { title: "10. Changes and contact", body: [
    `We may update these Terms from time to time; changes will be posted on this page. Questions: ${SUPPORT_EMAIL}, Telegram: @TrainerTop_Support_Bot.`,
  ]},
];

export default function TermsPage({ searchParams }: { searchParams: { lang?: string } }) {
  const isEn = searchParams?.lang === "en";
  const sections = isEn ? en : uz;
  return (
    <div className="min-h-screen bg-dark">
      <div className="container-main max-w-3xl py-10">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white">
            <ArrowLeft className="h-4 w-4" />{isEn ? "Home" : "Bosh sahifa"}
          </Link>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Link href="/terms" className={!isEn ? "text-lime" : "text-white/40 hover:text-white"}>UZ</Link>
            <span className="text-white/20">/</span>
            <Link href="/terms?lang=en" className={isEn ? "text-lime" : "text-white/40 hover:text-white"}>EN</Link>
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-2">{isEn ? "Terms of Use" : "Foydalanish shartlari"}</h1>
        <p className="text-sm text-white/40 mb-10">{isEn ? "Effective date: October 1, 2026" : "Kuchga kirgan sana: 2026-yil 1-oktabr"}</p>

        <div className="prose-custom space-y-8">
          {sections.map((s, i) => (
            <Section key={i} title={s.title}>
              {s.body.map((p, j) => <p key={j}>{p}</p>)}
            </Section>
          ))}
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
