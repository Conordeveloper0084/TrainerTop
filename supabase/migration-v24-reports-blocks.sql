-- ============================================================================
-- TRAINERTOP — migration v24: Umumiy shikoyat (report) va foydalanuvchini bloklash
--   * Hozirgacha faqat CHAT xabariga shikoyat bor edi (chat_reports). Endi post,
--     izoh, sharh va foydalanuvchining o'ziga ham shikoyat qilish mumkin (Play
--     Market UGC siyosati talab qiladi).
--   * Bloklash: bir tomonlama — bloklangan odamning post/izoh/sharhi FAQAT
--     bloklagan foydalanuvchining o'z lentasida ko'rinmay qoladi.
--   * Mustaqil migratsiya — asosiy sxema (profiles, posts, post_comments, reviews,
--     lessons) yetarli, boshqa v-migratsiyalarga bog'liq emas.
-- Qayta ishga tushirsa xavfsiz.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment', 'user', 'lesson')),
  target_id   uuid NOT NULL,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      text NOT NULL,
  note        text,
  snapshot    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (target_type, target_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS reports_target_idx ON public.reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS reports_created_idx ON public.reports (created_at DESC);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reports FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON public.blocks (blocked_id);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blocks FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v24: reports va blocks' AS tekshiruv,
       CASE WHEN to_regclass('public.reports') IS NOT NULL AND to_regclass('public.blocks') IS NOT NULL
        THEN 'OK' ELSE 'XATO' END AS natija;
