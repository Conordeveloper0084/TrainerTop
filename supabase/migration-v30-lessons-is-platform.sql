-- ============================================================================
-- TRAINERTOP — migration v30: lessons.is_platform (platforma darsliklari belgisi)
--
-- NIMA UCHUN: `is_platform` ustuni kodda ishlatiladi (GET /api/lessons?platform=true, admin darslik
-- yaratish/tahrirlash, "PLATFORMA" belgisi, v12 `protect_lessons` triggeri), lekin uni YARATUVCHI
-- migratsiya repoda yo'q edi — production'da qo'lda/boshqa chatda qo'shilgan. Yangi muhit
-- (staging/lokal/qayta tiklash) ko'tarilsa, ustun yetishmay `?platform=true` va admin sahifalari
-- xato berardi.
--
-- XAVFSIZLIK: ADD COLUMN IF NOT EXISTS — production'da ustun allaqachon bor bo'lsa HECH NARSA
-- O'ZGARMAYDI (turi/NULL-ruxsati/default'i o'sha-o'sha qoladi). Faqat ustun yo'q bo'lsa yaratadi.
-- Kodning o'zi ikkala holatni (NULL yoki false) ko'taradi: admin ro'yxatida
-- `is_platform.is.null OR is_platform.eq.false` ishlatilgan.
-- Production'dagi haqiqiy ta'rifni ko'rish: supabase/verify-v28-v30.sql (oxirgi qator).
-- Qayta ishga tushirsa xavfsiz.
-- ============================================================================

ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS is_platform boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v30: lessons.is_platform' AS tekshiruv,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lessons' AND column_name='is_platform')
        THEN 'OK' ELSE 'XATO' END AS natija;
