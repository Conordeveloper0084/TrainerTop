-- ============================================================================
-- TRAINERTOP — migration v29: har bir video uchun alohida savol-javob
--   lesson_questions'ga video_title ustuni qo'shiladi — NULL bo'lsa "umumiy darslik savoli"
--   (avvalgidek), to'ldirilgan bo'lsa "shu aniq video haqida savol" (video sarlavhasi matn
--   sifatida saqlanadi — bo'lim/video tartib raqamiga EMAS, chunki trener video qo'shsa/
--   o'chirsa/tartibini o'zgartirsa ham eski savollar to'g'ri video bilan bog'liqligicha qoladi).
-- Bog'liqlik: v8 (lesson_questions). Qayta ishga tushirsa xavfsiz.
-- ============================================================================

ALTER TABLE public.lesson_questions ADD COLUMN IF NOT EXISTS video_title TEXT;
CREATE INDEX IF NOT EXISTS idx_lesson_questions_video ON public.lesson_questions(lesson_id, video_title) WHERE video_title IS NOT NULL;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v29: lesson_questions.video_title' AS tekshiruv,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lesson_questions' AND column_name='video_title')
        THEN 'OK' ELSE 'XATO' END AS natija;
