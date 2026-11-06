-- ============================================================================
-- TRAINERTOP — migration v20: Rasmiy kanalni professional qilish
--   * Kanal identifikatori: nom, rasm, bio, @username (hozircha qidiruvga ulanmagan)
--   * E'lonlar endi ERKIN POST bo'lishi mumkin: sarlavha IXTIYORIY, video ham bo'ladi,
--     kamida bittasi kerak (matn YOKI rasm YOKI video) — Telegram kanali kabi
--   * Bog'liqlik: v16 (announcements) VA v17 (announcement_feed, lesson boost) kerak —
--     ikkalasi ham allaqachon production'da ishlab turibdi. v18/v19'ga bog'liq emas.
-- Qayta ishga tushirsa xavfsiz. Kodni deploy qilishdan OLDIN ishga tushiring.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kanal identifikatori (bitta qator — singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channel_settings (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name        text NOT NULL DEFAULT 'TrainerTop' CHECK (char_length(name) BETWEEN 1 AND 40),
  avatar_url  text CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 500),
  bio         text CHECK (bio IS NULL OR char_length(bio) <= 200),
  username    text CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_]{3,30}$'),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
INSERT INTO public.channel_settings (id, name, username) VALUES (1, 'TrainerTop', 'TrainerTop') ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.channel_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.channel_settings FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. announcements: video ustunlari + erkin post (sarlavha ixtiyoriy, kamida bitta kontent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS video_url text CHECK (video_url IS NULL OR char_length(video_url) <= 500);
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS video_thumbnail_url text CHECK (video_thumbnail_url IS NULL OR char_length(video_thumbnail_url) <= 500);
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS video_duration integer CHECK (video_duration IS NULL OR (video_duration > 0 AND video_duration <= 200));

ALTER TABLE public.announcements ALTER COLUMN title DROP NOT NULL;
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_title_check;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_title_check CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 80);

ALTER TABLE public.announcements ALTER COLUMN body DROP NOT NULL;
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_body_check;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_body_check CHECK (body IS NULL OR char_length(body) <= 2000);

-- Kamida bitta kontent turi bo'lishi shart (bo'sh post yo'q)
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_content_check;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_content_check
  CHECK ((body IS NOT NULL AND char_length(btrim(body)) > 0) OR image_url IS NOT NULL OR video_url IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 3. channel_settings_update(...) — faqat admin. Kanal @username profillar
--    ro'yxatidagi haqiqiy username bilan to'qnashmasligi tekshiriladi.
--    Xatolar: FORBIDDEN, BAD_NAME, BAD_BIO, BAD_AVATAR, BAD_USERNAME, USERNAME_TAKEN
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.channel_settings_update(p_admin uuid, p_name text, p_avatar text, p_bio text, p_username text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_avatar text := nullif(btrim(coalesce(p_avatar, '')), '');
  v_username text := nullif(btrim(coalesce(p_username, '')), '');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin AND role = 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_name IS NULL OR char_length(v_name) > 40 THEN RAISE EXCEPTION 'BAD_NAME'; END IF;
  IF v_bio IS NOT NULL AND char_length(v_bio) > 200 THEN RAISE EXCEPTION 'BAD_BIO'; END IF;
  IF v_avatar IS NOT NULL AND char_length(v_avatar) > 500 THEN RAISE EXCEPTION 'BAD_AVATAR'; END IF;
  IF v_username IS NOT NULL AND NOT (v_username ~ '^[A-Za-z0-9_]{3,30}$') THEN RAISE EXCEPTION 'BAD_USERNAME'; END IF;
  IF v_username IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username)) THEN RAISE EXCEPTION 'USERNAME_TAKEN'; END IF;

  UPDATE public.channel_settings SET name = v_name, avatar_url = v_avatar, bio = v_bio, username = v_username, updated_at = now(), updated_by = p_admin WHERE id = 1;
  RETURN jsonb_build_object('success', true, 'name', v_name, 'avatar_url', v_avatar, 'bio', v_bio, 'username', v_username);
END $$;

REVOKE ALL ON FUNCTION public.channel_settings_update(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.channel_settings_update(uuid, text, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. set_username(...): profillar kanal @username'ini ola olmasin (aks holda
--    kanal identifikatori boshqa yo'nalishga o'zgargach, eskisini biror
--    foydalanuvchi ushlab olishi mumkin edi)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_username(p_user uuid, p_username text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_taken boolean;
BEGIN
  IF p_username IS NULL THEN
    UPDATE public.profiles SET username = NULL WHERE id = p_user;
    RETURN jsonb_build_object('success', true, 'username', NULL);
  END IF;
  IF NOT (p_username ~ '^[A-Za-z0-9_]{3,20}$') THEN
    RAISE EXCEPTION 'BAD_FORMAT';
  END IF;
  IF lower(p_username) = ANY (ARRAY['admin','trainertop','support','trainer_top','trainertop_support','trainertop_admin','root','moderator','trener','official','trainertop_official']) THEN
    RAISE EXCEPTION 'RESERVED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.channel_settings WHERE lower(username) = lower(p_username)) THEN
    RAISE EXCEPTION 'RESERVED';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE lower(username) = lower(p_username) AND id <> p_user) INTO v_taken;
  IF v_taken THEN RAISE EXCEPTION 'TAKEN'; END IF;
  UPDATE public.profiles SET username = p_username WHERE id = p_user;
  RETURN jsonb_build_object('success', true, 'username', p_username);
END $$;

-- ---------------------------------------------------------------------------
-- 5. announcement_send(...): video qo'llab-quvvatlash + sarlavha ixtiyoriy.
--    Eski 9 argumentli versiya butunlay almashtiriladi (aniqlik uchun avval o'chiriladi).
--    Xatolar: ...eskisidek + EMPTY_POST (na matn, na rasm, na video)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.announcement_send(uuid, text, uuid, text, text, text, text, text, uuid);

CREATE OR REPLACE FUNCTION public.announcement_send(
  p_admin uuid, p_kind text, p_target uuid, p_title text, p_body text,
  p_image text, p_link text, p_link_label text, p_token uuid,
  p_video text DEFAULT NULL, p_video_thumb text DEFAULT NULL, p_video_duration integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_title text := nullif(btrim(coalesce(p_title, ''), E' \t\r\n'), '');
  v_body text := nullif(btrim(coalesce(p_body, ''), E' \t\r\n'), '');
  v_label text := nullif(btrim(coalesce(p_link_label, ''), E' \t\r\n'), ''); v_link text := nullif(btrim(coalesce(p_link, ''), E' \t\r\n'), '');
  v_image text := nullif(btrim(coalesce(p_image, ''), E' \t\r\n'), '');
  v_video text := nullif(btrim(coalesce(p_video, ''), E' \t\r\n'), '');
  v_video_thumb text := nullif(btrim(coalesce(p_video_thumb, ''), E' \t\r\n'), '');
  v_existing public.announcements; v_id uuid; v_recipients integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin AND role = 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('all', 'user') THEN RAISE EXCEPTION 'BAD_KIND'; END IF;
  IF p_kind = 'all' AND p_target IS NOT NULL THEN RAISE EXCEPTION 'BAD_TARGET'; END IF;
  IF p_kind = 'user' AND p_target IS NULL THEN RAISE EXCEPTION 'TARGET_REQUIRED'; END IF;
  IF p_kind = 'user' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target) THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;
  IF v_title IS NOT NULL AND char_length(v_title) > 80 THEN RAISE EXCEPTION 'BAD_TITLE'; END IF;
  IF v_body IS NOT NULL AND char_length(v_body) > 2000 THEN RAISE EXCEPTION 'BAD_BODY'; END IF;
  IF v_body IS NULL AND v_image IS NULL AND v_video IS NULL THEN RAISE EXCEPTION 'EMPTY_POST'; END IF;
  IF v_image IS NOT NULL AND v_video IS NOT NULL THEN RAISE EXCEPTION 'BAD_LINK'; END IF;
  IF (v_link IS NOT NULL AND char_length(v_link) > 500) OR (v_label IS NOT NULL AND char_length(v_label) > 40)
     OR (v_image IS NOT NULL AND char_length(v_image) > 500) OR (v_video IS NOT NULL AND char_length(v_video) > 500) THEN RAISE EXCEPTION 'BAD_LINK'; END IF;

  IF p_token IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.announcements WHERE created_by = p_admin AND client_token = p_token;
    IF FOUND THEN RETURN jsonb_build_object('id', v_existing.id, 'recipients', v_existing.recipients, 'duplicate', true); END IF;
  END IF;

  IF p_kind = 'all' AND (SELECT count(*) FROM public.announcements
                          WHERE kind = 'all' AND created_by = p_admin AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'RATE_LIMIT';
  END IF;

  v_recipients := CASE WHEN p_kind = 'all' THEN (SELECT count(*) FROM public.profiles)::integer ELSE 1 END;
  INSERT INTO public.announcements (kind, target_user_id, title, body, image_url, video_url, video_thumbnail_url, video_duration, link_url, link_label, recipients, created_by, client_token)
  VALUES (p_kind, p_target, v_title, v_body, v_image, v_video, v_video_thumb, p_video_duration, v_link, v_label, v_recipients, p_admin, p_token)
  ON CONFLICT (created_by, client_token) WHERE client_token IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN   -- parallel ikkinchi bosish: birinchisi allaqachon yozilgan
    SELECT * INTO v_existing FROM public.announcements WHERE created_by = p_admin AND client_token = p_token;
    RETURN jsonb_build_object('id', v_existing.id, 'recipients', v_existing.recipients, 'duplicate', true);
  END IF;
  RETURN jsonb_build_object('id', v_id, 'recipients', v_recipients, 'duplicate', false);
END $$;

REVOKE ALL ON FUNCTION public.announcement_send(uuid, text, uuid, text, text, text, text, text, uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.announcement_send(uuid, text, uuid, text, text, text, text, text, uuid, text, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 6. announcement_feed(...): video ustunlari javobga qo'shiladi (v17'da yaratilgan
--    funksiyaning to'liq o'rnini bosadi — boost/darslik mantig'i o'zgarmaydi)
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
SELECT 'kanal jadvali va funksiyalar' AS tekshiruv,
       CASE WHEN to_regclass('public.channel_settings') IS NOT NULL
             AND (SELECT count(*) FROM public.channel_settings) = 1
             AND to_regprocedure('public.channel_settings_update(uuid,text,text,text,text)') IS NOT NULL
             AND to_regprocedure('public.announcement_send(uuid,text,uuid,text,text,text,text,text,uuid,text,text,integer)') IS NOT NULL
        THEN 'OK' ELSE 'XATO' END AS natija
UNION ALL SELECT 'jadvalda RLS (brauzer yopiq)',
       CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.channel_settings'::regclass) THEN 'OK' ELSE 'XATO' END
UNION ALL SELECT 'eski 9-argumentli announcement_send o''chirilgan',
       CASE WHEN to_regprocedure('public.announcement_send(uuid,text,uuid,text,text,text,text,text,uuid)') IS NULL THEN 'OK' ELSE 'XATO' END;
