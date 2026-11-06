-- ============================================================================
-- TRAINERTOP — migration v15: Guruh moderatsiyasi
--   * A'zoga chora: yozishni cheklash (mute: 1 kun / 7 kun / 30 kun / muddatsiz) va guruhdan chiqarish —
--     ikkalasi ham SABAB bilan (ro'yxatdan tanlanadi yoki "boshqa" + izoh)
--   * Chiqarilgan a'zoning chat ro'yxatida guruh QOLADI (sabab bilan); darslikka kirish saqlanadi
--   * Admin ham chora ko'ra oladi; admin qo'ygan chorani trener bekor qila olmaydi
--   * Xabarga shikoyat (report), chora jurnali, AI tahlil keshi, admin uchun guruh statistikasi
-- v13 (guruhlar) va v14a dan KEYIN ishga tushiring. Qayta ishga tushirsa xavfsiz (idempotent).
-- DIQQAT: v15 ishga tushgach migration-v13 ni QAYTA ishga tushirmang — u group_access() va chat_group_list() ning
--   eski (moderatsiyasiz) variantini qaytarib qo'yadi. Kerak bo'lib qolsa, v13 dan keyin v15 ni yana ishga tushiring.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. A'zo qatoriga: joriy cheklov/chiqarish tafsilotlari
-- ---------------------------------------------------------------------------
ALTER TABLE public.chat_group_members ADD COLUMN IF NOT EXISTS muted_until   timestamptz;   -- NULL = cheklanmagan; 'infinity' = muddatsiz
ALTER TABLE public.chat_group_members ADD COLUMN IF NOT EXISTS mod_reason    text;
ALTER TABLE public.chat_group_members ADD COLUMN IF NOT EXISTS mod_note      text;
ALTER TABLE public.chat_group_members ADD COLUMN IF NOT EXISTS mod_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.chat_group_members ADD COLUMN IF NOT EXISTS mod_by_admin  boolean NOT NULL DEFAULT false;
ALTER TABLE public.chat_group_members ADD COLUMN IF NOT EXISTS mod_at        timestamptz;
ALTER TABLE public.chat_group_members ADD COLUMN IF NOT EXISTS dismissed_at  timestamptz;   -- chiqarilgan a'zo guruhni ro'yxatdan olib tashladi

DO $$ BEGIN
  ALTER TABLE public.chat_group_members ADD CONSTRAINT cgm_mod_reason_check CHECK (mod_reason IS NULL OR mod_reason IN ('adult', 'abuse', 'spam', 'offtopic', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.chat_group_members ADD CONSTRAINT cgm_mod_note_check CHECK (mod_note IS NULL OR char_length(mod_note) <= 500);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. Chora jurnali (tarix) — faqat server
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_group_actions (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id        uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,     -- chora ko'rilgan a'zo
  action          text NOT NULL CHECK (action IN ('mute', 'unmute', 'remove', 'restore')),
  reason          text,
  note            text,
  until           timestamptz,
  actor_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_is_admin  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_group_actions_group_idx ON public.chat_group_actions (group_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Shikoyatlar (xabarga) — faqat server. Xabar o'chirilsa ham nusxasi (snapshot) qoladi.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_reports (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id       uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  group_id         uuid REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  conversation_id  uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  reporter_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason           text NOT NULL CHECK (reason IN ('adult', 'abuse', 'spam', 'offtopic', 'other')),
  note             text CHECK (note IS NULL OR char_length(note) <= 500),
  snapshot         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
  handled_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  handled_at       timestamptz,
  handled_note     text CHECK (handled_note IS NULL OR char_length(handled_note) <= 500),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_reports_one_target CHECK ((group_id IS NOT NULL) <> (conversation_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS chat_reports_unique ON public.chat_reports (message_id, reporter_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_reports_status_idx ON public.chat_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_reports_group_idx ON public.chat_reports (group_id, status);

-- ---------------------------------------------------------------------------
-- 4. AI tahlil keshi (har bosishda pul sarflanmasin)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_group_analyses (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id       uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  result         jsonb NOT NULL,
  message_count  integer NOT NULL DEFAULT 0,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_group_analyses_group_idx ON public.chat_group_analyses (group_id, created_at DESC);

ALTER TABLE public.chat_group_actions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_analyses  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_group_actions, public.chat_reports, public.chat_group_analyses FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. KIRISH QOIDASI (yangilandi): + 'removed'
--    removed — trener/admin chiqargan: guruh ro'yxatda sabab bilan ko'rinadi, xabarlar ko'rinmaydi,
--              lekin DARSLIKKA kirish saqlanadi (bu funksiya faqat guruh haqida).
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
  IF NOT FOUND OR m.status = 'left' THEN RETURN 'none'; END IF;

  SELECT * INTO pur FROM public.purchases WHERE user_id = p_user AND lesson_id = g.lesson_id AND status = 'paid';
  IF NOT FOUND THEN RETURN 'none'; END IF;
  IF m.status = 'removed' THEN RETURN 'removed'; END IF;
  IF pur.purchase_type = 'monthly' AND pur.expires_at IS NOT NULL AND pur.expires_at <= now() THEN RETURN 'expired'; END IF;
  RETURN 'active';
END $$;

DROP POLICY IF EXISTS chat_groups_select ON public.chat_groups;
CREATE POLICY chat_groups_select ON public.chat_groups FOR SELECT TO authenticated
  USING (public.group_access_me(id) IN ('owner', 'active', 'expired', 'removed'));

-- ---------------------------------------------------------------------------
-- 6. Chat ro'yxati (yangilandi): chiqarilgan guruh ro'yxatda qoladi (olib tashlanmagan bo'lsa), cheklov ma'lumoti
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
                  ELSE 0 END,
        'muted_until',  CASE WHEN a.access = 'active' AND m.muted_until IS NOT NULL AND m.muted_until > now() THEN m.muted_until ELSE NULL END,
        'mod_reason',   CASE WHEN a.access = 'removed' THEN m.mod_reason ELSE NULL END,
        'mod_note',     CASE WHEN a.access = 'removed' THEN m.mod_note ELSE NULL END,
        'mod_by_admin', CASE WHEN a.access = 'removed' THEN m.mod_by_admin ELSE NULL END,
        'mod_at',       CASE WHEN a.access = 'removed' THEN coalesce(m.mod_at, m.removed_at) ELSE NULL END
      ) AS item
    FROM public.chat_group_members m
    JOIN public.chat_groups g ON g.id = m.group_id
    JOIN public.lessons l ON l.id = g.lesson_id
    CROSS JOIN LATERAL (SELECT public.group_access(g.id, p_user) AS access) a
    WHERE m.user_id = p_user AND m.status IN ('active', 'removed') AND a.access <> 'none'
      AND NOT (m.status = 'removed' AND m.dismissed_at IS NOT NULL)
  ) t
$$;

-- ---------------------------------------------------------------------------
-- 7. CHORA KO'RISH (yagona, atomik joy): trener yoki admin
--    p_action: mute | unmute | remove | restore
--    p_duration (faqat mute): 1d | 7d | 30d | forever
--    Qoidalar: sabab majburiy (mute/remove); "other" bo'lsa izoh ≥3 belgi; egasini/o'zini bo'lmaydi;
--    ADMIN qo'ygan chorani (mute yoki chiqarish) faqat admin bekor qila oladi.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_group_moderate(
  p_group uuid, p_target uuid, p_actor uuid, p_actor_admin boolean,
  p_action text, p_reason text, p_note text, p_duration text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  g public.chat_groups; m public.chat_group_members;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_until timestamptz; v_muted boolean; v_label text; v_title text; v_body text;
BEGIN
  SELECT * INTO g FROM public.chat_groups WHERE id = p_group;
  IF NOT FOUND THEN RAISE EXCEPTION 'GROUP_NOT_FOUND'; END IF;
  IF NOT coalesce(p_actor_admin, false) AND g.owner_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_action NOT IN ('mute', 'unmute', 'remove', 'restore') THEN RAISE EXCEPTION 'BAD_ACTION'; END IF;
  IF p_target = g.owner_id THEN RAISE EXCEPTION 'TARGET_IS_OWNER'; END IF;
  IF p_target IS NOT DISTINCT FROM p_actor THEN RAISE EXCEPTION 'SELF'; END IF;

  SELECT * INTO m FROM public.chat_group_members WHERE group_id = p_group AND user_id = p_target FOR UPDATE;
  IF NOT FOUND OR m.status = 'left' THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;

  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN RAISE EXCEPTION 'NOTE_TOO_LONG'; END IF;
  IF p_action IN ('mute', 'remove') THEN
    IF p_reason IS NULL OR p_reason NOT IN ('adult', 'abuse', 'spam', 'offtopic', 'other') THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
    IF p_reason = 'other' AND (v_note IS NULL OR char_length(v_note) < 3) THEN RAISE EXCEPTION 'NOTE_REQUIRED'; END IF;
  END IF;

  v_muted := m.muted_until IS NOT NULL AND m.muted_until > now();
  -- Admin qo'ygan chora amalda bo'lsa, trener hech narsani o'zgartira olmaydi
  IF NOT coalesce(p_actor_admin, false) AND m.mod_by_admin AND (m.status = 'removed' OR v_muted) THEN RAISE EXCEPTION 'ADMIN_LOCKED'; END IF;

  v_label := CASE p_reason WHEN 'adult' THEN '18+ kontent' WHEN 'abuse' THEN 'Haqorat / so''kinish' WHEN 'spam' THEN 'Spam / reklama'
                           WHEN 'offtopic' THEN 'Mavzudan tashqari' ELSE 'Boshqa sabab' END;

  IF p_action = 'mute' THEN
    IF m.status <> 'active' THEN RAISE EXCEPTION 'STATE_INVALID'; END IF;
    v_until := CASE p_duration WHEN '1d' THEN now() + interval '1 day' WHEN '7d' THEN now() + interval '7 days'
                               WHEN '30d' THEN now() + interval '30 days' WHEN 'forever' THEN 'infinity'::timestamptz
                               ELSE NULL END;
    IF v_until IS NULL THEN RAISE EXCEPTION 'BAD_DURATION'; END IF;
    UPDATE public.chat_group_members SET muted_until = v_until, mod_reason = p_reason, mod_note = v_note,
           mod_by = p_actor, mod_by_admin = coalesce(p_actor_admin, false), mod_at = now()
     WHERE group_id = p_group AND user_id = p_target;
    v_title := 'Guruhda yozish cheklandi';
    v_body  := '«' || g.name || '»: ' || v_label || CASE WHEN v_until = 'infinity' THEN ' (muddatsiz)' ELSE ' (' || to_char(v_until, 'DD.MM.YYYY') || ' gacha)' END;

  ELSIF p_action = 'unmute' THEN
    IF NOT v_muted THEN RAISE EXCEPTION 'STATE_INVALID'; END IF;
    UPDATE public.chat_group_members SET muted_until = NULL, mod_reason = NULL, mod_note = NULL, mod_by = NULL, mod_by_admin = false, mod_at = NULL
     WHERE group_id = p_group AND user_id = p_target;
    v_title := 'Guruhdagi cheklov olib tashlandi'; v_body := '«' || g.name || '» guruhida yana yoza olasiz';

  ELSIF p_action = 'remove' THEN
    IF m.status <> 'active' THEN RAISE EXCEPTION 'STATE_INVALID'; END IF;
    UPDATE public.chat_group_members SET status = 'removed', removed_at = now(), removed_by = p_actor,
           muted_until = NULL, mod_reason = p_reason, mod_note = v_note, mod_by = p_actor,
           mod_by_admin = coalesce(p_actor_admin, false), mod_at = now(), dismissed_at = NULL
     WHERE group_id = p_group AND user_id = p_target;
    v_title := 'Siz guruhdan chiqarildingiz';
    v_body  := '«' || g.name || '»: ' || v_label || '. Darslikka kirishingiz saqlanadi.';

  ELSE  -- restore
    IF m.status <> 'removed' THEN RAISE EXCEPTION 'STATE_INVALID'; END IF;
    UPDATE public.chat_group_members SET status = 'active', removed_at = NULL, removed_by = NULL, muted_until = NULL,
           mod_reason = NULL, mod_note = NULL, mod_by = NULL, mod_by_admin = false, mod_at = NULL, dismissed_at = NULL
     WHERE group_id = p_group AND user_id = p_target;
    v_title := 'Guruhga qaytarildingiz'; v_body := '«' || g.name || '» guruhiga qaytarildingiz';
  END IF;

  INSERT INTO public.chat_group_actions (group_id, user_id, action, reason, note, until, actor_id, actor_is_admin)
  VALUES (p_group, p_target, p_action, CASE WHEN p_action IN ('mute', 'remove') THEN p_reason END,
          CASE WHEN p_action IN ('mute', 'remove') THEN v_note END, CASE WHEN p_action = 'mute' THEN v_until END,
          p_actor, coalesce(p_actor_admin, false));

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_target, 'moderation', v_title, v_body, jsonb_build_object('group_id', p_group, 'action', p_action));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('action', p_action, 'user_id', p_target,
    'status', (SELECT status FROM public.chat_group_members WHERE group_id = p_group AND user_id = p_target),
    'muted_until', (SELECT muted_until FROM public.chat_group_members WHERE group_id = p_group AND user_id = p_target));
END $$;

-- ---------------------------------------------------------------------------
-- 8. ADMIN STATISTIKASI (faqat server)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_group_stats(p_search text, p_sort text, p_limit int, p_offset int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH base AS (
    SELECT g.id, g.name, g.lesson_id, l.title AS lesson_title, g.owner_id, po.full_name AS owner_name, g.is_archived,
           g.created_at, g.last_message_at,
      (SELECT count(*) FROM public.chat_group_members m WHERE m.group_id = g.id AND m.role = 'member' AND m.status = 'active') AS members,
      (SELECT count(*) FROM public.chat_group_members m WHERE m.group_id = g.id AND m.status = 'removed') AS removed,
      (SELECT count(*) FROM public.chat_group_members m WHERE m.group_id = g.id AND m.status = 'active' AND m.muted_until IS NOT NULL AND m.muted_until > now()) AS muted,
      (SELECT count(*) FROM public.messages x WHERE x.group_id = g.id AND x.deleted_at IS NULL) AS messages_total,
      (SELECT count(*) FROM public.messages x WHERE x.group_id = g.id AND x.deleted_at IS NULL AND x.created_at > now() - interval '7 days') AS messages_7d,
      (SELECT count(DISTINCT x.sender_id) FROM public.messages x WHERE x.group_id = g.id AND x.deleted_at IS NULL AND x.created_at > now() - interval '7 days') AS senders_7d,
      (SELECT count(*) FROM public.messages x WHERE x.group_id = g.id AND x.deleted_at IS NULL AND x.sender_id = g.owner_id AND x.created_at > now() - interval '7 days') AS owner_msgs_7d,
      (SELECT count(*) FROM public.chat_reports r WHERE r.group_id = g.id AND r.status = 'open') AS open_reports
    FROM public.chat_groups g
    JOIN public.lessons l ON l.id = g.lesson_id
    JOIN public.profiles po ON po.id = g.owner_id
    WHERE coalesce(p_search, '') = '' OR g.name ILIKE '%' || p_search || '%' OR l.title ILIKE '%' || p_search || '%' OR po.full_name ILIKE '%' || p_search || '%'
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM base),
    'rows', coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM (
        SELECT * FROM base
         ORDER BY CASE WHEN p_sort = 'members' THEN members WHEN p_sort = 'reports' THEN open_reports WHEN p_sort = 'messages' THEN messages_total ELSE messages_7d END DESC,
                  created_at DESC
         LIMIT greatest(1, least(coalesce(p_limit, 30), 100)) OFFSET greatest(0, coalesce(p_offset, 0))) s), '[]'::jsonb))
$$;

CREATE OR REPLACE FUNCTION public.admin_group_detail(p_group uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE g public.chat_groups; v_median numeric; v_answered int; v_total int;
BEGIN
  SELECT * INTO g FROM public.chat_groups WHERE id = p_group;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Trener javob tezligi (oxirgi 30 kun): a'zo xabaridan keyingi 48 soat ichidagi birinchi trener xabarigacha
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (r.created_at - q.created_at))), count(r.created_at), count(*)
    INTO v_median, v_answered, v_total
    FROM (SELECT created_at FROM public.messages WHERE group_id = p_group AND deleted_at IS NULL AND sender_id <> g.owner_id
             AND created_at > now() - interval '30 days') q
    LEFT JOIN LATERAL (SELECT created_at FROM public.messages
                        WHERE group_id = p_group AND sender_id = g.owner_id AND deleted_at IS NULL
                          AND created_at > q.created_at AND created_at < q.created_at + interval '48 hours'
                        ORDER BY created_at LIMIT 1) r ON true;

  RETURN jsonb_build_object(
    'response_median_seconds', v_median, 'member_msgs_30d', v_total, 'answered_within_48h', v_answered,
    'daily', coalesce((SELECT jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(c.n, 0)) ORDER BY d.day)
                         FROM generate_series((now() - interval '13 days')::date, now()::date, interval '1 day') AS d(day)
                         LEFT JOIN (SELECT created_at::date AS day, count(*) AS n FROM public.messages
                                     WHERE group_id = p_group AND deleted_at IS NULL AND created_at > now() - interval '14 days' GROUP BY 1) c ON c.day = d.day::date), '[]'::jsonb),
    'top_senders', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', t.sender_id, 'name', t.name, 'is_owner', t.sender_id = g.owner_id, 'count', t.n) ORDER BY t.n DESC)
                               FROM (SELECT x.sender_id, p.full_name AS name, count(*) AS n FROM public.messages x JOIN public.profiles p ON p.id = x.sender_id
                                      WHERE x.group_id = p_group AND x.deleted_at IS NULL AND x.created_at > now() - interval '30 days'
                                      GROUP BY x.sender_id, p.full_name ORDER BY count(*) DESC LIMIT 5) t), '[]'::jsonb),
    'media_30d', (SELECT jsonb_build_object('text', count(*) FILTER (WHERE type = 'text'), 'image', count(*) FILTER (WHERE type = 'image'),
                                            'voice', count(*) FILTER (WHERE type = 'voice'), 'video', count(*) FILTER (WHERE type = 'video'))
                    FROM public.messages WHERE group_id = p_group AND deleted_at IS NULL AND created_at > now() - interval '30 days'),
    'deleted_total', (SELECT count(*) FROM public.messages WHERE group_id = p_group AND deleted_at IS NOT NULL),
    'actions_total', (SELECT count(*) FROM public.chat_group_actions WHERE group_id = p_group),
    'open_reports', (SELECT count(*) FROM public.chat_reports WHERE group_id = p_group AND status = 'open')
  );
END $$;

-- ---------------------------------------------------------------------------
-- 9. Huquqlar: hammasi faqat server (service_role)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.chat_group_moderate(uuid, uuid, uuid, boolean, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_group_stats(text, text, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_group_detail(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_group_moderate(uuid, uuid, uuid, boolean, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_group_stats(text, text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_group_detail(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 10. TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'chora funksiyasi va yangi jadvallar' AS tekshiruv,
       CASE WHEN to_regprocedure('public.chat_group_moderate(uuid,uuid,uuid,boolean,text,text,text,text)') IS NOT NULL
             AND to_regclass('public.chat_reports') IS NOT NULL AND to_regclass('public.chat_group_actions') IS NOT NULL
             AND to_regclass('public.chat_group_analyses') IS NOT NULL THEN 'OK' ELSE 'XATO' END AS natija
UNION ALL SELECT 'yangi jadvallarda RLS (brauzer yopiq)',
       CASE WHEN (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.chat_reports'::regclass, 'public.chat_group_actions'::regclass, 'public.chat_group_analyses'::regclass)) THEN 'OK' ELSE 'XATO' END
UNION ALL SELECT 'chiqarilgan a''zolar soni (eski v13 chiqarishlar — sababsiz)', (SELECT count(*) FROM public.chat_group_members WHERE status = 'removed')::text;
