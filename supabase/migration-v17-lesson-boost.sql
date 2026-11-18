-- ============================================================================
-- TRAINERTOP — migration v17: Darslikni BOOST qilish (rasmiy TrainerTop kanalida darslik kartochkasi)
--   * Admin yaxshi yangi darslikni tanlaydi → hammaning rasmiy kanalida darslik kartochkasi chiqadi (narx, muqova, trener, "Ko'rish")
--   * Darslik e'londan keyin ham TEKSHIRILADI: chop etilmagan/o'chirilgan darslik yoki banlangan trener — kartochka
--     kanaldan va o'qilmagan sonidan yo'qoladi
--   * Reklama charchog'idan himoya: butun platforma bo'yicha 7 kunda ko'pi bilan 2 ta boost; bir darslik 30 kunda bir marta
--   * Trenerga qo'ng'iroqchada xabar boradi
--   * Natija o'lchanadi: boostdan keyingi 7 kunda shu darslik nechta sotilgani
-- v16 (e'lonlar) dan KEYIN ishga tushiring. Qayta ishga tushirsa xavfsiz (idempotent).
-- DIQQAT: v17 ishga tushgach migration-v16 ni QAYTA ishga tushirmang (announcement_summary va admin_announcement_list ning
--         eski variantini qaytarib qo'yadi). Kerak bo'lib qolsa, v16 dan keyin v17 ni yana ishga tushiring.
-- ============================================================================

ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE;
DO $$ BEGIN
  ALTER TABLE public.announcements ADD CONSTRAINT announcements_lesson_kind_check CHECK (lesson_id IS NULL OR kind = 'all');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS announcements_lesson_idx ON public.announcements (lesson_id, created_at DESC) WHERE lesson_id IS NOT NULL;

-- Darslikli e'lon ko'rinadimi: darslik chop etilgan va trener banlanmagan bo'lsa (darslikka bog'lanmagan e'lon — doim ko'rinadi)
CREATE OR REPLACE FUNCTION public.announcement_lesson_ok(p_lesson uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p_lesson IS NULL OR EXISTS (
    SELECT 1 FROM public.lessons l WHERE l.id = p_lesson AND l.status = 'published' AND NOT public.is_user_banned(l.trainer_id))
$$;

-- O'qilmaganlar soni va oxirgi e'lon (v16 dagi funksiya + darslik tekshiruvi)
CREATE OR REPLACE FUNCTION public.announcement_summary(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH me AS (
    SELECT greatest(p.created_at, coalesce(r.last_read_at, p.created_at)) AS seen
      FROM public.profiles p LEFT JOIN public.announcement_reads r ON r.user_id = p.id
     WHERE p.id = p_user
  ), vis AS (
    SELECT a.id, a.kind, a.title, a.body, a.created_at
      FROM public.announcements a
     WHERE a.deleted_at IS NULL AND (a.kind = 'all' OR a.target_user_id = p_user) AND public.announcement_lesson_ok(a.lesson_id)
  )
  SELECT jsonb_build_object(
    'unread', (SELECT count(*) FROM vis, me WHERE vis.created_at > me.seen),
    'latest', (SELECT jsonb_build_object('id', v.id, 'title', v.title, 'preview', left(v.body, 120), 'kind', v.kind, 'created_at', v.created_at)
                 FROM vis v ORDER BY v.created_at DESC LIMIT 1)
  )
$$;

-- Kanal lentasi (eskisi → yangisi): darslik ma'lumoti e'lon bilan birga (narx o'zgarsa kartochkada yangisi ko'rinadi)
CREATE OR REPLACE FUNCTION public.announcement_feed(p_user uuid, p_before timestamptz, p_limit int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(x.item ORDER BY x.created_at ASC), '[]'::jsonb)
  FROM (
    SELECT a.created_at,
      jsonb_build_object(
        'id', a.id, 'kind', a.kind, 'title', a.title, 'body', a.body, 'image_url', a.image_url,
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

-- Boost holati (admin oynasi uchun): 7 kunda nechta ishlatilgan, shu darslik oxirgi marta qachon boost qilingan
CREATE OR REPLACE FUNCTION public.lesson_boost_status(p_lesson uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'used_7d', (SELECT count(*) FROM public.announcements WHERE lesson_id IS NOT NULL AND created_at > now() - interval '7 days'),
    'limit_7d', 2,
    'last_boost_at', (SELECT max(created_at) FROM public.announcements WHERE lesson_id = p_lesson AND deleted_at IS NULL),
    'cooldown_days', 30)
$$;

-- ---------------------------------------------------------------------------
-- BOOST (faqat admin). Xatolar: FORBIDDEN, LESSON_NOT_FOUND, NOT_PUBLISHED, TRAINER_BANNED, BAD_TEXT, BOOST_LIMIT, RECENTLY_BOOSTED
--   BOOST_LIMIT: 7 kunda 2 tadan ko'p emas (qaytarib olingan boost ham sanaladi — o'chirib qayta qilib aylanib o'tib bo'lmaydi)
--   RECENTLY_BOOSTED: shu darslik oxirgi 30 kunda (qaytarib olinmagan) boost qilingan
--   Bir xil (admin, client_token) qayta kelsa — yangisi yaratilmaydi (duplicate: true)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lesson_boost(p_admin uuid, p_lesson uuid, p_text text, p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  l public.lessons; v_existing public.announcements; v_id uuid; v_recipients integer;
  v_text text := btrim(coalesce(p_text, ''), E' \t\r\n');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin AND role = 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO l FROM public.lessons WHERE id = p_lesson;
  IF NOT FOUND THEN RAISE EXCEPTION 'LESSON_NOT_FOUND'; END IF;
  IF l.status <> 'published' THEN RAISE EXCEPTION 'NOT_PUBLISHED'; END IF;
  IF public.is_user_banned(l.trainer_id) THEN RAISE EXCEPTION 'TRAINER_BANNED'; END IF;
  IF char_length(v_text) > 300 THEN RAISE EXCEPTION 'BAD_TEXT'; END IF;

  IF p_token IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.announcements WHERE created_by = p_admin AND client_token = p_token;
    IF FOUND THEN RETURN jsonb_build_object('id', v_existing.id, 'recipients', v_existing.recipients, 'duplicate', true); END IF;
  END IF;

  IF (SELECT count(*) FROM public.announcements WHERE lesson_id IS NOT NULL AND created_at > now() - interval '7 days') >= 2 THEN RAISE EXCEPTION 'BOOST_LIMIT'; END IF;
  IF EXISTS (SELECT 1 FROM public.announcements WHERE lesson_id = p_lesson AND deleted_at IS NULL AND created_at > now() - interval '30 days') THEN RAISE EXCEPTION 'RECENTLY_BOOSTED'; END IF;

  v_recipients := (SELECT count(*) FROM public.profiles)::integer;
  INSERT INTO public.announcements (kind, target_user_id, lesson_id, title, body, link_url, link_label, recipients, created_by, client_token)
  VALUES ('all', NULL, p_lesson, left(l.title, 80), coalesce(nullif(v_text, ''), 'Yangi darslik — ko''rib chiqing'),
          '/lessons/' || p_lesson::text, 'Darslikni ko''rish', v_recipients, p_admin, p_token)
  ON CONFLICT (created_by, client_token) WHERE client_token IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT * INTO v_existing FROM public.announcements WHERE created_by = p_admin AND client_token = p_token;
    RETURN jsonb_build_object('id', v_existing.id, 'recipients', v_existing.recipients, 'duplicate', true);
  END IF;

  IF l.trainer_id <> p_admin THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (l.trainer_id, 'boost', 'Darsligingiz TrainerTop kanalida tavsiya qilindi', l.title, jsonb_build_object('lesson_id', p_lesson));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'recipients', v_recipients, 'duplicate', false);
END $$;

-- Admin ro'yxati (v16 dagi funksiya + darslik nomi va boostdan keyingi 7 kundagi sotuvlar)
CREATE OR REPLACE FUNCTION public.admin_announcement_list(p_limit int, p_offset int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.announcements),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC) FROM (
        SELECT a.id, a.kind, a.target_user_id, pt.full_name AS target_name, a.title, a.body, a.image_url, a.link_url, a.link_label,
               a.recipients, a.created_at, a.deleted_at, pc.full_name AS created_by_name,
               a.lesson_id, l.title AS lesson_title,
               CASE WHEN a.kind = 'all'
                    THEN (SELECT count(*) FROM public.announcement_reads r WHERE r.last_read_at >= a.created_at)
                    ELSE (SELECT count(*) FROM public.announcement_reads r WHERE r.user_id = a.target_user_id AND r.last_read_at >= a.created_at) END AS reads,
               CASE WHEN a.lesson_id IS NULL THEN NULL
                    ELSE (SELECT count(*) FROM public.purchases pu WHERE pu.lesson_id = a.lesson_id AND pu.status = 'paid'
                             AND pu.created_at >= a.created_at AND pu.created_at < a.created_at + interval '7 days') END AS sales_7d
          FROM public.announcements a
          LEFT JOIN public.profiles pt ON pt.id = a.target_user_id
          LEFT JOIN public.profiles pc ON pc.id = a.created_by
          LEFT JOIN public.lessons l ON l.id = a.lesson_id
         ORDER BY a.created_at DESC
         LIMIT greatest(1, least(coalesce(p_limit, 30), 100)) OFFSET greatest(0, coalesce(p_offset, 0))) s), '[]'::jsonb))
$$;

REVOKE ALL ON FUNCTION public.announcement_lesson_ok(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.announcement_feed(uuid, timestamptz, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lesson_boost_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lesson_boost(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.announcement_summary(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_announcement_list(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.announcement_lesson_ok(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.announcement_feed(uuid, timestamptz, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.lesson_boost_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.lesson_boost(uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.announcement_summary(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_announcement_list(int, int) TO service_role;

-- TEKSHIRUV
SELECT 'boost funksiyalari va lesson_id ustuni' AS tekshiruv,
       CASE WHEN to_regprocedure('public.lesson_boost(uuid,uuid,text,uuid)') IS NOT NULL
             AND to_regprocedure('public.announcement_feed(uuid,timestamptz,integer)') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'announcements' AND column_name = 'lesson_id')
            THEN 'OK' ELSE 'XATO' END AS natija
UNION ALL SELECT 'brauzer funksiyalarga tegolmaydi',
       CASE WHEN NOT has_function_privilege('authenticated', 'public.lesson_boost(uuid,uuid,text,uuid)', 'EXECUTE')
             AND NOT has_function_privilege('authenticated', 'public.announcement_feed(uuid,timestamptz,integer)', 'EXECUTE') THEN 'OK' ELSE 'XATO' END
UNION ALL SELECT 'boost qilingan darsliklar soni', (SELECT count(*) FROM public.announcements WHERE lesson_id IS NOT NULL)::text;
