-- =============================================
-- TRAINERTOP MIGRATION v11
-- Video post: posts jadvaliga video ustunlari
-- =============================================
-- MUHIM: bu SQL'ni KODNI DEPLOY QILISHDAN OLDIN Supabase SQL Editor'da ishga tushiring.
-- (Aks holda video post yaratish xato beradi; oddiy rasmli postlar ishlayveradi.)
-- Bir necha marta ishga tushirsa ham xavfsiz (idempotent).

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS video_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS video_duration INTEGER;  -- soniyada

-- Davomiylik 1..180 soniya (3 daqiqa)
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_video_duration_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_video_duration_check
  CHECK (video_duration IS NULL OR (video_duration >= 1 AND video_duration <= 180));

-- Postda rasm va video birga bo'lmaydi
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_media_exclusive_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_media_exclusive_check
  CHECK (video_url IS NULL OR COALESCE(array_length(images, 1), 0) = 0);

-- Tekshiruv (natija: 3 ta qator — video_url, video_thumbnail_url, video_duration)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'posts' AND column_name LIKE 'video_%'
ORDER BY column_name;
