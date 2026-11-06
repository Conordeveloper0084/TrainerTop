-- ============================================================================
-- TRAINERTOP — migration v26: Trenerning pul yechish kartasini (ixtiyoriy) shifrlab saqlash
--   * Karta raqami ILOVA DARAJASIDA (Node.js, AES-256-GCM, PAYOUT_CARD_KEY) shifrlanadi —
--     RAW (ochiq) karta raqami hech qachon bazaga YOZILMAYDI, faqat shifrlangan matn + oxirgi
--     4 raqam (card_last4, maskalash uchun) saqlanadi. Shuning uchun bu migratsiya o'zi
--     pgcrypto/kalit bilan ishlamaydi — shifrlash butunlay kod tomonida.
--   * trainer_payout_cards: RLS yoqilgan, faqat service_role (anon/authenticated yopiq).
--   * payouts: eski ochiq card_number ustuni QOLADI (tarixiy yozuvlar uchun, orqaga qarab
--     moslik), lekin YANGI so'rovlar endi card_number_encrypted + card_last4'ga yoziladi —
--     shuning uchun card_number endi NOT NULL emas.
--   * request_payout() RPC'i endi xom karta raqamini UMUMAN qabul qilmaydi (p_card o'rniga
--     p_card_encrypted + p_card_last4) — Luhn/egasi tekshiruvi TO'LIQ ilova (API) darajasida
--     bajariladi, xom raqam bazaga HECH QACHON yetib bormaydi (hatto vaqtinchalik ham).
--   * resolve_payout() o'zgarmaydi (karta maydonlariga tegmaydi).
-- Bog'liqlik: v12 (finance-admin — trainer_profiles.balance, payouts, request_payout).
-- Qayta ishga tushirsa xavfsiz.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trainer_payout_cards (
  trainer_id            uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_number_encrypted text NOT NULL,
  card_last4            text NOT NULL CHECK (card_last4 ~ '^\d{4}$'),
  card_holder           text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trainer_payout_cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trainer_payout_cards FROM anon, authenticated;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS card_number_encrypted text,
  ADD COLUMN IF NOT EXISTS card_last4 text;
ALTER TABLE public.payouts ALTER COLUMN card_number DROP NOT NULL;

-- Eski funksiyani (boshqa parametr imzosi bilan) olib tashlaymiz, keyin yangisini yaratamiz —
-- Postgres funksiya imzosi (parametr turlari) o'zgarganda CREATE OR REPLACE yetarli emas.
DROP FUNCTION IF EXISTS public.request_payout(uuid, integer, text, text);

CREATE OR REPLACE FUNCTION public.request_payout(p_trainer uuid, p_amount integer, p_card_encrypted text, p_card_last4 text, p_card_holder text)
RETURNS public.payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE tp public.trainer_profiles; v_holder text; v_min int; v_payout public.payouts; v_new_bal int;
BEGIN
  -- Xom karta raqami bu funksiyaga umuman uzatilmaydi (ilova darajasida shifrlanadi) — shuning
  -- uchun bu yerda faqat STRUKTURA tekshiriladi (Luhn/formatni ilova allaqachon tekshirgan).
  IF p_card_encrypted IS NULL OR btrim(p_card_encrypted) = '' THEN RAISE EXCEPTION 'BAD_CARD'; END IF;
  IF p_card_last4 !~ '^\d{4}$' THEN RAISE EXCEPTION 'BAD_CARD'; END IF;
  v_holder := btrim(regexp_replace(coalesce(p_card_holder, ''), '\s+', ' ', 'g'));
  IF v_holder !~ '^[A-Za-z''`ʻʼ’‘. -]{3,60}$' OR v_holder !~ '[A-Za-z].*[A-Za-z]' THEN RAISE EXCEPTION 'BAD_HOLDER'; END IF;

  SELECT * INTO tp FROM public.trainer_profiles WHERE user_id = p_trainer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_TRAINER'; END IF;
  IF public.is_user_banned(p_trainer) THEN RAISE EXCEPTION 'BANNED'; END IF;

  v_min := public.get_setting('min_payout_amount', 100000)::int;
  IF p_amount IS NULL OR p_amount < v_min THEN RAISE EXCEPTION 'BELOW_MIN:%', v_min; END IF;
  IF EXISTS (SELECT 1 FROM public.payouts WHERE trainer_id = p_trainer AND status = 'pending') THEN
    RAISE EXCEPTION 'PAYOUT_PENDING';
  END IF;
  IF coalesce(tp.balance, 0) < p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;

  INSERT INTO public.payouts (trainer_id, amount, card_number_encrypted, card_last4, card_holder, status)
  VALUES (p_trainer, p_amount, p_card_encrypted, p_card_last4, upper(v_holder), 'pending') RETURNING * INTO v_payout;

  UPDATE public.trainer_profiles SET balance = balance - p_amount WHERE user_id = p_trainer RETURNING balance INTO v_new_bal;

  INSERT INTO public.trainer_ledger (trainer_id, kind, delta, balance_after, payout_id, note)
  VALUES (p_trainer, 'payout_hold', -p_amount, v_new_bal, v_payout.id, 'Pul yechish so''rovi');

  RETURN v_payout;
END $$;

REVOKE ALL ON FUNCTION public.request_payout(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_payout(uuid, integer, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v26: trainer_payout_cards + encrypted payouts' AS tekshiruv,
       CASE WHEN to_regclass('public.trainer_payout_cards') IS NOT NULL
             AND to_regprocedure('public.request_payout(uuid,integer,text,text,text)') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payouts' AND column_name='card_last4')
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payouts' AND column_name='card_number' AND is_nullable='YES')
        THEN 'OK' ELSE 'XATO' END AS natija;
