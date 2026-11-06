-- ============================================================================
-- TRAINERTOP — migration v18: Hamjamiyat
--   1. HAR BIR profil uchun obunachilar soni (atletlar ham kuzatilishi mumkin) + tez ro'yxat uchun indeks
--   2. "TrainerTop Athlete" nishoni — oddiy foydalanuvchilar (atletlar) uchun: obunachi chegarasiga yetganda AVTOMATIK
--      (chegara admin Sozlamalarida, standart 5000), admin qo'lda bera/olib tashlay oladi. Trener nishoni "TrainerTop Trener" deb ataladi.
--   3. Butun platformaga 5 yulduzli baho + izoh (bir foydalanuvchi — bitta baho; admin ko'rsatishni tanlaydi/yashiradi)
-- Barcha yangi jadval/funksiyalar faqat server (service_role). v12 dan KEYIN ishga tushiring. Qayta ishga tushirsa xavfsiz (idempotent).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Profil ustunlari va obunachilar soni
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS followers_count       integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS athlete_badge         boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS athlete_badge_source  text;      -- 'auto' | 'admin' | 'revoked' | NULL
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS athlete_badge_at      timestamptz;
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_athlete_badge_source_check CHECK (athlete_badge_source IS NULL OR athlete_badge_source IN ('auto', 'admin', 'revoked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS follows_target_idx ON public.follows (trainer_id, created_at DESC);   -- "mening obunachilarim" ro'yxati

UPDATE public.profiles p SET followers_count = c.n
  FROM (SELECT trainer_id, count(*)::int AS n FROM public.follows GROUP BY trainer_id) c
 WHERE c.trainer_id = p.id AND p.followers_count IS DISTINCT FROM c.n;

INSERT INTO public.platform_settings (key, value) VALUES ('athlete_badge_min_followers', 5000) ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Himoya: brauzerdan (anon/authenticated) yangi ustunlarni o'zgartirib bo'lmaydi (nishonni o'ziga bera olmasin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profiles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() = 1 AND current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.role := 'user'; NEW.followers_count := 0; NEW.athlete_badge := false; NEW.athlete_badge_source := NULL; NEW.athlete_badge_at := NULL;
    ELSE
      NEW.role := OLD.role; NEW.followers_count := OLD.followers_count;
      NEW.athlete_badge := OLD.athlete_badge; NEW.athlete_badge_source := OLD.athlete_badge_source; NEW.athlete_badge_at := OLD.athlete_badge_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Atlet nishoni: obunachi chegarasiga yetsa avtomatik BERILADI (olib tashlash faqat admin qo'lida)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_athlete_badge(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE pr public.profiles;
BEGIN
  SELECT * INTO pr FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND OR pr.role <> 'user' THEN RETURN; END IF;
  IF pr.athlete_badge OR pr.athlete_badge_source IN ('admin', 'revoked') THEN RETURN; END IF;
  IF public.is_user_banned(p_user) THEN RETURN; END IF;
  IF pr.followers_count >= public.get_setting('athlete_badge_min_followers', 5000) THEN
    UPDATE public.profiles SET athlete_badge = true, athlete_badge_source = 'auto', athlete_badge_at = now() WHERE id = p_user;
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (p_user, 'badge', 'Tabriklaymiz!', 'Siz TrainerTop Athlete nishonini oldingiz', '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM public.log_admin_action(NULL, 'athlete_badge_auto_grant', 'user', p_user::text, jsonb_build_object('followers', pr.followers_count));
  END IF;
END $$;

-- Chegara o'zgarganda: hali nishonsiz, chegaraga yetgan atletlarni qayta tekshirish
CREATE OR REPLACE FUNCTION public.refresh_all_athlete_badges() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM public.profiles
            WHERE role = 'user' AND NOT athlete_badge AND coalesce(athlete_badge_source, '') NOT IN ('admin', 'revoked')
              AND followers_count >= public.get_setting('athlete_badge_min_followers', 5000)
  LOOP
    PERFORM public.refresh_athlete_badge(r.id); n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Obunachilar soni: har ikkala profil jadvalida yangilanadi; yangi obunadan keyin atlet nishoni tekshiriladi
CREATE OR REPLACE FUNCTION public.sync_followers_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_target uuid := COALESCE(NEW.trainer_id, OLD.trainer_id); v_n integer;
BEGIN
  SELECT count(*)::integer INTO v_n FROM public.follows WHERE trainer_id = v_target;
  UPDATE public.profiles SET followers_count = v_n WHERE id = v_target;
  UPDATE public.trainer_profiles SET followers_count = v_n WHERE user_id = v_target;
  IF TG_OP = 'INSERT' THEN PERFORM public.refresh_athlete_badge(v_target); END IF;
  RETURN NULL;
END $$;

-- Admin: atlet nishonini qo'lda berish / olib tashlash. Xatolar: FORBIDDEN, USER_NOT_FOUND, NOT_ATHLETE, BAD_ACTION, STATE_INVALID
CREATE OR REPLACE FUNCTION public.set_athlete_badge(p_admin uuid, p_user uuid, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE pr public.profiles;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin AND role = 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('grant', 'revoke') THEN RAISE EXCEPTION 'BAD_ACTION'; END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF pr.role <> 'user' THEN RAISE EXCEPTION 'NOT_ATHLETE'; END IF;
  IF p_action = 'grant' THEN
    IF pr.athlete_badge THEN RAISE EXCEPTION 'STATE_INVALID'; END IF;
    UPDATE public.profiles SET athlete_badge = true, athlete_badge_source = 'admin', athlete_badge_at = now() WHERE id = p_user;
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (p_user, 'badge', 'Tabriklaymiz!', 'Siz TrainerTop Athlete nishonini oldingiz', '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  ELSE
    IF NOT pr.athlete_badge THEN RAISE EXCEPTION 'STATE_INVALID'; END IF;
    UPDATE public.profiles SET athlete_badge = false, athlete_badge_source = 'revoked', athlete_badge_at = NULL WHERE id = p_user;
  END IF;
  PERFORM public.log_admin_action(p_admin, 'athlete_badge_' || p_action, 'user', p_user::text, '{}'::jsonb);
  RETURN jsonb_build_object('athlete_badge', p_action = 'grant', 'source', CASE WHEN p_action = 'grant' THEN 'admin' ELSE 'revoked' END);
END $$;

-- Trener nishoni endi "TrainerTop Trener" (tabrik matni yangilandi; mantiq o'zgarmagan)
CREATE OR REPLACE FUNCTION public.refresh_trainer_badge(p_trainer uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE tp public.trainer_profiles;
BEGIN
  SELECT * INTO tp FROM public.trainer_profiles WHERE user_id = p_trainer FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF tp.badge_source IN ('admin', 'revoked') OR tp.is_verified THEN RETURN; END IF;
  IF public.is_user_banned(p_trainer) THEN RETURN; END IF;

  IF coalesce(tp.followers_count, 0) >= public.get_setting('badge_min_followers', 1000)
     AND coalesce(tp.rating, 0)        >= public.get_setting('badge_min_rating', 4.5)
     AND coalesce(tp.total_reviews, 0) >= public.get_setting('badge_min_reviews', 10) THEN
    UPDATE public.trainer_profiles SET is_verified = true, badge_source = 'auto', badge_granted_at = now()
     WHERE user_id = p_trainer;
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (p_trainer, 'badge', 'Tabriklaymiz!', 'Siz TrainerTop Trener nishonini oldingiz', '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM public.log_admin_action(NULL, 'badge_auto_grant', 'trainer', p_trainer::text,
      jsonb_build_object('followers', tp.followers_count, 'rating', tp.rating, 'reviews', tp.total_reviews));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Butun platformaga baho (5 yulduz + izoh)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_reviews (
  user_id     uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text CHECK (comment IS NULL OR char_length(comment) BETWEEN 1 AND 500),
  featured    boolean NOT NULL DEFAULT false,      -- admin tanlagan: bosh sahifada ko'rinadi
  hidden      boolean NOT NULL DEFAULT false,      -- admin yashirgan: o'rtacha bahoga ham kirmaydi (spam)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_reviews_featured_check CHECK (NOT featured OR (comment IS NOT NULL AND NOT hidden))
);
CREATE INDEX IF NOT EXISTS platform_reviews_featured_idx ON public.platform_reviews (updated_at DESC) WHERE featured AND NOT hidden;
ALTER TABLE public.platform_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_reviews FROM anon, authenticated;

-- Baho berish/yangilash. Xatolar: USER_NOT_FOUND, BANNED, BAD_RATING, BAD_COMMENT.
-- Izoh yoki baho O'ZGARSA admin tanlovi (featured) bekor bo'ladi (foydalanuvchi tasdiqlangan matnni keyin o'zgartirib qo'ya olmasin).
CREATE OR REPLACE FUNCTION public.platform_review_submit(p_user uuid, p_rating integer, p_comment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_comment text := nullif(btrim(coalesce(p_comment, ''), E' \t\r\n'), ''); v_old public.platform_reviews;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF public.is_user_banned(p_user) THEN RAISE EXCEPTION 'BANNED'; END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'BAD_RATING'; END IF;
  IF v_comment IS NOT NULL AND char_length(v_comment) > 500 THEN RAISE EXCEPTION 'BAD_COMMENT'; END IF;
  SELECT * INTO v_old FROM public.platform_reviews WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.platform_reviews (user_id, rating, comment) VALUES (p_user, p_rating, v_comment);
    RETURN jsonb_build_object('created', true);
  END IF;
  UPDATE public.platform_reviews
     SET rating = p_rating, comment = v_comment, updated_at = now(),
         featured = CASE WHEN v_old.rating = p_rating AND v_old.comment IS NOT DISTINCT FROM v_comment THEN v_old.featured ELSE false END
   WHERE user_id = p_user;
  RETURN jsonb_build_object('created', false);
END $$;

-- Umumiy natija (yashirilganlar hisobga olinmaydi)
CREATE OR REPLACE FUNCTION public.platform_review_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'count', count(*),
    'average', CASE WHEN count(*) = 0 THEN NULL ELSE round(avg(rating)::numeric, 1) END,
    'distribution', jsonb_build_object('1', count(*) FILTER (WHERE rating = 1), '2', count(*) FILTER (WHERE rating = 2), '3', count(*) FILTER (WHERE rating = 3),
                                       '4', count(*) FILTER (WHERE rating = 4), '5', count(*) FILTER (WHERE rating = 5)))
  FROM public.platform_reviews WHERE NOT hidden
$$;

-- Bosh sahifada ko'rinadigan (admin tanlagan) sharhlar: ism qisqartirilgan ("Ali K."), email/id chiqmaydi
CREATE OR REPLACE FUNCTION public.platform_review_featured(p_limit integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(x.item ORDER BY x.updated_at DESC), '[]'::jsonb) FROM (
    SELECT r.updated_at, jsonb_build_object(
      'name', CASE WHEN nm = '' THEN 'Foydalanuvchi'
                   WHEN position(' ' in nm) > 0 THEN split_part(nm, ' ', 1) || ' ' || upper(left(split_part(nm, ' ', 2), 1)) || '.'
                   ELSE nm END,
      'avatar_url', p.avatar_url, 'rating', r.rating, 'comment', r.comment, 'created_at', r.created_at) AS item
      FROM public.platform_reviews r JOIN public.profiles p ON p.id = r.user_id
      CROSS JOIN LATERAL (SELECT regexp_replace(btrim(p.full_name), '\s+', ' ', 'g') AS nm) n
     WHERE r.featured AND NOT r.hidden AND r.comment IS NOT NULL
     ORDER BY r.updated_at DESC LIMIT greatest(1, least(coalesce(p_limit, 6), 20))
  ) x
$$;

-- Admin moderatsiyasi (atomik): tanlash faqat izohli va yashirilmagan baho uchun; yashirilgan baho tanlanmaydi
-- Xatolar: FORBIDDEN, REVIEW_NOT_FOUND, NEEDS_COMMENT, HIDDEN, BAD_ACTION
CREATE OR REPLACE FUNCTION public.platform_review_moderate(p_admin uuid, p_user uuid, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.platform_reviews;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin AND role = 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('feature', 'unfeature', 'hide', 'unhide') THEN RAISE EXCEPTION 'BAD_ACTION'; END IF;
  SELECT * INTO r FROM public.platform_reviews WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_NOT_FOUND'; END IF;
  IF p_action = 'feature' THEN
    IF r.hidden THEN RAISE EXCEPTION 'HIDDEN'; END IF;
    IF r.comment IS NULL THEN RAISE EXCEPTION 'NEEDS_COMMENT'; END IF;
    UPDATE public.platform_reviews SET featured = true WHERE user_id = p_user;
  ELSIF p_action = 'unfeature' THEN UPDATE public.platform_reviews SET featured = false WHERE user_id = p_user;
  ELSIF p_action = 'hide' THEN UPDATE public.platform_reviews SET hidden = true, featured = false WHERE user_id = p_user;
  ELSE UPDATE public.platform_reviews SET hidden = false WHERE user_id = p_user;
  END IF;
  PERFORM public.log_admin_action(p_admin, 'platform_review_' || p_action, 'user', p_user::text, '{}'::jsonb);
  RETURN (SELECT jsonb_build_object('featured', featured, 'hidden', hidden) FROM public.platform_reviews WHERE user_id = p_user);
END $$;

-- Admin ro'yxati: filtr (all | featured | hidden | with_comment), sahifalash
CREATE OR REPLACE FUNCTION public.admin_platform_reviews(p_filter text, p_limit integer, p_offset integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH base AS (
    SELECT r.*, p.full_name, p.email FROM public.platform_reviews r JOIN public.profiles p ON p.id = r.user_id
     WHERE CASE coalesce(p_filter, 'all') WHEN 'featured' THEN r.featured WHEN 'hidden' THEN r.hidden WHEN 'with_comment' THEN r.comment IS NOT NULL ELSE true END
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM base),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM (SELECT * FROM base ORDER BY updated_at DESC
                       LIMIT greatest(1, least(coalesce(p_limit, 30), 100)) OFFSET greatest(0, coalesce(p_offset, 0))) s), '[]'::jsonb))
$$;

-- ---------------------------------------------------------------------------
-- 5. Huquqlar: faqat server
-- ---------------------------------------------------------------------------
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.refresh_athlete_badge(uuid)', 'public.refresh_all_athlete_badges()', 'public.set_athlete_badge(uuid,uuid,text)',
    'public.platform_review_submit(uuid,integer,text)', 'public.platform_review_stats()', 'public.platform_review_featured(integer)',
    'public.platform_review_moderate(uuid,uuid,text)', 'public.admin_platform_reviews(text,integer,integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'yangi ustunlar, jadval va funksiyalar' AS tekshiruv,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'athlete_badge')
             AND to_regclass('public.platform_reviews') IS NOT NULL
             AND to_regprocedure('public.set_athlete_badge(uuid,uuid,text)') IS NOT NULL
             AND to_regprocedure('public.platform_review_submit(uuid,integer,text)') IS NOT NULL THEN 'OK' ELSE 'XATO' END AS natija
UNION ALL SELECT 'brauzer funksiyalarga tegolmaydi',
       CASE WHEN NOT has_function_privilege('authenticated', 'public.set_athlete_badge(uuid,uuid,text)', 'EXECUTE')
             AND NOT has_function_privilege('authenticated', 'public.platform_review_submit(uuid,integer,text)', 'EXECUTE') THEN 'OK' ELSE 'XATO' END
UNION ALL SELECT 'obunachi soni profillar bilan mos (0 bo''lishi kerak)',
       (SELECT count(*) FROM public.profiles p WHERE p.followers_count <> (SELECT count(*) FROM public.follows f WHERE f.trainer_id = p.id))::text
UNION ALL SELECT 'atlet nishoniga tayyor, lekin hali berilmagan (chegaraga yetganlar)',
       (SELECT count(*) FROM public.profiles WHERE role = 'user' AND NOT athlete_badge AND followers_count >= public.get_setting('athlete_badge_min_followers', 5000))::text;
