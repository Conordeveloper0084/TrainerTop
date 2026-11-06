-- ============================================================================
-- TRAINERTOP — migration v31: 1:1 suhbatni "o'zim uchun o'chirish" (soft delete)
--
-- Har bir ishtirokchi suhbatni FAQAT O'ZI uchun yashirishi mumkin: ro'yxatdan yo'qoladi va eski xabarlar
-- ko'rinmaydi; suhbatdosh uchun hech narsa o'zgarmaydi. Yangi xabar kelsa suhbat ro'yxatga qaytadi,
-- lekin faqat yangi xabarlar bilan (WhatsApp/Telegram "chatni tozalash" kabi).
--
-- NEGA ALOHIDA JADVAL (conversations'ga ustun emas): `conversations` da "participant update" siyosati bor va
-- ustunlarni qulflaydigan trigger yo'q — ya'ni ishtirokchi qatorni to'g'ridan-to'g'ri o'zgartira oladi. Belgini
-- shu jadvalga qo'ysak, suhbatdosh SIZNING chatingizni yashirib qo'yishi mumkin bo'lardi. Bu jadvalga faqat
-- server (service_role) yoza/o'qiy oladi: anon/authenticated uchun huquqlar olib tashlangan, siyosat yo'q.
--
-- Eslatma: bu API darajasidagi yashirish. `messages` jadvalidagi qatorlar o'chmaydi; Supabase'ga
-- to'g'ridan-to'g'ri (Realtime/REST) ulangan mijoz eski xabarlarni baribir ko'ra oladi.
-- Bog'liqlik: v3 (conversations). Qayta ishga tushirsa xavfsiz.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_clears (
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  cleared_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS conversation_clears_user_idx ON public.conversation_clears (user_id);

ALTER TABLE public.conversation_clears ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_clears FROM anon, authenticated;
GRANT ALL ON public.conversation_clears TO service_role;   -- API (supabaseAdmin) shu rol bilan ishlaydi; aniq yozib qo'yildi

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v31: conversation_clears' AS tekshiruv,
       CASE WHEN to_regclass('public.conversation_clears') IS NOT NULL THEN 'OK' ELSE 'XATO' END AS natija;
