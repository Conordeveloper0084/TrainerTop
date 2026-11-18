-- ============================================================================
-- TRAINERTOP — migration v32: video savol/javoblarini darslik guruhiga aks ettirish
--
-- Darslikdagi VIDEO bo'yicha savol (POST /api/lessons/{id}/questions, video_title bilan) va trenerning BIRINCHI
-- javobi darslikning guruh chatiga oddiy matn xabari sifatida tushadi. Ilovalar chiroyli belgi chizishi uchun
-- `messages` ga uchta IXTIYORIY (nullable) maydon qo'shiladi; boshqa xabarlarda ular NULL.
--
--   video_title          — qaysi video haqida (savol/javob xabarida)
--   lesson_question_id   — qaysi savolga tegishli (lesson_questions.id); savol o'chsa NULL bo'ladi, xabar qoladi
--   lesson_question_kind — 'question' (savol) | 'answer' (trener javobi)
--
-- Takrorlanmaslik: bitta savol uchun bitta 'question' va bitta 'answer' xabari (qayta urinish/poyga holatida
-- ikkinchisi baza darajasida rad etiladi — API buni "allaqachon aks ettirilgan" deb qabul qiladi).
-- Himoya: oddiy foydalanuvchi (anon/authenticated) bu maydonlarni to'g'ridan-to'g'ri yoza/o'zgartira OLMAYDI
-- (trigger NULL qiladi) — aks holda kimdir soxta "javob" belgisini qo'yib, haqiqiy aks ettirishni bloklashi mumkin edi.
-- Faqat server (service_role) yozadi.
-- Bog'liqlik: v8 (lesson_questions), v13 (messages.group_id). Qayta ishga tushirsa xavfsiz.
-- ============================================================================

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS video_title          text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS lesson_question_id   uuid REFERENCES public.lesson_questions(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS lesson_question_kind text;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_lq_kind_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_lq_kind_check
  CHECK (lesson_question_kind IS NULL OR lesson_question_kind IN ('question', 'answer'));
-- kind faqat savol bilan birga ma'noga ega (savol o'chib NULL bo'lganda kind qolishi mumkin, aksincha emas)
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_lq_pair_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_lq_pair_check
  CHECK (lesson_question_id IS NULL OR lesson_question_kind IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_lesson_question_kind
  ON public.messages (lesson_question_id, lesson_question_kind) WHERE lesson_question_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.messages_protect_lq() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.video_title := NULL; NEW.lesson_question_id := NULL; NEW.lesson_question_kind := NULL;
    ELSE
      NEW.video_title := OLD.video_title; NEW.lesson_question_id := OLD.lesson_question_id; NEW.lesson_question_kind := OLD.lesson_question_kind;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS messages_protect_lq ON public.messages;
CREATE TRIGGER messages_protect_lq BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_protect_lq();

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v32: messages.video_title / lesson_question_id / lesson_question_kind' AS tekshiruv,
       CASE WHEN (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages'
                    AND column_name IN ('video_title', 'lesson_question_id', 'lesson_question_kind')) = 3
             AND to_regclass('public.uq_messages_lesson_question_kind') IS NOT NULL
             AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'messages_protect_lq' AND NOT tgisinternal)
        THEN 'OK' ELSE 'XATO' END AS natija;
