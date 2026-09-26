-- ============================================================
-- Migration v19: Username tizimi (@handle)
-- Instagram/Telegram uslubida: ixtiyoriy, noyob, qidiruvda ishlaydi.
-- Mustaqil migratsiya — boshqa v13/v15/v16/v17/v18 bilan bog'liq emas,
-- faqat asosiy sxema (profiles jadvali) kerak. Qayta ishga tushirsa xavfsiz.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1. Ustun, format va noyoblik (katta-kichik harfga sezmaydigan)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format_chk
  CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_]{3,20}$');

DROP INDEX IF EXISTS profiles_username_lower_idx;
CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. set_username(p_user, p_username) — YAGONA yozish yo'li (API shu orqali
--    yozadi; profillar to'g'ridan-to'g'ri klient yozuvida ishlamaydi — bu loyihada
--    hamma o'zgarish shunday, "protect_profiles" kabi boshqa trigger'lar buni
--    o'zgartirmaydi). NULL = username o'chiriladi (ixtiyoriy bo'lgani uchun).
--    Taqiqlangan (brend/rol) nomlar shu yerda bloklanadi. Format va noyoblik esa
--    CHECK/UNIQUE INDEX orqali BARCHA yo'llar uchun (RPC bo'lsa ham) kafolatlangan —
--    shu ikkalasi hech qanday boshqa migratsiyaga bog'liq emas.
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
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE lower(username) = lower(p_username) AND id <> p_user) INTO v_taken;
  IF v_taken THEN RAISE EXCEPTION 'TAKEN'; END IF;
  UPDATE public.profiles SET username = p_username WHERE id = p_user;
  RETURN jsonb_build_object('success', true, 'username', p_username);
END $$;

REVOKE ALL ON FUNCTION public.set_username(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_username(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV (ishga tushirgach natijani ko'ring)
-- ---------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='username') AS username_col,     -- kutilgan: 1
  (SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname='profiles_username_lower_idx') AS uniq_idx,                                    -- kutilgan: 1
  (SELECT count(*) FROM pg_proc WHERE proname='set_username') AS fn_count;                                                                                 -- kutilgan: 1
