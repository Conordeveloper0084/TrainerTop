-- ============================================================================
-- Production bazada v28, v29 (va v30) migratsiyalari ishga tushganini TEKSHIRISH.
-- Faqat O'QIYDI (hech narsani o'zgartirmaydi) — Supabase SQL Editor'da bemalol ishga tushiring.
-- Har bir qatorda holat: OK  yoki  YO'Q. Oxirgi qatorlar — xulosa va is_platform ning haqiqiy ta'rifi.
-- ============================================================================
WITH col AS (
  SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns WHERE table_schema = 'public'
),
checks AS (
  SELECT 1 AS n, 'v8 (talab)'  AS migratsiya, 'lesson_questions jadvali'            AS tekshiruv,
         to_regclass('public.lesson_questions') IS NOT NULL AS ok, ''::text AS tafsilot
  UNION ALL
  SELECT 2, 'v25 (talab)', 'device_tokens jadvali',
         to_regclass('public.device_tokens') IS NOT NULL, ''
  UNION ALL
  SELECT 3, 'v28', 'device_tokens.web_push_keys (jsonb)',
         EXISTS (SELECT 1 FROM col WHERE table_name='device_tokens' AND column_name='web_push_keys' AND data_type='jsonb'),
         COALESCE((SELECT 'hozirgi tur: ' || data_type FROM col WHERE table_name='device_tokens' AND column_name='web_push_keys'), 'ustun yo''q')
  UNION ALL
  SELECT 4, 'v29', 'lesson_questions.video_title (text)',
         EXISTS (SELECT 1 FROM col WHERE table_name='lesson_questions' AND column_name='video_title' AND data_type='text'),
         COALESCE((SELECT 'hozirgi tur: ' || data_type FROM col WHERE table_name='lesson_questions' AND column_name='video_title'), 'ustun yo''q')
  UNION ALL
  SELECT 5, 'v29', 'indeks idx_lesson_questions_video',
         to_regclass('public.idx_lesson_questions_video') IS NOT NULL, '(indeks bo''lmasa ham ishlaydi, faqat tezlik uchun)'
  UNION ALL
  SELECT 6, 'v30', 'lessons.is_platform (boolean)',
         EXISTS (SELECT 1 FROM col WHERE table_name='lessons' AND column_name='is_platform' AND data_type='boolean'),
         COALESCE((SELECT data_type || ', NULL ruxsati=' || is_nullable || ', default=' || COALESCE(column_default, 'yo''q')
                   FROM col WHERE table_name='lessons' AND column_name='is_platform'), 'ustun yo''q')
)
SELECT n, migratsiya, tekshiruv, CASE WHEN ok THEN 'OK' ELSE 'YO''Q' END AS holat, tafsilot FROM checks
UNION ALL
SELECT 99, 'XULOSA', 'hammasi joyidami?',
       CASE WHEN bool_and(ok) FILTER (WHERE n <> 5) THEN 'HAMMASI OK' ELSE 'YETISHMAYDI' END,
       COALESCE(string_agg(migratsiya, ', ' ORDER BY n) FILTER (WHERE NOT ok AND n <> 5), 'yetishmaydigan migratsiya yo''q')
FROM checks
ORDER BY n;
