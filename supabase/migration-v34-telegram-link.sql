-- ============================================================================
-- TRAINERTOP — migration v34: Telegram'ni mavjud akkauntga ULASH + email qo'shish
--
-- 1) "Ulash" so'rovlari: telegram_login_requests ga `mode` ('login' | 'link') va `link_user_id` qo'shiladi. Ulash so'rovi
--    SESSIYA bermaydi (foydalanuvchi allaqachon kirgan) — faqat Telegram'ni shu akkauntga bog'laydi.
-- 2) tg_account_blockers(user) — akkaunt "bo'shmi" degan savolga ANIQ javob: bo'sh ro'yxat = bo'sh. Qoida:
--      • role = 'user' (trener/admin emas);
--      • sintetik email (tg<ID>@users.trainertop.uz) — ya'ni o'zining email/Google/Apple kirishi YO'Q;
--      • profiles(id) ga bog'langan HAR QANDAY jadvalda qator yo'q (FK'lar katalogdan skanerlanadi — kelajakda qo'shiladigan
--        jadvallar ham avtomatik "ma'lumot" hisoblanadi). Istisno — faqat tizim o'zi yozadigan jadvallar:
--        telegram_accounts, telegram_login_requests, device_tokens, notifications, announcement_reads, announcement_views.
--      • ko'p ustunli FK (skaner o'qiy olmaydi) bo'lsa — xavfsiz tomon: akkaunt "bo'sh emas" deb hisoblanadi.
-- 3) tg_link_apply — ulashni BITTA tranzaksiyada hal qiladi: Telegram bo'sh bo'lmagan boshqa akkauntga ulangan bo'lsa hech narsa
--    o'zgarmaydi (conflict); bo'sh dublikat bo'lsa u o'chiriladi va Telegram joriy akkauntga ulanadi.
-- 4) email_add_requests — Telegram orqali ochilgan akkauntga email qo'shish uchun tasdiqlash kodlari (kod hash'i + parol shifrlangan,
--    ilova darajasida; bazada ochiq parol HECH QACHON yo'q).
--
-- Hamma jadval/funksiya FAQAT server (service_role) uchun. Bog'liqlik: v33. Qayta ishga tushirsa xavfsiz.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) telegram_login_requests: ulash rejimi
-- ---------------------------------------------------------------------------
ALTER TABLE public.telegram_login_requests ADD COLUMN IF NOT EXISTS mode             text    NOT NULL DEFAULT 'login';
ALTER TABLE public.telegram_login_requests ADD COLUMN IF NOT EXISTS link_user_id     uuid    REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.telegram_login_requests ADD COLUMN IF NOT EXISTS result_code      text;                       -- conflict sababi (TELEGRAM_TAKEN | USER_HAS_TELEGRAM)
ALTER TABLE public.telegram_login_requests ADD COLUMN IF NOT EXISTS replaced_account  boolean NOT NULL DEFAULT false; -- bo'sh dublikat o'chirildimi

ALTER TABLE public.telegram_login_requests DROP CONSTRAINT IF EXISTS telegram_login_requests_mode_check;
ALTER TABLE public.telegram_login_requests ADD  CONSTRAINT telegram_login_requests_mode_check CHECK (mode IN ('login', 'link'));
ALTER TABLE public.telegram_login_requests DROP CONSTRAINT IF EXISTS telegram_login_link_user_chk;
ALTER TABLE public.telegram_login_requests ADD  CONSTRAINT telegram_login_link_user_chk CHECK (mode <> 'link' OR link_user_id IS NOT NULL);
ALTER TABLE public.telegram_login_requests DROP CONSTRAINT IF EXISTS telegram_login_requests_status_check;
ALTER TABLE public.telegram_login_requests ADD  CONSTRAINT telegram_login_requests_status_check CHECK (status IN ('pending', 'confirmed', 'consumed', 'cancelled', 'linked', 'conflict'));
-- har rejimning o'z holatlari: kirish — confirmed/consumed, ulash — linked/conflict (kirish so'rovi hech qachon "linked" bo'lmaydi va aksincha)
ALTER TABLE public.telegram_login_requests DROP CONSTRAINT IF EXISTS telegram_login_mode_status_chk;
ALTER TABLE public.telegram_login_requests ADD  CONSTRAINT telegram_login_mode_status_chk CHECK (
  (mode = 'login' AND status IN ('pending', 'confirmed', 'consumed', 'cancelled')) OR
  (mode = 'link'  AND status IN ('pending', 'linked', 'conflict', 'cancelled')));
ALTER TABLE public.telegram_login_requests DROP CONSTRAINT IF EXISTS telegram_login_confirmed_chk;
ALTER TABLE public.telegram_login_requests ADD  CONSTRAINT telegram_login_confirmed_chk CHECK (status NOT IN ('confirmed', 'consumed', 'linked') OR (user_id IS NOT NULL AND telegram_user_id IS NOT NULL));

-- Kirish funksiyalari FAQAT 'login' rejimidagi so'rovlar bilan ishlaydi (ulash so'rovi orqali sessiya olib bo'lmasin)
CREATE OR REPLACE FUNCTION public.tg_login_confirm(p_login_id uuid, p_telegram_user_id bigint, p_user_id uuid, p_is_new boolean)
RETURNS SETOF public.telegram_login_requests LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.telegram_login_requests
     SET status = 'confirmed', telegram_user_id = p_telegram_user_id, user_id = p_user_id, is_new_user = p_is_new,
         confirmed_at = now(), expires_at = greatest(expires_at, now() + interval '60 seconds')
   WHERE id = p_login_id AND mode = 'login' AND status = 'pending' AND expires_at > now()
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.tg_login_consume(p_login_id uuid, p_secret_hash text)
RETURNS TABLE (outcome text, user_id uuid, telegram_user_id bigint, is_new_user boolean, platform text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.telegram_login_requests;
BEGIN
  SELECT * INTO r FROM public.telegram_login_requests WHERE id = p_login_id FOR UPDATE;
  IF NOT FOUND OR r.mode <> 'login' OR r.secret_hash IS DISTINCT FROM p_secret_hash THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::bigint, NULL::boolean, NULL::text; RETURN;
  END IF;
  IF r.status = 'cancelled' THEN RETURN QUERY SELECT 'cancelled'::text, NULL::uuid, NULL::bigint, NULL::boolean, r.platform; RETURN; END IF;
  IF r.status = 'consumed'  THEN RETURN QUERY SELECT 'consumed'::text,  NULL::uuid, NULL::bigint, NULL::boolean, r.platform; RETURN; END IF;
  IF r.expires_at <= now()  THEN RETURN QUERY SELECT 'expired'::text,   NULL::uuid, NULL::bigint, NULL::boolean, r.platform; RETURN; END IF;
  IF r.status = 'pending'   THEN RETURN QUERY SELECT 'pending'::text,   NULL::uuid, NULL::bigint, NULL::boolean, r.platform; RETURN; END IF;
  UPDATE public.telegram_login_requests SET status = 'consumed', consumed_at = now() WHERE id = p_login_id;
  RETURN QUERY SELECT 'claimed'::text, r.user_id, r.telegram_user_id, r.is_new_user, r.platform;
END $$;

-- ---------------------------------------------------------------------------
-- 2) "Bo'sh akkaunt" qoidasi
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_account_blockers(p_user uuid) RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p public.profiles; res text[] := '{}'; r record; ex boolean;
  ignored text[] := ARRAY['telegram_accounts', 'telegram_login_requests', 'device_tokens', 'notifications', 'announcement_reads', 'announcement_views'];
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = p_user;
  IF NOT FOUND THEN RETURN ARRAY['no_profile']; END IF;
  IF p.role <> 'user' THEN res := array_append(res, 'role_' || p.role); END IF;
  IF p.email !~* '^tg[0-9]+@users\.trainertop\.uz$' THEN res := array_append(res, 'own_login'); END IF;
  -- bir ustunli FK'lar: shu foydalanuvchiga tegishli qator bormi
  FOR r IN
    SELECT DISTINCT cl.relname::text AS tbl, a.attname::text AS col
      FROM pg_constraint co
      JOIN pg_class cl ON cl.oid = co.conrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = co.conkey[1]
     WHERE co.contype = 'f' AND co.confrelid = 'public.profiles'::regclass AND ns.nspname = 'public'
       AND cardinality(co.conkey) = 1 AND cl.relname <> ALL (ignored)
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1)', r.tbl, r.col) INTO ex USING p_user;
    IF ex THEN res := array_append(res, r.tbl); END IF;
  END LOOP;
  -- ko'p ustunli FK: tekshirib bo'lmaydi → xavfsiz tomon (blokirovka)
  FOR r IN
    SELECT DISTINCT cl.relname::text AS tbl FROM pg_constraint co JOIN pg_class cl ON cl.oid = co.conrelid JOIN pg_namespace ns ON ns.oid = cl.relnamespace
     WHERE co.contype = 'f' AND co.confrelid = 'public.profiles'::regclass AND ns.nspname = 'public' AND cardinality(co.conkey) > 1 AND cl.relname <> ALL (ignored)
  LOOP res := array_append(res, r.tbl || ':multi_fk'); END LOOP;
  RETURN ARRAY(SELECT DISTINCT x FROM unnest(res) AS x ORDER BY x);
END $$;

-- ---------------------------------------------------------------------------
-- 3) Ulash: boshlash, holat, qo'llash
-- ---------------------------------------------------------------------------
-- Boshlash: tg_login_start kabi (IP 10 / qurilma 5 / 10 daqiqa) + bitta foydalanuvchi uchun 5 ta / 10 daqiqa.
CREATE OR REPLACE FUNCTION public.tg_link_start(
  p_secret_hash text, p_platform text, p_user_id uuid, p_ip_key text, p_device_key text DEFAULT NULL,
  p_ttl_seconds int DEFAULT 300, p_ip_limit int DEFAULT 10, p_device_limit int DEFAULT 5, p_user_limit int DEFAULT 5, p_window_seconds int DEFAULT 600
) RETURNS public.telegram_login_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.telegram_login_requests;
BEGIN
  DELETE FROM public.telegram_login_requests WHERE expires_at < now() - interval '1 hour';
  IF (SELECT count(*) FROM public.telegram_login_requests WHERE ip_key = p_ip_key AND created_at > now() - make_interval(secs => p_window_seconds)) >= p_ip_limit THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  IF p_device_key IS NOT NULL AND (SELECT count(*) FROM public.telegram_login_requests WHERE device_key = p_device_key AND created_at > now() - make_interval(secs => p_window_seconds)) >= p_device_limit THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  IF (SELECT count(*) FROM public.telegram_login_requests WHERE mode = 'link' AND link_user_id = p_user_id AND created_at > now() - make_interval(secs => p_window_seconds)) >= p_user_limit THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  INSERT INTO public.telegram_login_requests (secret_hash, platform, ip_key, device_key, expires_at, mode, link_user_id)
  VALUES (p_secret_hash, p_platform, p_ip_key, p_device_key, now() + make_interval(secs => p_ttl_seconds), 'link', p_user_id)
  RETURNING * INTO r;
  RETURN r;
END $$;

-- Holat (faqat ulash so'rovining EGASI ko'ra oladi). Natija: not_found (yo'q / sir noto'g'ri / boshqa foydalanuvchi / kirish so'rovi),
-- pending, expired, cancelled, linked, conflict. O'qish — takrorlash xavfsiz (hech narsa iste'mol qilinmaydi).
CREATE OR REPLACE FUNCTION public.tg_link_status(p_login_id uuid, p_secret_hash text, p_user_id uuid)
RETURNS TABLE (outcome text, code text, replaced boolean, username text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.telegram_login_requests; u text;
BEGIN
  SELECT * INTO r FROM public.telegram_login_requests WHERE id = p_login_id;
  IF NOT FOUND OR r.mode <> 'link' OR r.link_user_id IS DISTINCT FROM p_user_id OR r.secret_hash IS DISTINCT FROM p_secret_hash THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::boolean, NULL::text; RETURN;
  END IF;
  IF r.status = 'linked' THEN
    SELECT t.username INTO u FROM public.telegram_accounts t WHERE t.user_id = r.link_user_id;
    RETURN QUERY SELECT 'linked'::text, NULL::text, r.replaced_account, u; RETURN;
  END IF;
  IF r.status = 'conflict'  THEN RETURN QUERY SELECT 'conflict'::text,  r.result_code, false, NULL::text; RETURN; END IF;
  IF r.status = 'cancelled' THEN RETURN QUERY SELECT 'cancelled'::text, NULL::text,    false, NULL::text; RETURN; END IF;
  IF r.expires_at <= now()  THEN RETURN QUERY SELECT 'expired'::text,   NULL::text,    false, NULL::text; RETURN; END IF;
  RETURN QUERY SELECT 'pending'::text, NULL::text, false, NULL::text;
END $$;

-- Qo'llash (botda "✅ Ulash" bosilganda). Natija (outcome):
--   stale              — so'rov kutilayotgan ulash so'rovi emas / muddati o'tgan (hech narsa o'zgarmadi)
--   linked             — Telegram hech kimga ulanmagan edi → ulandi
--   linked_replaced    — Telegram BO'SH dublikatga ulangan edi → dublikat o'chirildi (deleted_user, deleted_avatar), Telegram ulandi
--   conflict_taken     — Telegram BO'SH BO'LMAGAN boshqa akkauntga ulangan (reasons — sabablar); hech narsa o'zgarmadi
--   conflict_user_has_telegram — joriy akkauntga boshqa Telegram allaqachon ulangan; hech narsa o'zgarmadi
-- Hammasi bitta tranzaksiyada; parallel chaqiruvlar (bir Telegram / bir foydalanuvchi) advisory lock bilan ketma-ketlashtiriladi;
-- o'chiriladigan dublikat profili FOR UPDATE bilan qulflanadi (tekshiruvdan keyin unga yangi ma'lumot yozilib qolmasin).
CREATE OR REPLACE FUNCTION public.tg_link_apply(p_login_id uuid, p_telegram_user_id bigint, p_username text DEFAULT NULL, p_first_name text DEFAULT NULL, p_last_name text DEFAULT NULL)
RETURNS TABLE (outcome text, reasons text[], deleted_user uuid, deleted_avatar text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.telegram_login_requests; v_user uuid; v_cur bigint; v_other uuid; v_reasons text[]; v_avatar text;
BEGIN
  SELECT * INTO r FROM public.telegram_login_requests WHERE id = p_login_id FOR UPDATE;
  IF NOT FOUND OR r.mode <> 'link' OR r.status <> 'pending' OR r.expires_at <= now() THEN
    RETURN QUERY SELECT 'stale'::text, NULL::text[], NULL::uuid, NULL::text; RETURN;
  END IF;
  v_user := r.link_user_id;
  PERFORM pg_advisory_xact_lock(hashtextextended('tg-link:tg:' || p_telegram_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('tg-link:user:' || v_user::text, 0));
  PERFORM 1 FROM public.profiles WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.telegram_login_requests SET status = 'cancelled' WHERE id = p_login_id;
    RETURN QUERY SELECT 'stale'::text, NULL::text[], NULL::uuid, NULL::text; RETURN;
  END IF;

  -- 1) joriy akkauntga allaqachon Telegram ulanganmi
  SELECT t.telegram_user_id INTO v_cur FROM public.telegram_accounts t WHERE t.user_id = v_user;
  IF v_cur IS NOT NULL THEN
    IF v_cur = p_telegram_user_id THEN
      UPDATE public.telegram_login_requests SET status = 'linked', telegram_user_id = p_telegram_user_id, user_id = v_user, confirmed_at = now() WHERE id = p_login_id;
      RETURN QUERY SELECT 'linked'::text, NULL::text[], NULL::uuid, NULL::text; RETURN;
    END IF;
    UPDATE public.telegram_login_requests SET status = 'conflict', result_code = 'USER_HAS_TELEGRAM', telegram_user_id = p_telegram_user_id, confirmed_at = now() WHERE id = p_login_id;
    RETURN QUERY SELECT 'conflict_user_has_telegram'::text, NULL::text[], NULL::uuid, NULL::text; RETURN;
  END IF;

  -- 2) bu Telegram boshqa akkauntga ulanganmi
  SELECT t.user_id INTO v_other FROM public.telegram_accounts t WHERE t.telegram_user_id = p_telegram_user_id;
  IF v_other IS NOT NULL THEN
    PERFORM 1 FROM public.profiles WHERE id = v_other FOR UPDATE;
    v_reasons := public.tg_account_blockers(v_other);
    IF cardinality(v_reasons) > 0 THEN
      UPDATE public.telegram_login_requests SET status = 'conflict', result_code = 'TELEGRAM_TAKEN', telegram_user_id = p_telegram_user_id, confirmed_at = now() WHERE id = p_login_id;
      RETURN QUERY SELECT 'conflict_taken'::text, v_reasons, NULL::uuid, NULL::text; RETURN;
    END IF;
    SELECT pr.avatar_url INTO v_avatar FROM public.profiles pr WHERE pr.id = v_other;
    BEGIN
      DELETE FROM auth.users WHERE id = v_other;     -- profiles va bog'liq qatorlar cascade bilan o'chadi
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.telegram_login_requests SET status = 'conflict', result_code = 'TELEGRAM_TAKEN', telegram_user_id = p_telegram_user_id, confirmed_at = now() WHERE id = p_login_id;
      RETURN QUERY SELECT 'conflict_taken'::text, ARRAY['delete_failed']::text[], NULL::uuid, NULL::text; RETURN;
    END;
  END IF;

  -- 3) ulash
  BEGIN
    INSERT INTO public.telegram_accounts (telegram_user_id, user_id, username, first_name, last_name) VALUES (p_telegram_user_id, v_user, p_username, p_first_name, p_last_name);
  EXCEPTION WHEN unique_violation THEN
    -- parallel kirish oqimi shu Telegram uchun yangi akkaunt ochib ulgurgan — hech narsa o'zgartirilmaydi
    RAISE EXCEPTION 'TG_LINK_RACE';
  END;
  UPDATE public.telegram_login_requests SET status = 'linked', telegram_user_id = p_telegram_user_id, user_id = v_user, confirmed_at = now(), replaced_account = (v_other IS NOT NULL) WHERE id = p_login_id;
  RETURN QUERY SELECT CASE WHEN v_other IS NULL THEN 'linked' ELSE 'linked_replaced' END::text, NULL::text[], v_other, v_avatar;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Email qo'shish (faqat Telegram orqali ochilgan akkaunt): tasdiqlash kodlari
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_add_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email           text        NOT NULL,
  code_hash       text        NOT NULL,                 -- HMAC(kod) — kodning o'zi saqlanmaydi
  password_sealed text        NOT NULL,                 -- AES-256-GCM (ilova darajasida) — ochiq parol saqlanmaydi
  attempts        int         NOT NULL DEFAULT 0,
  ip_key          text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  consumed_at     timestamptz
);
CREATE INDEX IF NOT EXISTS email_add_user_idx ON public.email_add_requests (user_id, created_at);
CREATE INDEX IF NOT EXISTS email_add_ip_idx   ON public.email_add_requests (ip_key, created_at);
ALTER TABLE public.email_add_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_add_requests FROM anon, authenticated;
GRANT ALL ON public.email_add_requests TO service_role;

-- Boshlash: bir foydalanuvchi 3 ta / soat, bir IP 10 ta / soat; oldingi faol so'rovlar bekor bo'ladi; 1 kundan eski qatorlar tozalanadi.
CREATE OR REPLACE FUNCTION public.email_add_start(
  p_user uuid, p_email text, p_code_hash text, p_password_sealed text, p_ip_key text,
  p_ttl_seconds int DEFAULT 600, p_user_limit int DEFAULT 3, p_ip_limit int DEFAULT 10, p_window_seconds int DEFAULT 3600
) RETURNS public.email_add_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.email_add_requests;
BEGIN
  DELETE FROM public.email_add_requests WHERE created_at < now() - interval '1 day';
  IF (SELECT count(*) FROM public.email_add_requests WHERE user_id = p_user AND created_at > now() - make_interval(secs => p_window_seconds)) >= p_user_limit THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  IF (SELECT count(*) FROM public.email_add_requests WHERE ip_key = p_ip_key AND created_at > now() - make_interval(secs => p_window_seconds)) >= p_ip_limit THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
  UPDATE public.email_add_requests SET consumed_at = now() WHERE user_id = p_user AND consumed_at IS NULL;
  INSERT INTO public.email_add_requests (user_id, email, code_hash, password_sealed, ip_key, expires_at)
  VALUES (p_user, lower(p_email), p_code_hash, p_password_sealed, p_ip_key, now() + make_interval(secs => p_ttl_seconds))
  RETURNING * INTO r;
  RETURN r;
END $$;

-- Kodni tekshirish (bitta qadam, atomik). outcome: no_request, expired, too_many, bad_code (attempts_left), ok (password_sealed bilan; so'rov iste'mol qilinadi).
CREATE OR REPLACE FUNCTION public.email_add_attempt(p_user uuid, p_email text, p_code_hash text, p_max_attempts int DEFAULT 5)
RETURNS TABLE (outcome text, attempts_left int, request_id uuid, password_sealed text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.email_add_requests;
BEGIN
  SELECT * INTO r FROM public.email_add_requests q WHERE q.user_id = p_user AND q.email = lower(p_email) AND q.consumed_at IS NULL ORDER BY q.created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'no_request'::text, 0, NULL::uuid, NULL::text; RETURN; END IF;
  IF r.expires_at <= now() THEN RETURN QUERY SELECT 'expired'::text, 0, NULL::uuid, NULL::text; RETURN; END IF;
  IF r.attempts >= p_max_attempts THEN RETURN QUERY SELECT 'too_many'::text, 0, NULL::uuid, NULL::text; RETURN; END IF;
  IF r.code_hash = p_code_hash THEN
    UPDATE public.email_add_requests SET consumed_at = now() WHERE id = r.id;
    RETURN QUERY SELECT 'ok'::text, p_max_attempts - r.attempts, r.id, r.password_sealed; RETURN;
  END IF;
  UPDATE public.email_add_requests SET attempts = attempts + 1 WHERE id = r.id;
  RETURN QUERY SELECT 'bad_code'::text, p_max_attempts - r.attempts - 1, NULL::uuid, NULL::text;
END $$;

-- Kod to'g'ri bo'lib, lekin keyingi qadam (email almashtirish) vaqtincha muvaffaqiyatsiz bo'lsa — so'rovni qayta ishlatish mumkin holatga qaytaradi.
CREATE OR REPLACE FUNCTION public.email_add_release(p_request uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n int;
BEGIN
  UPDATE public.email_add_requests SET consumed_at = NULL WHERE id = p_request AND consumed_at > now() - interval '60 seconds' AND expires_at > now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

-- ---------------------------------------------------------------------------
-- Huquqlar: hamma funksiya faqat service_role uchun
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.tg_account_blockers(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_link_start(text, text, uuid, text, text, int, int, int, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_link_status(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_link_apply(uuid, bigint, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_add_start(uuid, text, text, text, text, int, int, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_add_attempt(uuid, text, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_add_release(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_login_confirm(uuid, bigint, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_login_consume(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_account_blockers(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_link_start(text, text, uuid, text, text, int, int, int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_link_status(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_link_apply(uuid, bigint, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_add_start(uuid, text, text, text, text, int, int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_add_attempt(uuid, text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_add_release(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_login_confirm(uuid, bigint, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_login_consume(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v34: telegram link + email add' AS tekshiruv,
       CASE WHEN to_regprocedure('public.tg_account_blockers(uuid)') IS NOT NULL
             AND to_regprocedure('public.tg_link_start(text,text,uuid,text,text,integer,integer,integer,integer,integer)') IS NOT NULL
             AND to_regprocedure('public.tg_link_status(uuid,text,uuid)') IS NOT NULL
             AND to_regprocedure('public.tg_link_apply(uuid,bigint,text,text,text)') IS NOT NULL
             AND to_regprocedure('public.email_add_start(uuid,text,text,text,text,integer,integer,integer,integer)') IS NOT NULL
             AND to_regprocedure('public.email_add_attempt(uuid,text,text,integer)') IS NOT NULL
             AND to_regprocedure('public.email_add_release(uuid)') IS NOT NULL
             AND to_regclass('public.email_add_requests') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'telegram_login_requests' AND column_name = 'link_user_id')
        THEN 'OK' ELSE 'XATO' END AS natija;
