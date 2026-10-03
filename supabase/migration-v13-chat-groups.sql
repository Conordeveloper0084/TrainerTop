-- ============================================================================
-- TRAINERTOP — migration v13: Chat yangilanishi
--   * Darslik guruhlari (yopiq, avtomatik yaratiladi va avtomatik qo'shiladi)
--   * Xabar turlari: matn / rasm / ovoz / video, xabarni o'chirish (yumshoq)
--   * Kirish qoidalari (group_access), RLS, o'qilmagan xabarlar
-- QAYTA ISHGA TUSHIRSA XAVFSIZ (idempotent). Kodni deploy qilishdan OLDIN ishga tushiring.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. JADVALLAR
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_groups (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id          uuid NOT NULL UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
  owner_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name               text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  bio                text CHECK (bio IS NULL OR char_length(bio) <= 500),
  avatar_url         text,
  is_archived        boolean NOT NULL DEFAULT false,
  last_message       text,
  last_message_type  text,
  last_message_at    timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_group_members (
  group_id      uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed', 'left')),
  joined_at     timestamptz NOT NULL DEFAULT now(),
  last_read_at  timestamptz NOT NULL DEFAULT now(),
  seen_intro_at timestamptz,
  removed_at    timestamptz,
  removed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_group_members_user_idx ON public.chat_group_members (user_id);

-- ---------------------------------------------------------------------------
-- 2. messages: guruh xabarlari, turlar, media, yumshoq o'chirish
-- ---------------------------------------------------------------------------
ALTER TABLE public.messages ALTER COLUMN conversation_id DROP NOT NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS group_id       uuid REFERENCES public.chat_groups(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS type           text NOT NULL DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url      text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_mime     text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_duration integer;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_size     bigint;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS thumb_url      text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at     timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'image', 'voice', 'video'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.messages ADD CONSTRAINT messages_one_target CHECK ((conversation_id IS NOT NULL) <> (group_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.messages ADD CONSTRAINT messages_media_present CHECK (type = 'text' OR media_url IS NOT NULL OR deleted_at IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Eski rasmli xabarlar yangi turga o'tkaziladi (image_url ustuni eski mijozlar uchun saqlanadi)
UPDATE public.messages SET type = 'image', media_url = image_url
 WHERE image_url IS NOT NULL AND type = 'text' AND media_url IS NULL;

CREATE INDEX IF NOT EXISTS messages_group_created_idx ON public.messages (group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_conv_created_idx  ON public.messages (conversation_id, created_at DESC) WHERE conversation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. KIRISH QOIDASI: 'owner' | 'active' | 'expired' | 'none'
--    owner   — darslik egasi (guruh admini)
--    active  — a'zo va darslikka haqi to'langan (umrbod yoki oylik muddati tugamagan)
--    expired — a'zo, lekin oylik obuna tugagan: guruh ro'yxatda ko'rinadi, ichiga kirib bo'lmaydi
--    none    — guruh yo'q/yopilgan, a'zo emas, chiqarilgan, ban qilingan, haqi qaytarilgan
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.group_access(p_group uuid, p_user uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE g public.chat_groups; les public.lessons; m public.chat_group_members; pur public.purchases;
BEGIN
  IF p_user IS NULL OR p_group IS NULL THEN RETURN 'none'; END IF;
  SELECT * INTO g FROM public.chat_groups WHERE id = p_group;
  IF NOT FOUND OR g.is_archived THEN RETURN 'none'; END IF;
  SELECT * INTO les FROM public.lessons WHERE id = g.lesson_id;
  IF NOT FOUND OR les.status = 'removed' THEN RETURN 'none'; END IF;
  IF public.is_user_banned(g.owner_id) OR public.is_user_banned(p_user) THEN RETURN 'none'; END IF;
  IF p_user = g.owner_id THEN RETURN 'owner'; END IF;

  SELECT * INTO m FROM public.chat_group_members WHERE group_id = p_group AND user_id = p_user;
  IF NOT FOUND OR m.status <> 'active' THEN RETURN 'none'; END IF;

  SELECT * INTO pur FROM public.purchases WHERE user_id = p_user AND lesson_id = g.lesson_id AND status = 'paid';
  IF NOT FOUND THEN RETURN 'none'; END IF;
  IF pur.purchase_type = 'monthly' AND pur.expires_at IS NOT NULL AND pur.expires_at <= now() THEN RETURN 'expired'; END IF;
  RETURN 'active';
END $$;

-- RLS uchun: faqat JORIY foydalanuvchi haqida (boshqa odamning a'zoligini so'rab bo'lmaydi)
CREATE OR REPLACE FUNCTION public.group_access_me(p_group uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.group_access(p_group, auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- 4. AVTOMATIKA: darslik e'lon qilinganda guruh yaratiladi, xarid qilinganda a'zo qo'shiladi
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_lesson_group() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_gid uuid;
BEGIN
  IF NEW.status = 'published' AND NOT EXISTS (SELECT 1 FROM public.chat_groups WHERE lesson_id = NEW.id) THEN
    INSERT INTO public.chat_groups (lesson_id, owner_id, name)
    VALUES (NEW.id, NEW.trainer_id, coalesce(nullif(left(btrim(NEW.title), 80), ''), 'Guruh'))
    RETURNING id INTO v_gid;
    INSERT INTO public.chat_group_members (group_id, user_id, role) VALUES (v_gid, NEW.trainer_id, 'owner')
    ON CONFLICT DO NOTHING;
    -- Darslik avval sotilgan bo'lsa (qayta e'lon qilingan), xaridorlar ham qo'shiladi
    INSERT INTO public.chat_group_members (group_id, user_id, role)
    SELECT v_gid, p.user_id, 'member' FROM public.purchases p
     WHERE p.lesson_id = NEW.id AND p.status = 'paid' AND p.user_id <> NEW.trainer_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lessons_create_group ON public.lessons;
CREATE TRIGGER lessons_create_group AFTER INSERT OR UPDATE OF status ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.trg_lesson_group();

CREATE OR REPLACE FUNCTION public.trg_purchase_group() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_gid uuid;
BEGIN
  IF NEW.status <> 'paid' THEN RETURN NEW; END IF;
  SELECT id INTO v_gid FROM public.chat_groups WHERE lesson_id = NEW.lesson_id;
  IF v_gid IS NULL THEN RETURN NEW; END IF;
  -- 'left' (o'zi chiqib ketgan) yangi to'lovda qaytadi; 'removed' (trener chiqargan) qaytmaydi
  INSERT INTO public.chat_group_members (group_id, user_id, role, status)
  VALUES (v_gid, NEW.user_id, 'member', 'active')
  ON CONFLICT (group_id, user_id) DO UPDATE
     SET status = CASE WHEN public.chat_group_members.status = 'removed' THEN 'removed' ELSE 'active' END
   WHERE public.chat_group_members.role <> 'owner';
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS purchases_join_group ON public.purchases;
CREATE TRIGGER purchases_join_group AFTER INSERT OR UPDATE OF status, expires_at, purchase_type ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.trg_purchase_group();

-- Guruhga yangi xabar: ro'yxatdagi oxirgi xabar avtomatik yangilanadi
CREATE OR REPLACE FUNCTION public.trg_group_last_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.group_id IS NOT NULL THEN
    UPDATE public.chat_groups
       SET last_message = CASE NEW.type
             WHEN 'image' THEN CASE WHEN coalesce(btrim(NEW.content), '') <> '' THEN left(btrim(NEW.content), 100) ELSE 'Rasm' END
             WHEN 'voice' THEN 'Ovozli xabar'
             WHEN 'video' THEN CASE WHEN coalesce(btrim(NEW.content), '') <> '' THEN left(btrim(NEW.content), 100) ELSE 'Video' END
             ELSE left(coalesce(NEW.content, ''), 100) END,
           last_message_type = NEW.type,
           last_message_at = NEW.created_at
     WHERE id = NEW.group_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS messages_group_last ON public.messages;
CREATE TRIGGER messages_group_last AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_group_last_message();

-- ---------------------------------------------------------------------------
-- 5. RO'YXAT VA O'QILMAGANLAR (faqat server — service_role)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_group_list(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(t.item ORDER BY t.sort_at DESC), '[]'::jsonb)
  FROM (
    SELECT coalesce(g.last_message_at, g.created_at) AS sort_at,
      jsonb_build_object(
        'id', g.id, 'lesson_id', g.lesson_id, 'name', g.name, 'avatar_url', g.avatar_url,
        'access', a.access, 'role', CASE WHEN a.access = 'owner' THEN 'owner' ELSE 'member' END,
        'last_message',      CASE WHEN a.access IN ('owner', 'active') THEN g.last_message ELSE NULL END,
        'last_message_type', CASE WHEN a.access IN ('owner', 'active') THEN g.last_message_type ELSE NULL END,
        'last_message_at',   CASE WHEN a.access IN ('owner', 'active') THEN g.last_message_at ELSE NULL END,
        'lesson_title', l.title, 'price_monthly', l.price_monthly, 'pricing_model', l.pricing_model,
        'unread', CASE WHEN a.access IN ('owner', 'active') THEN
                    (SELECT count(*) FROM public.messages x
                      WHERE x.group_id = g.id AND x.created_at > m.last_read_at
                        AND x.sender_id <> p_user AND x.deleted_at IS NULL)
                  ELSE 0 END
      ) AS item
    FROM public.chat_group_members m
    JOIN public.chat_groups g ON g.id = m.group_id
    JOIN public.lessons l ON l.id = g.lesson_id
    CROSS JOIN LATERAL (SELECT public.group_access(g.id, p_user) AS access) a
    WHERE m.user_id = p_user AND m.status = 'active' AND a.access <> 'none'
  ) t
$$;

CREATE OR REPLACE FUNCTION public.chat_unread_total(p_user uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    coalesce((SELECT sum(CASE WHEN c.trainer_id = p_user THEN c.trainer_unread ELSE c.user_unread END)
                FROM public.conversations c WHERE c.trainer_id = p_user OR c.user_id = p_user), 0)
    +
    coalesce((SELECT sum(z.cnt) FROM (
       SELECT (SELECT count(*) FROM public.messages x
                WHERE x.group_id = m.group_id AND x.created_at > m.last_read_at
                  AND x.sender_id <> p_user AND x.deleted_at IS NULL) AS cnt
         FROM public.chat_group_members m
        WHERE m.user_id = p_user AND m.status = 'active'
          AND public.group_access(m.group_id, p_user) IN ('owner', 'active')
     ) z), 0)
$$;

-- ---------------------------------------------------------------------------
-- 6. XAVFSIZLIK: RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_groups_select ON public.chat_groups;
CREATE POLICY chat_groups_select ON public.chat_groups FOR SELECT TO authenticated
  USING (public.group_access_me(id) IN ('owner', 'active', 'expired'));

DROP POLICY IF EXISTS chat_group_members_select_own ON public.chat_group_members;
CREATE POLICY chat_group_members_select_own ON public.chat_group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Guruh xabarlarini faqat kirishi bor odam o'qiy oladi (Realtime ham shu qoidani ishlatadi)
DROP POLICY IF EXISTS messages_select_group ON public.messages;
CREATE POLICY messages_select_group ON public.messages FOR SELECT TO authenticated
  USING (group_id IS NOT NULL AND public.group_access_me(group_id) IN ('owner', 'active'));

-- Yozish faqat server orqali (API a'zolikni va media havolalarini tekshiradi)
REVOKE ALL ON public.chat_groups, public.chat_group_members FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.chat_groups, public.chat_group_members FROM authenticated;

REVOKE ALL ON FUNCTION public.group_access(uuid, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_group_list(uuid)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_unread_total(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.group_access_me(uuid)      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_access(uuid, uuid)  TO service_role;
GRANT EXECUTE ON FUNCTION public.chat_group_list(uuid)     TO service_role;
GRANT EXECUTE ON FUNCTION public.chat_unread_total(uuid)   TO service_role;
GRANT EXECUTE ON FUNCTION public.group_access_me(uuid)     TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. MAVJUD MA'LUMOTLAR (bir martalik, qayta ishga tushsa ham xavfsiz)
--    E'lon qilingan (yoki sotilgan) barcha darsliklar uchun guruh; xaridorlar a'zo qilinadi.
-- ---------------------------------------------------------------------------
INSERT INTO public.chat_groups (lesson_id, owner_id, name)
SELECT l.id, l.trainer_id, coalesce(nullif(left(btrim(l.title), 80), ''), 'Guruh')
  FROM public.lessons l
 WHERE l.status <> 'removed'
   AND (l.status = 'published' OR EXISTS (SELECT 1 FROM public.purchases p WHERE p.lesson_id = l.id AND p.status = 'paid'))
ON CONFLICT (lesson_id) DO NOTHING;

INSERT INTO public.chat_group_members (group_id, user_id, role)
SELECT g.id, g.owner_id, 'owner' FROM public.chat_groups g
ON CONFLICT DO NOTHING;

INSERT INTO public.chat_group_members (group_id, user_id, role)
SELECT g.id, p.user_id, 'member'
  FROM public.purchases p JOIN public.chat_groups g ON g.lesson_id = p.lesson_id
 WHERE p.status = 'paid' AND p.user_id <> g.owner_id
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. TEKSHIRUV (natija jadval bo'lib chiqadi)
-- ---------------------------------------------------------------------------
SELECT 'chat_groups / members / group_access / RLS' AS tekshiruv,
       CASE WHEN to_regclass('public.chat_groups') IS NOT NULL
             AND to_regclass('public.chat_group_members') IS NOT NULL
             AND to_regprocedure('public.group_access(uuid,uuid)') IS NOT NULL
             AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.chat_groups'::regclass)
             AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.chat_group_members'::regclass)
            THEN 'OK' ELSE 'XATO' END AS natija
UNION ALL
SELECT 'guruhlar soni (e''lon qilingan/sotilgan darsliklar uchun)', (SELECT count(*) FROM public.chat_groups)::text
UNION ALL
SELECT 'a''zolar soni (trenerlar + xaridorlar)', (SELECT count(*) FROM public.chat_group_members)::text
UNION ALL
SELECT 'darsligi bor, lekin guruhi yo''q (0 bo''lishi kerak)',
       (SELECT count(*) FROM public.lessons l WHERE l.status = 'published'
           AND NOT EXISTS (SELECT 1 FROM public.chat_groups g WHERE g.lesson_id = l.id))::text
UNION ALL
SELECT 'xaridi bor, lekin guruh a''zosi emas (0 bo''lishi kerak)',
       (SELECT count(*) FROM public.purchases p JOIN public.chat_groups g ON g.lesson_id = p.lesson_id
         WHERE p.status = 'paid' AND p.user_id <> g.owner_id
           AND NOT EXISTS (SELECT 1 FROM public.chat_group_members m WHERE m.group_id = g.id AND m.user_id = p.user_id))::text
UNION ALL
SELECT 'messages: eski rasmli xabarlar yangi turga o''tdi (0 bo''lishi kerak)',
       (SELECT count(*) FROM public.messages WHERE image_url IS NOT NULL AND type = 'text')::text;
