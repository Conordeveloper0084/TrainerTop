import { z } from "zod";

// ===== AUTH =====
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email kiriting")
    .email("Email noto'g'ri formatda"),
  password: z
    .string()
    .min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak"),
});

export const registerSchema = z.object({
  full_name: z
    .string()
    .min(2, "Ism kamida 2 ta harfdan iborat bo'lishi kerak")
    .max(50, "Ism juda uzun"),
  email: z
    .string()
    .min(1, "Email kiriting")
    .email("Email noto'g'ri formatda"),
  password: z
    .string()
    .min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak")
    .max(100, "Parol juda uzun"),
  role: z.enum(["trainer", "user"], {
    required_error: "Rolni tanlang",
  }),
});

// ===== TRAINER PROFILE =====
export const trainerProfileSchema = z.object({
  bio: z.string().max(500, "Bio juda uzun").optional(),
  experience_years: z
    .number()
    .min(0, "Tajriba 0 dan kam bo'lmaydi")
    .max(50, "Tajriba 50 dan oshmasin"),
  age: z.number().min(16, "Yosh 16 dan kam bo'lmaydi").max(80).optional(),
  gender: z.enum(["male", "female"]).optional(),
  specializations: z
    .array(z.string())
    .min(1, "Kamida 1 ta yo'nalish tanlang")
    .max(5, "Ko'pi bilan 5 ta yo'nalish"),
  work_type: z.enum(["online", "offline", "both"]),
  city: z.string().optional(),
  gym_name: z.string().max(100).optional(),
  gym_address: z.string().max(200).optional(),
});

// ===== LESSON =====
export const lessonSchema = z.object({
  title: z
    .string()
    .min(3, "Sarlavha kamida 3 ta harf")
    .max(100, "Sarlavha juda uzun"),
  description: z
    .string()
    .min(20, "Tavsif kamida 20 ta harf")
    .max(2000, "Tavsif juda uzun"),
  price: z
    .number()
    .min(1000, "Minimal narx 1,000 so'm")
    .max(10000000, "Narx juda yuqori"),
  category: z.string().min(1, "Kategoriya tanlang"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  content: z
    .array(
      z.object({
        title: z.string().min(1, "Bo'lim sarlavhasi kerak"),
        body: z.string().min(1, "Bo'lim matni kerak"),
        image_url: z.string().optional(),
      })
    )
    .min(1, "Kamida 1 ta bo'lim kerak"),
});

// ===== POST =====
export const postSchema = z.object({
  caption: z.string().max(1000, "Izoh juda uzun").optional(),
  is_before_after: z.boolean().default(false),
});

// ===== REVIEW =====
export const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().max(500, "Sharh juda uzun").optional(),
});

// ===== CHAT =====
export const messageSchema = z.object({
  content: z.string().min(1, "Xabar bo'sh bo'lmasin").max(2000, "Xabar juda uzun"),
});

// Types
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type TrainerProfileFormData = z.infer<typeof trainerProfileSchema>;
export type LessonFormData = z.infer<typeof lessonSchema>;
export type PostFormData = z.infer<typeof postSchema>;
export type ReviewFormData = z.infer<typeof reviewSchema>;
export type MessageFormData = z.infer<typeof messageSchema>;
