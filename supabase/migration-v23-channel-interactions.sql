-- ============================================================================
-- TRAINERTOP — migration v23: Rasmiy kanal — tahrirlash, ko'rishlar, izohlar
--   * announcements.edited_at — post tahrirlanganda belgilanadi (Telegram'dagi
--     "tahrirlangan" yorlig'i kabi). Tahrirlashning o'zi TO'G'RIDAN-TO'G'RI jadval
--     yozuvi orqali (DELETE'dagi kabi) — alohida RPC shart emas.
--   * announcement_views — har bir (post, foydalanuvchi) juftligi FAQAT BIR MARTA
--     hisoblanadi; views_count trigger orqali avtomatik yangilanadi.
--   * announcement_comments — kanal postiga (faqat kind='all') izoh; comments_count
--     ham trigger orqali avtomatik.
--   * Mustaqil migratsiya — v16, v17 VA v20 kerak (`announcement_feed`ni to'liq
--     qayta belgilayapmiz, shuning uchun v20'dagi video ustunlari ham kerak).
--     Uchalasi ham allaqachon production'da. v18/v19/v21/v22'ga bog'liq emas.
-- Qayta ishga tushirsa xavfsiz.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tahrirlash izi
-- ---------------------------------------------------------------------------
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Ko'rishlar soni — har (post, user) juftligi bir marta
-- ---------------------------------------------------------------------------
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.announcement_views (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);
ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.announcement_views FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_announcement_views() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.announcements SET views_count = views_count + 1 WHERE id = NEW.announcement_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_announcement_views ON public.announcement_views;
CREATE TRIGGER trg_sync_announcement_views AFTER INSERT ON public.announcement_views
FOR EACH ROW EXECUTE FUNCTION public.sync_announcement_views();

-- announcement_mark_viewed(p_user, p_ids) — berilgan postlarni shu foydalanuvchi uchun
-- "ko'rilgan" deb belgilaydi (allaqachon ko'rilgan bo'lsa hech narsa o'zgarmaydi — ON CONFLICT
-- DO NOTHING, trigger qayta ishlamaydi). Yangilangan ko'rishlar sonini {id: son} shaklida qaytaradi.
CREATE OR REPLACE FUNCTION public.announcement_mark_viewed(p_user uuid, p_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN RETURN '{}'::jsonb; END IF;
  INSERT INTO public.announcement_views (announcement_id, user_id)
    SELECT DISTINCT x, p_user FROM unnest(p_ids) AS x
    WHERE EXISTS (SELECT 1 FROM public.announcements WHERE id = x)
  ON CONFLICT DO NOTHING;
  RETURN (SELECT coalesce(jsonb_object_agg(id, views_count), '{}'::jsonb) FROM public.announcements WHERE id = ANY(p_ids));
END $$;

REVOKE ALL ON FUNCTION public.announcement_mark_viewed(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.announcement_mark_viewed(uuid, uuid[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Izohlar — faqat kanal postiga (kind='all'), yozish/o'chirish TO'G'RIDAN-TO'G'RI
--    jadval orqali (huquq tekshiruvi backend'da — muallif yoki admin, DELETE'dagi kabi)
-- ---------------------------------------------------------------------------
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  deleted_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS announcement_comments_ann_idx ON public.announcement_comments (announcement_id, created_at);
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.announcement_comments FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_announcement_comment_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.announcements SET comments_count = comments_count + 1 WHERE id = NEW.announcement_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE public.announcements SET comments_count = greatest(0, comments_count - 1) WHERE id = NEW.announcement_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE public.announcements SET comments_count = comments_count + 1 WHERE id = NEW.announcement_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_announcement_comment_count ON public.announcement_comments;
CREATE TRIGGER trg_sync_announcement_comment_count AFTER INSERT OR UPDATE ON public.announcement_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_announcement_comment_count();

-- ---------------------------------------------------------------------------
-- 4. announcement_feed(...): edited_at, views_count, comments_count qo'shildi
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.announcement_feed(p_user uuid, p_before timestamptz, p_limit int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(x.item ORDER BY x.created_at ASC), '[]'::jsonb)
  FROM (
    SELECT a.created_at,
      jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'title', a.title, 'body', a.body, 'image_url', a.image_url,
        'video_url', a.video_url, 'video_thumbnail_url', a.video_thumbnail_url, 'video_duration', a.video_duration,
        'link_url', a.link_url, 'link_label', a.link_label, 'created_at', a.created_at,
        'edited_at', a.edited_at, 'views_count', a.views_count, 'comments_count', a.comments_count,
        'lesson', CASE WHEN a.lesson_id IS NULL THEN NULL ELSE (
            SELECT jsonb_build_object('id', l.id, 'title', l.title, 'cover_image_url', l.cover_image_url, 'price', l.price,
                     'price_lifetime', l.price_lifetime, 'price_monthly', l.price_monthly, 'pricing_model', l.pricing_model,
                     'trainer_name', CASE WHEN coalesce((to_jsonb(l) ->> 'is_platform')::boolean, false) THEN 'TrainerTop' ELSE p.full_name END)
              FROM public.lessons l JOIN public.profiles p ON p.id = l.trainer_id WHERE l.id = a.lesson_id) END
      ) AS item
    FROM public.announcements a
    WHERE a.deleted_at IS NULL AND (a.kind = 'all' OR a.target_user_id = p_user) AND public.announcement_lesson_ok(a.lesson_id)
      AND (p_before IS NULL OR a.created_at < p_before)
    ORDER BY a.created_at DESC
    LIMIT greatest(1, least(coalesce(p_limit, 30), 100))
  ) x
$$;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v23: tahrirlash/ko''rishlar/izohlar' AS tekshiruv,
       CASE WHEN to_regclass('public.announcement_views') IS NOT NULL
             AND to_regclass('public.announcement_comments') IS NOT NULL
             AND to_regprocedure('public.announcement_mark_viewed(uuid,uuid[])') IS NOT NULL
             AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='announcements' AND column_name IN ('edited_at','views_count','comments_count')) = 3
        THEN 'OK' ELSE 'XATO' END AS natija;
