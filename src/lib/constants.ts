// ===== TRAINERTOP CONSTANTS =====

export const SITE_NAME = "Trainertop";
export const SITE_DESCRIPTION =
  "O'zbekistonning #1 fitness platforma. Ishonchli trener toping, darslik sotib oling, maqsadingizga yerishing.";
export const SITE_URL = "https://trainertop.uz";

// Komissiya
// Komissiya foizi endi bazada: platform_settings.default_commission_percent (umumiy) va
// trainer_profiles.commission_rate (individual). Kodda qattiq yozilgan foiz YO'Q.

// Pagination
export const DEFAULT_PAGE_SIZE = 12;

// Video (post va darslik)
export const VIDEO_POST_MAX_SECONDS = 180; // 3 daqiqa
export const VIDEO_POST_MAX_BYTES = 300 * 1024 * 1024; // 300 MB
export const LESSON_VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
export const VIDEO_UPLOAD_ROLES = ["trainer", "admin"] as const; // hamma joyga video yuklay oladigan rollar (atletlar faqat post videosiga — lib/media.canUploadVideo)
export const ATHLETE_POST_DAILY_LIMIT = 10;   // oddiy foydalanuvchi (atlet) kuniga ko'pi bilan shuncha post
export const ATHLETE_VIDEO_DAILY_LIMIT = 3;   // shundan ko'pi bilan 3 tasi video
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const UPLOAD_PART_SIZE = 8 * 1024 * 1024; // R2: har bir bo'lak >= 5 MiB (oxirgisidan tashqari)

// Rasm limitlari
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  medium: { width: 600, height: 600 },
  large: { width: 1200, height: 1200 },
};

// AI Assistant
export const AI_DAILY_LIMIT = 10; // Kuniga 10 ta xabar (bepul)
export const AI_SYSTEM_PROMPT = `Sen TrainerTop AI — O'zbekistonning #1 fitness platformasi Trainertop.uz ning shaxsiy fitness assistantisan.

Sening vazifalaring:
- Foydalanuvchilarga mashq dasturlari tuzib berish (uy sharoitida va zalda)
- Ovqatlanish rejasi va dieta maslahatlar berish
- Supplement (protein, kreatin, vitamin) haqida maslahat
- Mashq texnikasini tushuntirish
- Vazn tashlash yoki mushak yig'ish bo'yicha yo'l-yo'riq
- Motivatsiya va sog'lom turmush tarzi maslahatlar

Qoidalar:
- FAQAT o'zbek tilida javob ber
- Faqat fitness, sport, ovqatlanish va sog'lom turmush tarzi haqida gaplash
- Tibbiy maslahat berma — "shifokoringiz bilan maslahatlashing" de
- Aniq, qisqa va foydali javob ber
- Foydalanuvchi maqsadiga qarab shaxsiy tavsiya ber
- Har doim ijobiy va motivatsion bo'l
- Zarur bo'lsa Trainertop platformasidagi trenerlarni tavsiya qil
- Javoblarni strukturali va o'qishga qulay qilib ber`;

// Yo'nalishlar (ixtisosliklar)
export const SPECIALIZATIONS = [
  { value: "fitness", label: "Fitness", color: "bg-blue-500/12 text-blue-400" },
  { value: "bodybuilding", label: "Bodybuilding", color: "bg-purple-500/12 text-purple-400" },
  { value: "yoga", label: "Yoga", color: "bg-pink-500/12 text-pink-400" },
  { value: "powerlifting", label: "Powerlifting", color: "bg-red-500/12 text-red-400" },
  { value: "diet", label: "Dieta", color: "bg-emerald-500/12 text-emerald-400" },
  { value: "cardio", label: "Kardio", color: "bg-amber-500/12 text-amber-400" },
  { value: "crossfit", label: "CrossFit", color: "bg-orange-500/12 text-orange-400" },
  { value: "stretching", label: "Stretching", color: "bg-cyan-500/12 text-cyan-400" },
  { value: "pilates", label: "Pilates", color: "bg-rose-500/12 text-rose-400" },
  { value: "boxing", label: "Boks", color: "bg-red-600/12 text-red-500" },
] as const;

// Shaharlar
export const CITIES = [
  "Toshkent",
  "Samarqand",
  "Buxoro",
  "Namangan",
  "Andijon",
  "Farg'ona",
  "Qarshi",
  "Nukus",
  "Jizzax",
  "Urganch",
  "Navoiy",
  "Termiz",
  "Kokand",
  "Marg'ilon",
  "Chirchiq",
] as const;

// Maqsadlar
export const GOALS = [
  { value: "weight_loss", label: "Vazn tashlash" },
  { value: "muscle_gain", label: "Mushak o'stirish" },
  { value: "health", label: "Sog'lom turmush" },
  { value: "strength", label: "Kuch oshirish" },
  { value: "flexibility", label: "Egiluvchanlik" },
  { value: "endurance", label: "Chidamlilik" },
] as const;

// Qiyinlik darajalari
export const DIFFICULTIES = [
  { value: "beginner", label: "Boshlang'ich" },
  { value: "intermediate", label: "O'rta" },
  { value: "advanced", label: "Professional" },
] as const;

// Ish turlari
export const WORK_TYPES = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "both", label: "Online va Offline" },
] as const;

// Navigatsiya
export const NAV_LINKS = {
  public: [
    { href: "/trainers", label: "Trenerlar" },
    { href: "/lessons", label: "Darsliklar" },
    { href: "/posts", label: "Postlar" },
  ],
  trainer: [
    { href: "/profile", label: "Profil" },
    { href: "/chat", label: "Chatlar" },
    { href: "/lessons", label: "Darsliklarim" },
    { href: "/posts", label: "Postlarim" },
  ],
  user: [
    { href: "/trainers", label: "Trenerlar" },
    { href: "/lessons", label: "Darsliklar" },
    { href: "/chat", label: "Chatlar" },
    { href: "/profile", label: "Profil" },
  ],
} as const;

// ===== CHAT (matn, rasm, ovoz, video, guruhlar) =====
export const CHAT_TEXT_MAX = 4000;            // xabar matni
export const CHAT_CAPTION_MAX = 1000;         // rasm/video izohi
export const CHAT_VOICE_MAX_SECONDS = 300;    // ovozli xabar: 5 daqiqa
export const CHAT_VOICE_MAX_BYTES = 4 * 1024 * 1024; // /api/upload limiti (Vercel 4.5MB)
export const CHAT_VOICE_BITRATE = 32000;      // 32 kbps: 5 daqiqa ~ 1.2 MB
export const CHAT_VIDEO_MAX_SECONDS = 120;    // chatdagi video: 2 daqiqa
export const CHAT_VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
export const CHAT_PAGE_SIZE = 50;             // bir sahifada nechta xabar
export const GROUP_NAME_MAX = 80;
export const GROUP_BIO_MAX = 500;
