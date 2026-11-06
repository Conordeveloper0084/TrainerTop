-- ============================================================================
-- TRAINERTOP — migration v16: Rasmiy "TrainerTop" kanali (e'lonlar)
--   * Admin e'lon yozadi: HAMMAGA yoki BITTA foydalanuvchiga
--   * Foydalanuvchida chatda rasmiy kanal (faqat o'qish) + o'qilmaganlar soni (chat va qo'ng'iroqchada belgi)
--   * Har foydalanuvchiga alohida qator YOZILMAYDI: 1 ta e'lon = 1 ta qator (100 ming foydalanuvchi bo'lsa ham arzon),
--     o'qilganlik — foydalanuvchiga bitta "oxirgi ko'rgan vaqt" belgisi bilan
--   * Yangi ro'yxatdan o'tgan odam eski e'lonlarni O'QILMAGAN deb ko'rmaydi (lekin tarixni kanalda o'qiy oladi)
--   * Hammasi faqat server (service_role) orqali; brauzer jadval va funksiyalarga tegmaydi
-- Qayta ishga tushirsa xavfsiz (idempotent). Kodni deploy qilishdan OLDIN ishga tushiring.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.announcements (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind             text NOT NULL CHECK (kind IN ('all', 'user')),
  target_user_id   uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title            text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  body             text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  image_url        text CHECK (image_url IS NULL OR char_length(image_url) <= 500),
  link_url         text CHECK (link_url IS NULL OR char_length(link_url) <= 500),
  link_label       text CHECK (link_label IS NULL OR char_length(link_label) <= 40),
  recipients       integer NOT NULL DEFAULT 0,                 -- yuborilgan paytdagi auditoriya (hammaga: profillar soni)
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_token     uuid,                                       -- ikki marta bosishdan himoya
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,                                -- qaytarib olingan (kanaldan yo'qoladi)
  deleted_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT announcements_target_check CHECK ((kind = 'all' AND target_user_id IS NULL) OR (kind = 'user' AND target_user_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS announcements_created_idx ON public.announcements (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS announcements_target_idx  ON public.announcements (target_user_id, created_at DESC) WHERE kind = 'user' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS announcements_token_unique ON public.announcements (created_by, client_token) WHERE client_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  user_id       uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.announcements, public.announcement_reads FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Foydalanuvchi uchun: o'qilmaganlar soni va oxirgi e'lon (chat ro'yxati, chat belgisi, qo'ng'iroqcha)
--   ko'rinadigan e'lon = hammaga yoki shu odamga, o'chirilmagan
--   o'qilmagan = ko'rgan vaqtidan (yoki ro'yxatdan o'tgan vaqtidan) KEYIN yuborilgani
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.announcement_summary(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH me AS (
    SELECT greatest(p.created_at, coalesce(r.last_read_at, p.created_at)) AS seen
      FROM public.profiles p LEFT JOIN public.announcement_reads r ON r.user_id = p.id
     WHERE p.id = p_user
  ), vis AS (
    SELECT a.id, a.kind, a.title, a.body, a.created_at
      FROM public.announcements a
     WHERE a.deleted_at IS NULL AND (a.kind = 'all' OR a.target_user_id = p_user)
  )
  SELECT jsonb_build_object(
    'unread', (SELECT count(*) FROM vis, me WHERE vis.created_at > me.seen),
    'latest', (SELECT jsonb_build_object('id', v.id, 'title', v.title, 'preview', left(v.body, 120), 'kind', v.kind, 'created_at', v.created_at)
                 FROM vis v ORDER BY v.created_at DESC LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.announcement_mark_read(p_user uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO public.announcement_reads (user_id, last_read_at) VALUES (p_user, now())
  ON CONFLICT (user_id) DO UPDATE SET last_read_at = now()
$$;

-- ---------------------------------------------------------------------------
-- E'lon yuborish (faqat admin): barcha qoidalar shu yerda
--   Xatolar: FORBIDDEN, BAD_KIND, BAD_TARGET, TARGET_REQUIRED, TARGET_NOT_FOUND, BAD_TITLE, BAD_BODY, BAD_LINK, RATE_LIMIT
--   Bir xil (admin, client_token) qayta kelsa — yangi e'lon yaratilmaydi, mavjudi qaytadi (duplicate: true)
--   "Hammaga" e'lon: bir admin soatiga ko'pi bilan 5 ta (hisob buzilishi yoki xato tugma bosishdan himoya)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.announcement_send(
  p_admin uuid, p_kind text, p_target uuid, p_title text, p_body text,
  p_image text, p_link text, p_link_label text, p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  -- btrim: bo'shliq, tab va yangi qator olib tashlanadi (faqat "\n" yozilgan matn ham bo'sh hisoblansin)
  v_title text := btrim(coalesce(p_title, ''), E' \t\r\n'); v_body text := btrim(coalesce(p_body, ''), E' \t\r\n');
  v_label text := nullif(btrim(coalesce(p_link_label, ''), E' \t\r\n'), ''); v_link text := nullif(btrim(coalesce(p_link, ''), E' \t\r\n'), '');
  v_image text := nullif(btrim(coalesce(p_image, ''), E' \t\r\n'), '');
  v_existing public.announcements; v_id uuid; v_recipients integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin AND role = 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('all', 'user') THEN RAISE EXCEPTION 'BAD_KIND'; END IF;
  IF p_kind = 'all' AND p_target IS NOT NULL THEN RAISE EXCEPTION 'BAD_TARGET'; END IF;
  IF p_kind = 'user' AND p_target IS NULL THEN RAISE EXCEPTION 'TARGET_REQUIRED'; END IF;
  IF p_kind = 'user' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target) THEN RAISE EXCEPTION 'TARGET_NOT_FOUND'; END IF;
  IF char_length(v_title) < 1 OR char_length(v_title) > 80 THEN RAISE EXCEPTION 'BAD_TITLE'; END IF;
  IF char_length(v_body) < 1 OR char_length(v_body) > 2000 THEN RAISE EXCEPTION 'BAD_BODY'; END IF;
  IF (v_link IS NOT NULL AND char_length(v_link) > 500) OR (v_label IS NOT NULL AND char_length(v_label) > 40)
     OR (v_image IS NOT NULL AND char_length(v_image) > 500) THEN RAISE EXCEPTION 'BAD_LINK'; END IF;

  IF p_token IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.announcements WHERE created_by = p_admin AND client_token = p_token;
    IF FOUND THEN RETURN jsonb_build_object('id', v_existing.id, 'recipients', v_existing.recipients, 'duplicate', true); END IF;
  END IF;

  IF p_kind = 'all' AND (SELECT count(*) FROM public.announcements
                          WHERE kind = 'all' AND created_by = p_admin AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'RATE_LIMIT';
  END IF;

  v_recipients := CASE WHEN p_kind = 'all' THEN (SELECT count(*) FROM public.profiles)::integer ELSE 1 END;
  INSERT INTO public.announcements (kind, target_user_id, title, body, image_url, link_url, link_label, recipients, created_by, client_token)
  VALUES (p_kind, p_target, v_title, v_body, v_image, v_link, v_label, v_recipients, p_admin, p_token)
  ON CONFLICT (created_by, client_token) WHERE client_token IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN   -- parallel ikkinchi bosish: birinchisi allaqachon yozilgan
    SELECT * INTO v_existing FROM public.announcements WHERE created_by = p_admin AND client_token = p_token;
    RETURN jsonb_build_object('id', v_existing.id, 'recipients', v_existing.recipients, 'duplicate', true);
  END IF;
  RETURN jsonb_build_object('id', v_id, 'recipients', v_recipients, 'duplicate', false);
END $$;

-- ---------------------------------------------------------------------------
-- Admin ro'yxati: tarix + necha kishi kanalni ochib ko'rgan
--   hammaga: e'londan KEYIN kanalni ochgan foydalanuvchilar soni; shaxsiy: 1 yoki 0
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_announcement_list(p_limit int, p_offset int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.announcements),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC) FROM (
        SELECT a.id, a.kind, a.target_user_id, pt.full_name AS target_name, a.title, a.body, a.image_url, a.link_url, a.link_label,
               a.recipients, a.created_at, a.deleted_at, pc.full_name AS created_by_name,
               CASE WHEN a.kind = 'all'
                    THEN (SELECT count(*) FROM public.announcement_reads r WHERE r.last_read_at >= a.created_at)
                    ELSE (SELECT count(*) FROM public.announcement_reads r WHERE r.user_id = a.target_user_id AND r.last_read_at >= a.created_at) END AS reads
          FROM public.announcements a
          LEFT JOIN public.profiles pt ON pt.id = a.target_user_id
          LEFT JOIN public.profiles pc ON pc.id = a.created_by
         ORDER BY a.created_at DESC
         LIMIT greatest(1, least(coalesce(p_limit, 30), 100)) OFFSET greatest(0, coalesce(p_offset, 0))) s), '[]'::jsonb))
$$;

REVOKE ALL ON FUNCTION public.announcement_summary(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.announcement_mark_read(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.announcement_send(uuid, text, uuid, text, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_announcement_list(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.announcement_summary(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.announcement_mark_read(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.announcement_send(uuid, text, uuid, text, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_announcement_list(int, int) TO service_role;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'e''lonlar jadvallari va funksiyalar' AS tekshiruv,
       CASE WHEN to_regclass('public.announcements') IS NOT NULL AND to_regclass('public.announcement_reads') IS NOT NULL
             AND to_regprocedure('public.announcement_send(uuid,text,uuid,text,text,text,text,text,uuid)') IS NOT NULL
             AND to_regprocedure('public.announcement_summary(uuid)') IS NOT NULL THEN 'OK' ELSE 'XATO' END AS natija
UNION ALL SELECT 'jadvallarda RLS (brauzer yopiq)',
       CASE WHEN (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.announcements'::regclass, 'public.announcement_reads'::regclass)) THEN 'OK' ELSE 'XATO' END
UNION ALL SELECT 'mavjud e''lonlar soni', (SELECT count(*) FROM public.announcements)::text;
