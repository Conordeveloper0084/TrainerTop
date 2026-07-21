import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind class birlashtirish (shadcn/ui standart)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Narxni formatlash: 50000 → "50 000 so'm"
export function formatPrice(price: number): string {
  const formatted = price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${formatted} so'm`;
}

// Lesson narxini chiroyli formatlash — pricing model'ga qarab
export function formatLessonPrice(lesson: {
  price?: number;
  pricing_model?: string;
  price_lifetime?: number;
  price_monthly?: number;
}): { display: string; sub?: string } {
  const model = lesson.pricing_model || "lifetime";
  const lifetime = lesson.price_lifetime || lesson.price || 0;
  const monthly = lesson.price_monthly || 0;

  if (model === "monthly" && monthly > 0) {
    return { display: formatPrice(monthly), sub: "/oy" };
  }
  if (model === "both" && monthly > 0 && lifetime > 0) {
    return { display: `${formatPrice(monthly)}/oy`, sub: `yoki ${formatPrice(lifetime)}` };
  }
  return { display: formatPrice(lifetime || monthly || 0) };
}

// Vaqtni formatlash: "2 soat oldin", "3 kun oldin"
export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals: [number, string][] = [
    [31536000, "yil"],
    [2592000, "oy"],
    [604800, "hafta"],
    [86400, "kun"],
    [3600, "soat"],
    [60, "daqiqa"],
  ];

  for (const [secondsInInterval, label] of intervals) {
    const count = Math.floor(seconds / secondsInInterval);
    if (count >= 1) {
      return `${count} ${label} oldin`;
    }
  }

  return "hozirgina";
}

// Rasm URL yaratish (Supabase Storage)
export function getImageUrl(bucket: string, path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

// Ismning birinchi harflarini olish (avatar uchun)
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Reytingni yulduzcha formatda
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

// Yo'nalishni o'zbekchaga tarjima qilish
export function getSpecializationLabel(spec: string): string {
  const labels: Record<string, string> = {
    fitness: "Fitness",
    bodybuilding: "Bodybuilding",
    yoga: "Yoga",
    powerlifting: "Powerlifting",
    diet: "Dieta",
    cardio: "Kardio",
    crossfit: "CrossFit",
    stretching: "Stretching",
    pilates: "Pilates",
    boxing: "Boks",
  };
  return labels[spec] || spec;
}

// Ish turini o'zbekchaga
export function getWorkTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    online: "Online",
    offline: "Offline",
    both: "Online va Offline",
  };
  return labels[type] || type;
}

// Qiyinlik darajasini o'zbekchaga
export function getDifficultyLabel(level: string): string {
  const labels: Record<string, string> = {
    beginner: "Boshlang'ich",
    intermediate: "O'rta",
    advanced: "Professional",
  };
  return labels[level] || level;
}

// Kategoriya rangini olish
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    fitness: "bg-blue-500/12 text-blue-400",
    bodybuilding: "bg-purple-500/12 text-purple-400",
    yoga: "bg-pink-500/12 text-pink-400",
    powerlifting: "bg-red-500/12 text-red-400",
    diet: "bg-emerald-500/12 text-emerald-400",
    cardio: "bg-amber-500/12 text-amber-400",
    crossfit: "bg-orange-500/12 text-orange-400",
    stretching: "bg-cyan-500/12 text-cyan-400",
    pilates: "bg-rose-500/12 text-rose-400",
    boxing: "bg-red-600/12 text-red-500",
  };
  return colors[category] || "bg-white/8 text-white/60";
}

// So'mni komissiya bilan hisoblash
export function calculateCommission(price: number, rate: number = 0.1) {
  const commission = Math.round(price * rate);
  const trainerAmount = price - commission;
  return { commission, trainerAmount };
}

// Telefon raqamni formatlash: +998901234567 → +998 90 123 45 67
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 12 && cleaned.startsWith("998")) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10)}`;
  }
  return phone;
}

// Slug yaratish: "Akbar Karimov" → "akbar-karimov"
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
