-- ============================================================================
-- TRAINERTOP — migration v33: "Telegram orqali kirish" (bot orqali; sayt, Android va iOS uchun umumiy)
--
-- Oqim: mijoz start → login_id + poll_secret oladi; foydalanuvchi botda TASDIQLAydi; mijoz status'ni so'rab,
-- tasdiqlangach BIR MARTA Supabase sessiyasini oladi. Sessiya tokenlari bazaga HECH QACHON yozilmaydi: tasdiqlashda
-- faqat "kim kirdi" saqlanadi, tokenlar esa mijoz sirni (poll_secret) ko'rsatib so'raganda yaratiladi.
-- poll_secret bazada faqat SHA-256 hash holida.
--
-- Hamma jadval/funksiya FAQAT server (service_role) uchun: anon/authenticated hech narsa o'qiy/yoza/chaqira olmaydi.
-- Bog'liqlik: profiles (schema.sql). Qayta ishga tushirsa xavfsiz.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Telegram akkauntlari (bir Telegram — bir akkaunt, bir akkaunt — bir Telegram)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegram_accounts (
  telegram_user_id bigint      PRIMARY KEY,
  user_id          uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  username         text,
  first_name       text,
  last_name        text,
  phone            text,
  linked_at        timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_accounts_phone_chk CHECK (phone IS NULL OR phone ~ '^\+[0-9]{7,15}$')
);

-- ---------------------------------------------------------------------------
-- 2) Kirish so'rovlari (qisqa muddatli, bir martalik)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegram_login_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),   -- login_id (havolada bor — sir EMAS)
  secret_hash      text        NOT NULL,                                -- SHA-256(poll_secret); poll_secret havolada YO'Q
  platform         text        NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'consumed', 'cancelled')),
  telegram_user_id bigint,
  user_id          uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_new_user      boolean     NOT NULL DEFAULT false,
  ip_key           text        NOT NULL,                                -- IP'ning hash'i (tezlik limiti uchun; xom IP saqlanmaydi)
  device_key       text,                                                -- qurilma id'sining hash'i (ixtiyoriy)
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  confirmed_at     timestamptz,
  consumed_at      timestamptz,
  CONSTRAINT telegram_login_confirmed_chk CHECK (status NOT IN ('confirmed', 'consumed') OR (user_id IS NOT NULL AND telegram_user_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS telegram_login_ip_idx      ON public.telegram_login_requests (ip_key, created_at);
CREATE INDEX IF NOT EXISTS telegram_login_device_idx  ON public.telegram_login_requests (device_key, created_at) WHERE device_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS telegram_login_expires_idx ON public.telegram_login_requests (expires_at);

ALTER TABLE public.telegram_accounts       ENABLE ROW LEVEL SECURITY;   -- siyosat YO'Q: faqat service_role
ALTER TABLE public.telegram_login_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_accounts, public.telegram_login_requests FROM anon, authenticated;
GRANT ALL ON public.telegram_accounts, public.telegram_login_requests TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Atomik amallar
-- ---------------------------------------------------------------------------

-- Yangi so'rov. Tezlik limiti: bir IP — 10 ta / 10 daqiqa, bir qurilma — 5 ta / 10 daqiqa (jadvalning o'zi hisoblagich).
-- Eskirgan (1 soatdan oshgan) so'rovlar shu yerda tozalanadi. Limitdan oshsa: RAISE 'RATE_LIMITED'.
CREATE OR REPLACE FUNCTION public.tg_login_start(
  p_secret_hash text, p_platform text, p_ip_key text, p_device_key text DEFAULT NULL,
  p_ttl_seconds int DEFAULT 300, p_ip_limit int DEFAULT 10, p_device_limit int DEFAULT 5, p_window_seconds int DEFAULT 600
) RETURNS public.telegram_login_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.telegram_login_requests;
BEGIN
  DELETE FROM public.telegram_login_requests WHERE expires_at < now() - interval '1 hour';
  IF (SELECT count(*) FROM public.telegram_login_requests WHERE ip_key = p_ip_key AND created_at > now() - make_interval(secs => p_window_seconds)) >= p_ip_limit THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;
  IF p_device_key IS NOT NULL AND (SELECT count(*) FROM public.telegram_login_requests WHERE device_key = p_device_key AND created_at > now() - make_interval(secs => p_window_seconds)) >= p_device_limit THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;
  INSERT INTO public.telegram_login_requests (secret_hash, platform, ip_key, device_key, expires_at)
  VALUES (p_secret_hash, p_platform, p_ip_key, p_device_key, now() + make_interval(secs => p_ttl_seconds))
  RETURNING * INTO r;
  RETURN r;
END $$;

-- Botda "Tasdiqlash" bosildi. FAQAT kutilayotgan va muddati o'tmagan so'rov tasdiqlanadi (aks holda 0 qator).
-- Tasdiqlangach sessiyani olish uchun kamida 60 soniya beriladi (tasdiq 4:59 da bo'lsa mijoz ulgura olsin).
CREATE OR REPLACE FUNCTION public.tg_login_confirm(p_login_id uuid, p_telegram_user_id bigint, p_user_id uuid, p_is_new boolean)
RETURNS SETOF public.telegram_login_requests LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.telegram_login_requests
     SET status = 'confirmed', telegram_user_id = p_telegram_user_id, user_id = p_user_id, is_new_user = p_is_new,
         confirmed_at = now(), expires_at = greatest(expires_at, now() + interval '60 seconds')
   WHERE id = p_login_id AND status = 'pending' AND expires_at > now()
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.tg_login_cancel(p_login_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n int;
BEGIN
  UPDATE public.telegram_login_requests SET status = 'cancelled' WHERE id = p_login_id AND status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

-- Mijoz status so'radi. Natija (outcome): not_found (yo'q YOKI sir noto'g'ri — farqlanmaydi), pending, expired,
-- cancelled, consumed (allaqachon olingan), claimed (SHU CHAQIRUV sessiya olish huquqini qo'lga kiritdi).
-- FOR UPDATE: parallel so'rovlardan aynan BITTASI "claimed" oladi.
CREATE OR REPLACE FUNCTION public.tg_login_consume(p_login_id uuid, p_secret_hash text)
RETURNS TABLE (outcome text, user_id uuid, telegram_user_id bigint, is_new_user boolean, platform text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r public.telegram_login_requests;
BEGIN
  SELECT * INTO r FROM public.telegram_login_requests WHERE id = p_login_id FOR UPDATE;
  IF NOT FOUND OR r.secret_hash IS DISTINCT FROM p_secret_hash THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::bigint, NULL::boolean, NULL::text; RETURN;
  END IF;
  IF r.status = 'cancelled' THEN RETURN QUERY SELECT 'cancelled'::text, NULL::uuid, NULL::bigint, NULL::boolean, r.platform; RETURN; END IF;
  IF r.status = 'consumed'  THEN RETURN QUERY SELECT 'consumed'::text,  NULL::uuid, NULL::bigint, NULL::boolean, r.platform; RETURN; END IF;
  IF r.expires_at <= now()  THEN RETURN QUERY SELECT 'expired'::text,   NULL::uuid, NULL::bigint, NULL::boolean, r.platform; RETURN; END IF;
  IF r.status = 'pending'   THEN RETURN QUERY SELECT 'pending'::text,   NULL::uuid, NULL::bigint, NULL::boolean, r.platform; RETURN; END IF;
  UPDATE public.telegram_login_requests SET status = 'consumed', consumed_at = now() WHERE id = p_login_id;
  RETURN QUERY SELECT 'claimed'::text, r.user_id, r.telegram_user_id, r.is_new_user, r.platform;
END $$;

-- Sessiya yaratib bo'lmasa (masalan Supabase vaqtincha ishlamadi) — so'rovni qayta olish mumkin holatga qaytaradi
-- (faqat 60 soniya ichida "consumed" bo'lgan va muddati o'tmagan so'rov). Tokenlar berilmagan holatda chaqiriladi.
CREATE OR REPLACE FUNCTION public.tg_login_release(p_login_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n int;
BEGIN
  UPDATE public.telegram_login_requests SET status = 'confirmed', consumed_at = NULL
   WHERE id = p_login_id AND status = 'consumed' AND consumed_at > now() - interval '60 seconds' AND expires_at > now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

REVOKE ALL ON FUNCTION public.tg_login_start(text, text, text, text, int, int, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_login_confirm(uuid, bigint, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_login_cancel(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_login_consume(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_login_release(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_login_start(text, text, text, text, int, int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_login_confirm(uuid, bigint, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_login_cancel(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_login_consume(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_login_release(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v33: telegram login' AS tekshiruv,
       CASE WHEN to_regclass('public.telegram_accounts') IS NOT NULL
             AND to_regclass('public.telegram_login_requests') IS NOT NULL
             AND to_regprocedure('public.tg_login_start(text,text,text,text,integer,integer,integer,integer)') IS NOT NULL
             AND to_regprocedure('public.tg_login_confirm(uuid,bigint,uuid,boolean)') IS NOT NULL
             AND to_regprocedure('public.tg_login_cancel(uuid)') IS NOT NULL
             AND to_regprocedure('public.tg_login_consume(uuid,text)') IS NOT NULL
             AND to_regprocedure('public.tg_login_release(uuid)') IS NOT NULL
        THEN 'OK' ELSE 'XATO' END AS natija;
