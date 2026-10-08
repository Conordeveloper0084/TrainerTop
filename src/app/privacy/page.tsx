import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/constants";

export const metadata = { title: "Maxfiylik siyosati — TrainerTop" };

interface Sec { title: string; body: string[] }

const uz: Sec[] = [
  { title: "1. Kim ma'lumot yig'adi", body: [
    `Ushbu sahifa trainertop.uz veb-sayti va TrainerTop Android ilovasi (birgalikda — "TrainerTop", "Platforma") orqali to'plangan ma'lumotlarga tegishli.`,
    `Savol yoki so'rovlar uchun: ${SUPPORT_EMAIL}, yoki Telegram orqali @TrainerTop_Support_Bot.`,
  ]},
  { title: "2. Qanday ma'lumot to'playmiz", body: [
    `Akkaunt: email, to'liq ism, parol (xavfsiz, qaytarib bo'lmaydigan ko'rinishda saqlanadi — hech kim, jumladan biz ham, uni ko'ra olmaymiz), shuningdek ixtiyoriy ravishda profil rasmi, telefon raqami va @username.`,
    `Trener profili (trener bo'lsangiz): tajriba yillari, yo'nalishlar, ish turi, shahar, bio, ixtiyoriy ravishda zal nomi/manzili/rasmlari, darslik narxlari. Pul yechish so'rovida bank karta raqami va egasining ismi so'raladi — standart holatda profilingizga saqlanmaydi, har safar qaytadan kiritiladi. Xohlasangiz, kartani keyingi safar qayta kiritmaslik uchun saqlashni tanlashingiz mumkin — bu holda karta raqami ILOVA DARAJASIDA shifrlangan holda (AES-256) saqlanadi, bazada ochiq ko'rinishda hech qachon turmaydi, uchinchi tomonga berilmaydi va istalgan vaqt profil sozlamalaridan o'chirishingiz mumkin.`,
    `Oddiy foydalanuvchi profili (ixtiyoriy): yosh, jins, fitnes maqsadi, tajriba darajasi, qiziqishlar.`,
    `Siz yaratgan kontent: postlar (matn, rasm, video), izohlar, trenerlarga yozgan sharhlaringiz (reyting + matn), darslikka savollaringiz, 1:1 va darslik guruhidagi chat xabarlaringiz (matn, rasm, ovozli xabar, video).`,
    `Xaridlar tarixi: qaysi darslikni qachon, qancha summaga va qanday holatda sotib olganingiz. To'lov kartangizning raqami bizga umuman kelmaydi va bizning serverlarimizda saqlanmaydi — buni Click to'lov tizimining o'z sahifasi qayta ishlaydi.`,
    `Agar TrainerTop ilovasini telefoningizga o'rnatib, bildirishnomalarga ruxsat bersangiz — qurilmangizning push-token (bildirishnoma identifikatori) saqlanadi.`,
    `Ilova (faqat Android ilovada, saytda emas) nosozlikka uchraganda, xatoni tuzatishimiz uchun avtomatik nosozlik hisoboti (Firebase Crashlytics orqali) yuborilishi mumkin.`,
    `Har qanday veb-xizmat kabi, serverlarimiz (Vercel, Supabase) so'rov darajasida IP manzil va qurilma/brauzer turi kabi texnik ma'lumotlarni odatiy tartibda qayd etadi; biz bu ma'lumotni alohida to'plab, kuzatuv (tracking) maqsadida ishlatmaymiz.`,
  ]},
  { title: "3. Ma'lumotlardan nima uchun foydalanamiz", body: [
    `Akkauntingizni yaratish va boshqarish, trener va foydalanuvchini bir-biriga topishiga yordam berish; to'lovlarni qayta ishlash va trener daromadini hisoblash; sizga postlar, darsliklar va xabarlarni ko'rsatish; push va qo'ng'iroq (bell) bildirishnomalari yuborish; qo'llab-quvvatlash so'rovlaringizga javob berish.`,
    `Platforma xavfsizligi: shikoyat va bloklash tizimini ishga tushirish, qoidabuzarlarni cheklash/ban qilish. Admin aniq bir darslik guruhi suhbatini qo'lda ko'rib chiqqanda, suhbat matni (ismlar "Trener"/"A'zo 1" kabi almashtirilgan holda, rasm/ovoz/video YO'Q) tahlil uchun OpenAI'ga yuborilishi mumkin — bu faqat admin ataylab ishga tushirganda sodir bo'ladi, avtomatik emas.`,
    `"TrainerTop AI" yordamchisiga yozgan xabarlaringiz javob yaratish uchun OpenAI'ga yuboriladi.`,
  ]},
  { title: "4. Uchinchi tomon xizmatlar", body: [
    `Platformani ishga tushirish uchun quyidagi xizmatlardan foydalanamiz — faqat shular, va faqat quyida yozilgan maqsadda:`,
    `• Supabase — ma'lumotlar bazasi va ro'yxatdan o'tish/kirish tizimi`,
    `• Vercel — veb-saytni joylashtirish (hosting)`,
    `• Cloudflare — rasm, video va ovozli xabarlarni saqlash`,
    `• Click — to'lovlarni qayta ishlash (karta raqamingiz bizga kelmaydi)`,
    `• Resend — email yuborish (parolni tiklash, email tasdiqlash, qo'llab-quvvatlash javoblari)`,
    `• Google — ixtiyoriy "Google orqali kirish"`,
    `• OpenAI — AI yordamchi suhbatlari va (faqat admin ishga tushirganda) anonimlashtirilgan guruh suhbati tahlili`,
    `• Firebase Cloud Messaging (Google) — ilovaga push bildirishnoma yetkazish`,
    `• Firebase Crashlytics (Google) — faqat ilovada, nosozlik hisobotlari uchun`,
    `• Telegram — qo'llab-quvvatlashga yozsangiz, xabaringiz va javobimiz @TrainerTop_Support_Bot tizimi orqali ham o'tishi mumkin`,
    `Shaxsiy ma'lumotlaringizni hech qachon reklama beruvchilarga sotmaymiz, va TrainerTop'da reklama kuzatuvi (ad tracking) ishlatilmaydi. Qonun talab qilgan hollarda (sud qarori, qonun ijro organi so'rovi) ma'lumot berishga majbur bo'lishimiz mumkin.`,
  ]},
  { title: "5. Cookie va seanslar", body: [
    `Sayt faqat kirish holatingizni saqlash uchun zarur bo'lgan seans (session) cookie'laridan foydalanadi. Marketing yoki kuzatuv maqsadidagi cookie'lar ishlatilmaydi.`,
  ]},
  { title: "6. Qancha vaqt saqlanadi", body: [
    `Ma'lumotlaringiz akkauntingiz faol ekanligi davomida saqlanadi. Akkauntni o'chirsangiz, profilingiz shaxsni aniqlab bo'lmaydigan holga keltiriladi; xaridlar va moliyaviy yozuvlar qonuniy hisobot talablariga ko'ra anonim holda saqlanib qoladi. Batafsil: trainertop.uz/delete-account.`,
  ]},
  { title: "7. Sizning huquqlaringiz", body: [
    `Profil ma'lumotlaringizni istalgan vaqt ko'rish va tahrirlash huquqiga egasiz (Profil → Sozlamalar). Akkauntingizni va unga bog'liq shaxsiy ma'lumotlarni o'chirishni so'rash huquqiga egasiz — buni saytda yoki ilovada o'zingiz amalga oshirishingiz mumkin: trainertop.uz/delete-account. Savollaringiz bo'lsa ${SUPPORT_EMAIL} ga yozing.`,
  ]},
  { title: "8. 13 yoshdan kichiklar", body: [
    `TrainerTop 13 yoshdan kichik shaxslar uchun mo'ljallanmagan va biz ularning ma'lumotlarini ataylab to'plamaymiz. Agar shunday ma'lumot borligini aniqlasak, uni darhol o'chiramiz.`,
  ]},
  { title: "9. O'zgarishlar", body: [
    `Ushbu siyosatni vaqti-vaqti bilan yangilashimiz mumkin. O'zgarishlar shu sahifada e'lon qilinadi, va yuqoridagi sana yangilanadi.`,
  ]},
  { title: "10. Bog'lanish", body: [
    `Email: ${SUPPORT_EMAIL}`,
    `Telegram: @TrainerTop_Support_Bot`,
  ]},
];

const en: Sec[] = [
  { title: "1. Who collects this data", body: [
    `This page covers data collected through the trainertop.uz website and the TrainerTop Android app (together, "TrainerTop", "we", "the Platform").`,
    `For questions or requests, contact us at ${SUPPORT_EMAIL} or via Telegram at @TrainerTop_Support_Bot.`,
  ]},
  { title: "2. What we collect", body: [
    `Account: email, full name, password (stored in a secure, non-reversible form — nobody, including us, can see it), and optionally a profile photo, phone number, and @username.`,
    `Trainer profile (if you become a trainer): years of experience, specializations, work type, city, bio, and optionally gym name/address/photos, lesson prices. When you request a payout, we ask for your bank card number and cardholder name — by default this is not saved and is entered fresh each time. If you choose to, you can save the card so you don't have to re-enter it next time — in that case the card number is encrypted at the application level (AES-256), never stored in plain text in our database, never shared with a third party, and you can delete it at any time from your profile settings.`,
    `Regular user profile (optional): age, gender, fitness goal, experience level, interests.`,
    `Content you create: posts (text, images, video), comments, your reviews of trainers (rating + text), questions you ask about a lesson, and your chat messages (text, images, voice messages, video) in 1:1 chats and lesson-group chats.`,
    `Purchase history: which lesson, when, how much, and its status. Your payment card number never reaches us and is never stored on our servers — Click's own payment page handles that.`,
    `If you install the TrainerTop app and allow notifications, your device's push token (a notification identifier) is stored.`,
    `In the Android app only (not the website), if the app crashes, an automatic crash report (via Firebase Crashlytics) may be sent to help us fix the bug.`,
    `Like any web service, our infrastructure providers (Vercel, Supabase) log standard request-level technical data such as IP address and device/browser type as part of normal operation; we don't separately collect this for tracking purposes.`,
  ]},
  { title: "3. Why we use it", body: [
    `To create and manage your account, help trainers and users find each other, process payments and calculate trainer earnings, show you posts/lessons/messages, send push and in-app (bell) notifications, and respond to your support requests.`,
    `Platform safety: to run the report and block system, and to restrict or ban accounts that break the rules. When an admin manually reviews a specific lesson-group chat, the conversation text (names replaced with "Trainer"/"Member 1", etc., no images/audio/video) may be sent to OpenAI for a summary — this only happens when an admin deliberately triggers it, never automatically.`,
    `Messages you send to the "TrainerTop AI" assistant are sent to OpenAI to generate a reply.`,
  ]},
  { title: "4. Third-party services", body: [
    `We rely on the following services to run the Platform — only these, and only for the purpose listed:`,
    `• Supabase — database and sign-up/login`,
    `• Vercel — website hosting`,
    `• Cloudflare — storage for images, videos, and voice messages`,
    `• Click — payment processing (your card number never reaches us)`,
    `• Resend — sending emails (password reset, email confirmation, support replies)`,
    `• Google — optional "Sign in with Google"`,
    `• OpenAI — AI assistant conversations, and (only when an admin triggers it) anonymized group-chat analysis`,
    `• Firebase Cloud Messaging (Google) — delivering push notifications to the app`,
    `• Firebase Crashlytics (Google) — app-only, for crash reports`,
    `• Telegram — if you message support, your message and our reply may also pass through our Telegram-based support system (@TrainerTop_Support_Bot)`,
    `We never sell your personal data to advertisers, and TrainerTop does not use ad tracking. We may disclose data if required by law (e.g., a court order or law-enforcement request).`,
  ]},
  { title: "5. Cookies and sessions", body: [
    `The website uses only the session cookies needed to keep you signed in. We do not use marketing or tracking cookies.`,
  ]},
  { title: "6. How long we keep it", body: [
    `Your data is kept while your account is active. If you delete your account, your profile is anonymized; purchase and financial records are retained in anonymized form as required for recordkeeping. Details: trainertop.uz/delete-account.`,
  ]},
  { title: "7. Your rights", body: [
    `You can view and edit your profile data at any time (Profile → Settings). You can request deletion of your account and the personal data tied to it, which you can do yourself on the website or in the app: trainertop.uz/delete-account. For any questions, email ${SUPPORT_EMAIL}.`,
  ]},
  { title: "8. Children under 13", body: [
    `TrainerTop is not directed at children under 13, and we do not knowingly collect their data. If we learn we have, we delete it promptly.`,
  ]},
  { title: "9. Changes", body: [
    `We may update this policy from time to time. Changes will be posted on this page, and the date above will be updated.`,
  ]},
  { title: "10. Contact", body: [
    `Email: ${SUPPORT_EMAIL}`,
    `Telegram: @TrainerTop_Support_Bot`,
  ]},
];

export default function PrivacyPage({ searchParams }: { searchParams: { lang?: string } }) {
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
            <Link href="/privacy" className={!isEn ? "text-lime" : "text-white/40 hover:text-white"}>UZ</Link>
            <span className="text-white/20">/</span>
            <Link href="/privacy?lang=en" className={isEn ? "text-lime" : "text-white/40 hover:text-white"}>EN</Link>
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-2">{isEn ? "Privacy Policy" : "Maxfiylik siyosati"}</h1>
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
