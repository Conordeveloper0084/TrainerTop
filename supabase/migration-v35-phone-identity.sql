-- ============================================================================
-- TRAINERTOP — migration v35: TELEFON RAQAM — asosiy identifikator (1-bosqich: Telegram orqali, SMS'siz)
--
-- Nima qiladi:
--  1) profiles: phone (E.164, UNIQUE) + phone_verified_at + phone_source ('telegram' | keyinchalik 'sms').
--     DB darajasida: raqam FAQAT tasdiqlangan holda bo'lishi mumkin (CHECK), ikki akkauntda bir raqam bo'lmaydi (UNIQUE),
--     brauzer (anon/authenticated) bu ustunlarni o'zgartira olmaydi (trigger), o'zgargan raqam tarixga yoziladi.
--     ESKI erkin matnli "telefon" qiymatlari (tasdiqlanmagan) tozalanadi, lekin _phone_backup_v35 jadvaliga saqlab qo'yiladi.
--  2) telegram_login_requests: bot qadamlari uchun ustunlar (kim /start bosdi, qaysi raqam ulashildi).
--  3) tg_identify — tasdiqdan keyin akkauntni BITTA tranzaksiyada aniqlaydi (Telegram ID bo'yicha / raqam bo'yicha / yangi).
--  4) tg_link_apply — ulash oqimida ham raqam olinadi va akkauntga yoziladi (v34 funksiyasi kengaytirildi; imzosi o'zgarmagan).
--  5) tg_account_blockers — phone_history / phone_conflicts "ma'lumot" hisoblanmaydi (bo'sh dublikat qoidasi buzilmasin).
--  6) phone_history, phone_conflicts, clear_user_phone.
--
-- Hamma yangi jadval/funksiya FAQAT server (service_role) uchun. Bog'liqlik: v33, v34. Qayta ishga tushirsa xavfsiz.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_source      text;

-- Eski (foydalanuvchi o'zi yozgan, TASDIQLANMAGAN) raqamlar: zaxira nusxa → tozalash. Tasdiqlanganlarga tegilmaydi.
CREATE TABLE IF NOT EXISTS public._phone_backup_v35 (id uuid PRIMARY KEY, phone text NOT NULL, saved_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public._phone_backup_v35 (id, phone) SELECT id, phone FROM public.profiles WHERE phone IS NOT NULL AND phone_verified_at IS NULL ON CONFLICT (id) DO NOTHING;
UPDATE public.profiles SET phone = NULL WHERE phone IS NOT NULL AND phone_verified_at IS NULL;
ALTER TABLE public._phone_backup_v35 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._phone_backup_v35 FROM anon, authenticated;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_chk;
ALTER TABLE public.profiles ADD  CONSTRAINT profiles_phone_chk CHECK (
  (phone IS NULL AND phone_verified_at IS NULL AND phone_source IS NULL) OR
  (phone IS NOT NULL AND phone ~ '^\+[1-9][0-9]{6,14}$' AND phone_verified_at IS NOT NULL AND phone_source IS NOT NULL AND phone_source IN ('telegram', 'sms')));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_uniq ON public.profiles (phone) WHERE phone IS NOT NULL;

-- Tarix va to'qnashuvlar (faqat server)
CREATE TABLE IF NOT EXISTS public.phone_history (
  id          bigserial   PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone       text        NOT NULL,
  source      text,
  verified_at timestamptz,
  replaced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS phone_history_user_idx ON public.phone_history (user_id, replaced_at DESC);
CREATE TABLE IF NOT EXISTS public.phone_conflicts (
  id               bigserial   PRIMARY KEY,
  telegram_user_id bigint      NOT NULL,
  user_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,   -- kirilgan (Telegram bog'langan) akkaunt
  phone            text        NOT NULL,
  phone_owner_id   uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,            -- raqam tegishli bo'lgan boshqa akkaunt
  kind             text        NOT NULL CHECK (kind IN ('telegram_account_vs_phone_owner', 'phone_owner_has_other_telegram')),
  seen_count       int         NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS phone_conflicts_open_uniq ON public.phone_conflicts (telegram_user_id, phone, kind) WHERE resolved_at IS NULL;
ALTER TABLE public.phone_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_conflicts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phone_history, public.phone_conflicts FROM anon, authenticated;
GRANT ALL ON public.phone_history, public.phone_conflicts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.phone_history_id_seq, public.phone_conflicts_id_seq TO service_role;

-- Himoya: brauzer (anon/authenticated) telefon ustunlarini yozolmaydi; raqam null bo'lsa tasdiq belgilari ham null
CREATE OR REPLACE FUNCTION public.profiles_phone_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() = 1 AND current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN NEW.phone := NULL; NEW.phone_verified_at := NULL; NEW.phone_source := NULL;
    ELSE NEW.phone := OLD.phone; NEW.phone_verified_at := OLD.phone_verified_at; NEW.phone_source := OLD.phone_source; END IF;
  END IF;
  IF NEW.phone IS NULL THEN NEW.phone_verified_at := NULL; NEW.phone_source := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_profiles_phone_guard ON public.profiles;
CREATE TRIGGER trg_profiles_phone_guard BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_phone_guard();

-- O'zgargan/olib tashlangan raqam tarixga yoziladi
CREATE OR REPLACE FUNCTION public.profiles_phone_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.phone IS NOT NULL AND OLD.phone IS DISTINCT FROM NEW.phone THEN
    INSERT INTO public.phone_history (user_id, phone, source, verified_at) VALUES (OLD.id, OLD.phone, OLD.phone_source, OLD.phone_verified_at);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_profiles_phone_history ON public.profiles;
CREATE TRIGGER trg_profiles_phone_history AFTER UPDATE OF phone ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_phone_history();

-- Hisobni o'chirishda: raqam, tarix va to'qnashuv yozuvlari butunlay tozalanadi (shaxsiy ma'lumot qolmasin)
CREATE OR REPLACE FUNCTION public.clear_user_phone(p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.profiles SET phone = NULL WHERE id = p_user;
  DELETE FROM public.phone_history   WHERE user_id = p_user;
  DELETE FROM public.phone_conflicts WHERE user_id = p_user OR phone_owner_id = p_user;
END $$;

-- ---------------------------------------------------------------------------
-- 2) telegram_login_requests: bot qadamlari
-- ---------------------------------------------------------------------------
ALTER TABLE public.telegram_login_requests ADD COLUMN IF NOT EXISTS started_by_tg     bigint;        -- so'nggi /start bosgan Telegram foydalanuvchisi
ALTER TABLE public.telegram_login_requests ADD COLUMN IF NOT EXISTS started_at        timestamptz;
ALTER TABLE public.telegram_login_requests ADD COLUMN IF NOT EXISTS phone             text;          -- botda ulashilgan raqam (E.164)
ALTER TABLE public.telegram_login_requests ADD COLUMN IF NOT EXISTS phone_tg_user_id  bigint;        -- raqamni ulashgan Telegram foydalanuvchisi
ALTER TABLE public.telegram_login_requests ADD COLUMN IF NOT EXISTS phone_at          timestamptz;
ALTER TABLE public.telegram_login_requests DROP CONSTRAINT IF EXISTS telegram_login_phone_chk;
ALTER TABLE public.telegram_login_requests ADD  CONSTRAINT telegram_login_phone_chk CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$');
CREATE INDEX IF NOT EXISTS telegram_login_started_idx ON public.telegram_login_requests (started_by_tg, started_at DESC) WHERE status = 'pending';

-- /start bosildi: kim bosganini eslab qoladi. BOSHQA odam bosgan bo'lsa — oldingi odamning ulashgan raqami bekor qilinadi.
CREATE OR REPLACE FUNCTION public.tg_login_start_seen(p_login_id uuid, p_tg_user_id bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n int;
BEGIN
  UPDATE public.telegram_login_requests
     SET started_by_tg = p_tg_user_id, started_at = now(),
         phone = CASE WHEN phone_tg_user_id IS NOT DISTINCT FROM p_tg_user_id THEN phone ELSE NULL END,
         phone_at = CASE WHEN phone_tg_user_id IS NOT DISTINCT FROM p_tg_user_id THEN phone_at ELSE NULL END,
         phone_tg_user_id = CASE WHEN phone_tg_user_id IS NOT DISTINCT FROM p_tg_user_id THEN phone_tg_user_id ELSE NULL END
   WHERE id = p_login_id AND status = 'pending' AND expires_at > now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

-- Kontakt kelganda: shu Telegram foydalanuvchisi so'nggi bosgan ochiq so'rov
CREATE OR REPLACE FUNCTION public.tg_login_find_open(p_tg_user_id bigint) RETURNS TABLE (id uuid, mode text, link_user_id uuid, platform text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT r.id, r.mode, r.link_user_id, r.platform FROM public.telegram_login_requests r
   WHERE r.started_by_tg = p_tg_user_id AND r.status = 'pending' AND r.expires_at > now()
   ORDER BY r.started_at DESC LIMIT 1;
$$;

-- Raqamni so'rovga yozish (faqat /start bosgan odam uchun, faqat ochiq so'rovga)
CREATE OR REPLACE FUNCTION public.tg_login_set_phone(p_login_id uuid, p_tg_user_id bigint, p_phone text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n int;
BEGIN
  UPDATE public.telegram_login_requests SET phone = p_phone, phone_tg_user_id = p_tg_user_id, phone_at = now()
   WHERE id = p_login_id AND status = 'pending' AND expires_at > now() AND started_by_tg = p_tg_user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

-- ---------------------------------------------------------------------------
-- 3) tg_identify — tasdiqdan keyin akkauntni aniqlash (BITTA tranzaksiya, parallel chaqiruvlarga chidamli)
--   Natija (jsonb: outcome, user_id, is_new, phone_event, conflict):
--     existing                    — Telegram allaqachon bog'langan akkaunt (raqam bo'lmasa yoziladi; boshqacha bo'lsa yangilanadi, eskisi tarixga)
--     phone_account               — Telegram bog'langan akkaunt yo'q, lekin shu tasdiqlangan raqamli akkaunt bor → Telegram o'sha akkauntga ulandi
--     new                         — yangi akkaunt (p_new_user_id) raqam bilan ulandi
--     needs_new                   — hech biri yo'q: chaqiruvchi auth foydalanuvchisini yaratib, p_new_user_id bilan qayta chaqirishi kerak
--     phone_required              — raqam kerak (yangi akkaunt yoki raqamsiz akkaunt), lekin berilmagan
--     phone_taken_other_telegram  — raqam egasi akkauntga BOSHQA Telegram ulangan: hech narsa o'zgarmadi (admin uchun yozildi)
--   phone_event: none | set | updated | unchanged | conflict.  conflict=true: Telegram akkaunti B ga, raqam boshqa A akkauntga tegishli
--   → B ga kiriladi, raqam O'ZGARTIRILMAYDI, hodisa phone_conflicts'ga yoziladi.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_identify(
  p_telegram_user_id bigint, p_phone text, p_username text DEFAULT NULL, p_first_name text DEFAULT NULL, p_last_name text DEFAULT NULL, p_new_user_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_a uuid; v_p uuid; v_a_phone text; v_p_tg bigint; v_event text := 'none'; v_conflict boolean := false;
BEGIN
  IF p_phone IS NOT NULL AND p_phone !~ '^\+[1-9][0-9]{6,14}$' THEN RAISE EXCEPTION 'BAD_PHONE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('tg-link:tg:' || p_telegram_user_id::text, 0));     -- tg_link_apply bilan bir xil kalit
  IF p_phone IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('tg-phone:' || p_phone, 0)); END IF;

  SELECT t.user_id INTO v_a FROM public.telegram_accounts t WHERE t.telegram_user_id = p_telegram_user_id;
  IF p_phone IS NOT NULL THEN SELECT pr.id INTO v_p FROM public.profiles pr WHERE pr.phone = p_phone; END IF;

  -- (1) Telegram allaqachon bog'langan
  IF v_a IS NOT NULL THEN
    UPDATE public.telegram_accounts SET username = p_username, first_name = p_first_name, last_name = p_last_name, updated_at = now() WHERE telegram_user_id = p_telegram_user_id;
    SELECT pr.phone INTO v_a_phone FROM public.profiles pr WHERE pr.id = v_a;
    IF p_phone IS NULL THEN
      IF v_a_phone IS NULL THEN RETURN jsonb_build_object('outcome', 'phone_required', 'user_id', v_a, 'is_new', false, 'phone_event', 'none', 'conflict', false); END IF;
    ELSIF v_p IS NULL THEN
      UPDATE public.profiles SET phone = p_phone, phone_verified_at = now(), phone_source = 'telegram' WHERE id = v_a;
      v_event := CASE WHEN v_a_phone IS NULL THEN 'set' ELSE 'updated' END;
    ELSIF v_p = v_a THEN
      v_event := 'unchanged';
    ELSE
      INSERT INTO public.phone_conflicts (telegram_user_id, user_id, phone, phone_owner_id, kind) VALUES (p_telegram_user_id, v_a, p_phone, v_p, 'telegram_account_vs_phone_owner')
        ON CONFLICT (telegram_user_id, phone, kind) WHERE resolved_at IS NULL DO UPDATE SET seen_count = public.phone_conflicts.seen_count + 1, last_seen_at = now(), user_id = EXCLUDED.user_id, phone_owner_id = EXCLUDED.phone_owner_id;
      v_event := 'conflict'; v_conflict := true;
    END IF;
    RETURN jsonb_build_object('outcome', 'existing', 'user_id', v_a, 'is_new', false, 'phone_event', v_event, 'conflict', v_conflict);
  END IF;

  -- Bundan keyin Telegram bog'lanmagan: raqamsiz hech narsa qilib bo'lmaydi
  IF p_phone IS NULL THEN RETURN jsonb_build_object('outcome', 'phone_required', 'user_id', NULL, 'is_new', false, 'phone_event', 'none', 'conflict', false); END IF;

  -- (2) shu tasdiqlangan raqamli akkaunt bor → Telegram o'sha akkauntga ulanadi (dublikat ochilmaydi)
  IF v_p IS NOT NULL THEN
    SELECT t.telegram_user_id INTO v_p_tg FROM public.telegram_accounts t WHERE t.user_id = v_p;
    IF v_p_tg IS NOT NULL THEN
      INSERT INTO public.phone_conflicts (telegram_user_id, user_id, phone, phone_owner_id, kind) VALUES (p_telegram_user_id, v_p, p_phone, v_p, 'phone_owner_has_other_telegram')
        ON CONFLICT (telegram_user_id, phone, kind) WHERE resolved_at IS NULL DO UPDATE SET seen_count = public.phone_conflicts.seen_count + 1, last_seen_at = now();
      RETURN jsonb_build_object('outcome', 'phone_taken_other_telegram', 'user_id', v_p, 'is_new', false, 'phone_event', 'conflict', 'conflict', true);
    END IF;
    INSERT INTO public.telegram_accounts (telegram_user_id, user_id, username, first_name, last_name) VALUES (p_telegram_user_id, v_p, p_username, p_first_name, p_last_name);
    RETURN jsonb_build_object('outcome', 'phone_account', 'user_id', v_p, 'is_new', false, 'phone_event', 'unchanged', 'conflict', false);
  END IF;

  -- (3) hech biri yo'q → yangi akkaunt
  IF p_new_user_id IS NULL THEN RETURN jsonb_build_object('outcome', 'needs_new', 'user_id', NULL, 'is_new', false, 'phone_event', 'none', 'conflict', false); END IF;
  PERFORM 1 FROM public.profiles WHERE id = p_new_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NEW_USER_MISSING'; END IF;
  IF EXISTS (SELECT 1 FROM public.telegram_accounts WHERE user_id = p_new_user_id) THEN RAISE EXCEPTION 'NEW_USER_NOT_FRESH'; END IF;
  UPDATE public.profiles SET phone = p_phone, phone_verified_at = now(), phone_source = 'telegram' WHERE id = p_new_user_id AND phone IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'NEW_USER_NOT_FRESH'; END IF;
  INSERT INTO public.telegram_accounts (telegram_user_id, user_id, username, first_name, last_name) VALUES (p_telegram_user_id, p_new_user_id, p_username, p_first_name, p_last_name);
  RETURN jsonb_build_object('outcome', 'new', 'user_id', p_new_user_id, 'is_new', true, 'phone_event', 'set', 'conflict', false);
END $$;

-- ---------------------------------------------------------------------------
-- 4) "Bo'sh akkaunt" qoidasi: phone_history / phone_conflicts ma'lumot hisoblanmaydi
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_account_blockers(p_user uuid) RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE p public.profiles; res text[] := '{}'; r record; ex boolean;
  ignored text[] := ARRAY['telegram_accounts', 'telegram_login_requests', 'device_tokens', 'notifications', 'announcement_reads', 'announcement_views', 'phone_history', 'phone_conflicts'];
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
-- 5) Ulash (link): raqam ham olinadi va akkauntga yoziladi (v34 funksiyasi; imzosi o'zgarmagan, raqam so'rov qatoridan o'qiladi)
--   Yangi natijalar: phone_required (akkauntda raqam yo'q va botda ulashilmagan — hech narsa o'zgarmadi),
--                    conflict_phone_taken (raqam boshqa akkauntga tegishli — hech narsa o'zgarmadi, result_code = PHONE_TAKEN)
--   Qoida: raqam FAQAT akkauntda tasdiqlangan raqam bo'lmasa yoziladi; bor bo'lsa (boshqacha bo'lsa ham) tegilmaydi.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_link_apply(p_login_id uuid, p_telegram_user_id bigint, p_username text DEFAULT NULL, p_first_name text DEFAULT NULL, p_last_name text DEFAULT NULL)
RETURNS TABLE (outcome text, reasons text[], deleted_user uuid, deleted_avatar text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.telegram_login_requests; v_user uuid; v_cur bigint; v_other uuid; v_reasons text[]; v_avatar text;
        v_phone text; v_user_phone text; v_p2 uuid; v_need_phone boolean;
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

  -- raqam: faqat TUGMANI BOSGAN odam o'zi ulashgan bo'lsa hisobga olinadi
  v_phone := CASE WHEN r.phone_tg_user_id = p_telegram_user_id THEN r.phone ELSE NULL END;
  SELECT pr.phone INTO v_user_phone FROM public.profiles pr WHERE pr.id = v_user;
  v_need_phone := v_user_phone IS NULL;
  IF v_need_phone AND v_phone IS NULL THEN
    RETURN QUERY SELECT 'phone_required'::text, NULL::text[], NULL::uuid, NULL::text; RETURN;
  END IF;
  IF v_need_phone THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('tg-phone:' || v_phone, 0));
    SELECT pr.id INTO v_p2 FROM public.profiles pr WHERE pr.phone = v_phone;
  END IF;

  -- 1) joriy akkauntga allaqachon Telegram ulanganmi
  SELECT t.telegram_user_id INTO v_cur FROM public.telegram_accounts t WHERE t.user_id = v_user;
  IF v_cur IS NOT NULL THEN
    IF v_cur = p_telegram_user_id THEN
      IF v_need_phone AND v_p2 IS NOT NULL THEN
        UPDATE public.telegram_login_requests SET status = 'conflict', result_code = 'PHONE_TAKEN', telegram_user_id = p_telegram_user_id, confirmed_at = now() WHERE id = p_login_id;
        RETURN QUERY SELECT 'conflict_phone_taken'::text, NULL::text[], NULL::uuid, NULL::text; RETURN;
      END IF;
      IF v_need_phone THEN UPDATE public.profiles SET phone = v_phone, phone_verified_at = now(), phone_source = 'telegram' WHERE id = v_user AND phone IS NULL; END IF;
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
    -- raqam BOSHQA akkauntniki bo'lsa (o'chiriladigan dublikat emas) — hech narsa o'zgartirilmaydi
    IF v_need_phone AND v_p2 IS NOT NULL AND v_p2 IS DISTINCT FROM v_other THEN
      UPDATE public.telegram_login_requests SET status = 'conflict', result_code = 'PHONE_TAKEN', telegram_user_id = p_telegram_user_id, confirmed_at = now() WHERE id = p_login_id;
      RETURN QUERY SELECT 'conflict_phone_taken'::text, NULL::text[], NULL::uuid, NULL::text; RETURN;
    END IF;
    SELECT pr.avatar_url INTO v_avatar FROM public.profiles pr WHERE pr.id = v_other;
    BEGIN
      DELETE FROM auth.users WHERE id = v_other;     -- profiles va bog'liq qatorlar cascade bilan o'chadi (raqam ham bo'shaydi)
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.telegram_login_requests SET status = 'conflict', result_code = 'TELEGRAM_TAKEN', telegram_user_id = p_telegram_user_id, confirmed_at = now() WHERE id = p_login_id;
      RETURN QUERY SELECT 'conflict_taken'::text, ARRAY['delete_failed']::text[], NULL::uuid, NULL::text; RETURN;
    END;
  ELSIF v_need_phone AND v_p2 IS NOT NULL THEN
    -- 3) Telegram bo'sh, lekin raqam boshqa akkauntga tegishli
    UPDATE public.telegram_login_requests SET status = 'conflict', result_code = 'PHONE_TAKEN', telegram_user_id = p_telegram_user_id, confirmed_at = now() WHERE id = p_login_id;
    RETURN QUERY SELECT 'conflict_phone_taken'::text, NULL::text[], NULL::uuid, NULL::text; RETURN;
  END IF;

  -- ulash + raqam
  BEGIN
    INSERT INTO public.telegram_accounts (telegram_user_id, user_id, username, first_name, last_name) VALUES (p_telegram_user_id, v_user, p_username, p_first_name, p_last_name);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'TG_LINK_RACE';
  END;
  IF v_need_phone THEN
    BEGIN
      UPDATE public.profiles SET phone = v_phone, phone_verified_at = now(), phone_source = 'telegram' WHERE id = v_user AND phone IS NULL;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'TG_LINK_RACE';
    END;
  END IF;
  UPDATE public.telegram_login_requests SET status = 'linked', telegram_user_id = p_telegram_user_id, user_id = v_user, confirmed_at = now(), replaced_account = (v_other IS NOT NULL) WHERE id = p_login_id;
  RETURN QUERY SELECT CASE WHEN v_other IS NULL THEN 'linked' ELSE 'linked_replaced' END::text, NULL::text[], v_other, v_avatar;
END $$;

-- ---------------------------------------------------------------------------
-- Huquqlar: hamma funksiya faqat service_role uchun
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.tg_identify(bigint, text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_login_start_seen(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_login_find_open(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_login_set_phone(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_user_phone(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_link_apply(uuid, bigint, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_account_blockers(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_phone_history() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_identify(bigint, text, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_login_start_seen(uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_login_find_open(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_login_set_phone(uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_user_phone(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_link_apply(uuid, bigint, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_account_blockers(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v35: telefon identifikator' AS tekshiruv,
       CASE WHEN to_regprocedure('public.tg_identify(bigint,text,text,text,text,uuid)') IS NOT NULL
             AND to_regprocedure('public.tg_login_start_seen(uuid,bigint)') IS NOT NULL
             AND to_regprocedure('public.tg_login_find_open(bigint)') IS NOT NULL
             AND to_regprocedure('public.tg_login_set_phone(uuid,bigint,text)') IS NOT NULL
             AND to_regprocedure('public.clear_user_phone(uuid)') IS NOT NULL
             AND to_regclass('public.phone_history') IS NOT NULL AND to_regclass('public.phone_conflicts') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_verified_at')
             AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'profiles_phone_uniq')
        THEN 'OK' ELSE 'XATO' END AS natija;
