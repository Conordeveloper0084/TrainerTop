-- ============================================================================
-- TRAINERTOP — migration v21: Bosh sahifa "Top trenerlar" (admin tanlaydi)
--   * Admin trainer_profiles'da bir nechta trenerni "is_featured_home" qilib
--     belgilaydi, tartib (featured_order) va ixtiyoriy qisqa matn (featured_blurb)
--     bilan. Bosh sahifa shu ro'yxatni ko'rsatadi; hech kim tanlanmagan bo'lsa
--     frontend o'zi namunaviy (mock, bazasiz) kartochkalarni ko'rsatadi.
--   * Mustaqil migratsiya — faqat asosiy sxema (trainer_profiles) kerak,
--     v18/v19/v20 bilan bog'liq emas.
-- Qayta ishga tushirsa xavfsiz.
-- ============================================================================

ALTER TABLE public.trainer_profiles ADD COLUMN IF NOT EXISTS is_featured_home boolean NOT NULL DEFAULT false;
ALTER TABLE public.trainer_profiles ADD COLUMN IF NOT EXISTS featured_order integer;
ALTER TABLE public.trainer_profiles ADD COLUMN IF NOT EXISTS featured_blurb text;

ALTER TABLE public.trainer_profiles DROP CONSTRAINT IF EXISTS trainer_profiles_featured_blurb_check;
ALTER TABLE public.trainer_profiles ADD CONSTRAINT trainer_profiles_featured_blurb_check CHECK (featured_blurb IS NULL OR char_length(featured_blurb) <= 120);

-- Faqat is_featured_home=true bo'lganlar orasida tartib bo'yicha qidirish tez bo'lishi uchun
DROP INDEX IF EXISTS trainer_profiles_featured_idx;
CREATE INDEX trainer_profiles_featured_idx ON public.trainer_profiles (featured_order) WHERE is_featured_home;

-- ---------------------------------------------------------------------------
-- set_featured_trainer(p_admin, p_trainer, p_action, p_blurb)
--   p_action: 'add' | 'remove' | 'blurb' (faqat matnni yangilaydi, holatni o'zgartirmaydi)
--   'add': is_featured_home=true, featured_order = (joriy eng kattasi + 1) — oxiriga qo'shiladi.
--          Allaqachon featured bo'lsa faqat blurb yangilanadi (tartib o'zgarmaydi).
--   Xatolar: FORBIDDEN, TRAINER_NOT_FOUND, BAD_ACTION, BAD_BLURB
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_featured_trainer(p_admin uuid, p_trainer uuid, p_action text, p_blurb text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_blurb text := nullif(btrim(coalesce(p_blurb, '')), ''); v_next_order integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin AND role = 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trainer_profiles WHERE user_id = p_trainer) THEN RAISE EXCEPTION 'TRAINER_NOT_FOUND'; END IF;
  IF v_blurb IS NOT NULL AND char_length(v_blurb) > 120 THEN RAISE EXCEPTION 'BAD_BLURB'; END IF;

  IF p_action = 'add' THEN
    SELECT coalesce(max(featured_order), 0) + 1 INTO v_next_order FROM public.trainer_profiles WHERE is_featured_home;
    UPDATE public.trainer_profiles SET is_featured_home = true, featured_blurb = v_blurb,
      featured_order = CASE WHEN is_featured_home THEN featured_order ELSE v_next_order END
      WHERE user_id = p_trainer;
  ELSIF p_action = 'remove' THEN
    UPDATE public.trainer_profiles SET is_featured_home = false, featured_order = NULL WHERE user_id = p_trainer;
  ELSIF p_action = 'blurb' THEN
    UPDATE public.trainer_profiles SET featured_blurb = v_blurb WHERE user_id = p_trainer;
  ELSE
    RAISE EXCEPTION 'BAD_ACTION';
  END IF;
  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.set_featured_trainer(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_featured_trainer(uuid, uuid, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- reorder_featured_trainers(p_admin, p_trainer_a, p_trainer_b)
--   Ikkita FEATURED trenerning tartib raqamini almashtiradi ("yuqoriga/pastga"
--   tugmalari shu orqali ishlaydi — qo'shni ikkitasini joyini almashtiradi).
--   Xatolar: FORBIDDEN, NOT_FEATURED
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reorder_featured_trainers(p_admin uuid, p_trainer_a uuid, p_trainer_b uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order_a integer; v_order_b integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin AND role = 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT featured_order INTO v_order_a FROM public.trainer_profiles WHERE user_id = p_trainer_a AND is_featured_home;
  SELECT featured_order INTO v_order_b FROM public.trainer_profiles WHERE user_id = p_trainer_b AND is_featured_home;
  IF v_order_a IS NULL OR v_order_b IS NULL THEN RAISE EXCEPTION 'NOT_FEATURED'; END IF;
  UPDATE public.trainer_profiles SET featured_order = v_order_b WHERE user_id = p_trainer_a;
  UPDATE public.trainer_profiles SET featured_order = v_order_a WHERE user_id = p_trainer_b;
  RETURN jsonb_build_object('success', true);
END $$;

REVOKE ALL ON FUNCTION public.reorder_featured_trainers(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_featured_trainers(uuid, uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'featured trainer ustunlari va funksiyalar' AS tekshiruv,
       CASE WHEN (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='trainer_profiles' AND column_name IN ('is_featured_home','featured_order','featured_blurb')) = 3
             AND to_regprocedure('public.set_featured_trainer(uuid,uuid,text,text)') IS NOT NULL
             AND to_regprocedure('public.reorder_featured_trainers(uuid,uuid,uuid)') IS NOT NULL
        THEN 'OK' ELSE 'XATO' END AS natija;
