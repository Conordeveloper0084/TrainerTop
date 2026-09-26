-- =====================================================================
-- TRAINERTOP MIGRATION v12
-- Moliya (hisob daftari), pul yechish, komissiya, nishon, ban,
-- darslik moderatsiyasi va ma'lumotlar bazasi himoyasi
-- =====================================================================
-- KODNI PUSH QILISHDAN OLDIN Supabase SQL Editor'da BIR MARTA ishga tushiring.
-- Idempotent: qayta ishga tushirsa ham xavfsiz.
-- Oxirida "TEKSHIRUV" natijalari chiqadi (pastga qarang).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SOZLAMALAR va ADMIN JURNALI
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        TEXT PRIMARY KEY,
  value      NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;  -- policy yo'q: faqat server (service_role)

INSERT INTO public.platform_settings (key, value) VALUES
  ('default_commission_percent', 10),
  ('min_payout_amount',          100000),
  ('badge_min_followers',        1000),
  ('badge_min_rating',           4.5),
  ('badge_min_reviews',          10)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_setting(p_key text, p_default numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce((SELECT value FROM public.platform_settings WHERE key = p_key), p_default)
$$;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    UUID,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_log (created_at DESC);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.log_admin_action(p_admin uuid, p_action text, p_type text, p_target text, p_details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (p_admin, p_action, p_type, p_target, coalesce(p_details, '{}'::jsonb))
$$;

-- ---------------------------------------------------------------------
-- 2. TRENER PROFILI: yangi ustunlar
-- ---------------------------------------------------------------------
ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS commission_rate  NUMERIC(5,2),          -- NULL = umumiy foiz (platform_settings)
  ADD COLUMN IF NOT EXISTS manual_students  INTEGER NOT NULL DEFAULT 0,  -- trener o'zi kiritgan (platformadan tashqari)
  ADD COLUMN IF NOT EXISTS badge_source     TEXT,                   -- 'auto' | 'admin' | 'revoked' | NULL
  ADD COLUMN IF NOT EXISTS badge_granted_at TIMESTAMPTZ;

ALTER TABLE public.trainer_profiles DROP CONSTRAINT IF EXISTS tp_commission_rate_check;
ALTER TABLE public.trainer_profiles ADD CONSTRAINT tp_commission_rate_check
  CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100));
ALTER TABLE public.trainer_profiles DROP CONSTRAINT IF EXISTS tp_badge_source_check;
ALTER TABLE public.trainer_profiles ADD CONSTRAINT tp_badge_source_check
  CHECK (badge_source IS NULL OR badge_source IN ('auto', 'admin', 'revoked'));
ALTER TABLE public.trainer_profiles DROP CONSTRAINT IF EXISTS tp_manual_students_check;
ALTER TABLE public.trainer_profiles ADD CONSTRAINT tp_manual_students_check CHECK (manual_students >= 0);

-- ---------------------------------------------------------------------
-- 3. HISOB DAFTARI (ledger) — har bir balans o'zgarishi shu yerda yoziladi
--    Qoida: trainer_profiles.balance = SUM(trainer_ledger.delta)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trainer_ledger (
  id                   BIGSERIAL PRIMARY KEY,
  trainer_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  kind                 TEXT NOT NULL CHECK (kind IN ('sale', 'payout_hold', 'payout_refund', 'adjustment')),
  delta                INTEGER NOT NULL,          -- balansga ta'siri (+/-)
  balance_after        INTEGER NOT NULL,
  gross                INTEGER,                   -- sale: mijoz to'lagan summa
  commission           INTEGER,                   -- sale: platforma ulushi
  commission_rate      NUMERIC(5,2),              -- sale: o'sha paytdagi foiz
  lesson_id            UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  lesson_title         TEXT,                      -- darslik o'chirilsa ham nomi qoladi
  buyer_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  click_transaction_id UUID REFERENCES public.click_transactions(id) ON DELETE SET NULL,
  payout_id            UUID REFERENCES public.payouts(id) ON DELETE SET NULL,
  note                 TEXT,
  created_by           UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_trainer ON public.trainer_ledger (trainer_id, created_at DESC);
-- Bir Click to'lovi faqat BIR marta hisoblanadi (takroriy chaqiruvdan himoya)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_sale_tx ON public.trainer_ledger (click_transaction_id)
  WHERE kind = 'sale' AND click_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_payout_kind ON public.trainer_ledger (payout_id, kind)
  WHERE payout_id IS NOT NULL AND kind IN ('payout_hold', 'payout_refund');
ALTER TABLE public.trainer_ledger ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 4. DARSLIK MODERATSIYASI: status 'removed' (o'chirilgan, tiklash mumkin)
-- ---------------------------------------------------------------------
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS removed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_by          UUID,
  ADD COLUMN IF NOT EXISTS removed_reason      TEXT,
  ADD COLUMN IF NOT EXISTS removed_prev_status TEXT;

DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.lessons'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.lessons DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_status_check CHECK (status IN ('draft', 'published', 'removed'));

-- ---------------------------------------------------------------------
-- 5. BAN TIZIMI
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_bans (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  banned_by   UUID,
  banned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,                 -- NULL = doimiy
  revoked_at  TIMESTAMPTZ,
  revoked_by  UUID,
  revoke_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_bans_user_active ON public.user_bans (user_id) WHERE revoked_at IS NULL;
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_user_banned(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_bans
    WHERE user_id = p_user AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.ban_user(p_user uuid, p_admin uuid, p_reason text, p_until timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role text; v_id bigint;
BEGIN
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 5 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  IF p_user = p_admin THEN RAISE EXCEPTION 'CANNOT_BAN_SELF'; END IF;
  IF p_until IS NOT NULL AND p_until <= now() THEN RAISE EXCEPTION 'BAD_UNTIL'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF v_role = 'admin' THEN RAISE EXCEPTION 'CANNOT_BAN_ADMIN'; END IF;
  IF public.is_user_banned(p_user) THEN RAISE EXCEPTION 'ALREADY_BANNED'; END IF;

  INSERT INTO public.user_bans (user_id, reason, banned_by, expires_at)
  VALUES (p_user, btrim(p_reason), p_admin, p_until) RETURNING id INTO v_id;

  PERFORM public.log_admin_action(p_admin, 'ban_user', 'user', p_user::text,
    jsonb_build_object('reason', btrim(p_reason), 'expires_at', p_until));
  RETURN jsonb_build_object('ban_id', v_id, 'expires_at', p_until);
END $$;

CREATE OR REPLACE FUNCTION public.unban_user(p_user uuid, p_admin uuid, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.user_bans
     SET revoked_at = now(), revoked_by = p_admin, revoke_note = nullif(btrim(coalesce(p_note, '')), '')
   WHERE user_id = p_user AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RAISE EXCEPTION 'NOT_BANNED'; END IF;
  PERFORM public.log_admin_action(p_admin, 'unban_user', 'user', p_user::text, jsonb_build_object('note', p_note));
  RETURN jsonb_build_object('unbanned', v_count);
END $$;

-- ---------------------------------------------------------------------
-- 6. MOLIYA FUNKSIYALARI (hammasi ATOMIK — yarim holat bo'lmaydi)
-- ---------------------------------------------------------------------

-- Karta raqami: 16 raqam + Luhn tekshiruvi (harf xatosini ushlaydi)
CREATE OR REPLACE FUNCTION public.luhn_valid(p_card text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE s int := 0; d int; alt boolean := false; i int;
BEGIN
  IF p_card IS NULL OR p_card !~ '^[0-9]{16}$' THEN RETURN false; END IF;
  FOR i IN REVERSE 16..1 LOOP
    d := substr(p_card, i, 1)::int;
    IF alt THEN d := d * 2; IF d > 9 THEN d := d - 9; END IF; END IF;
    s := s + d; alt := NOT alt;
  END LOOP;
  RETURN s % 10 = 0;
END $$;

-- Pul yechish so'rovi: balansdan DARHOL ushlab qolinadi
CREATE OR REPLACE FUNCTION public.request_payout(p_trainer uuid, p_amount integer, p_card text, p_holder text)
RETURNS public.payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE tp public.trainer_profiles; v_card text; v_holder text; v_min int; v_payout public.payouts; v_new_bal int;
BEGIN
  v_card   := regexp_replace(coalesce(p_card, ''), '\s', '', 'g');
  v_holder := btrim(regexp_replace(coalesce(p_holder, ''), '\s+', ' ', 'g'));

  IF NOT public.luhn_valid(v_card) THEN RAISE EXCEPTION 'BAD_CARD'; END IF;
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

  INSERT INTO public.payouts (trainer_id, amount, card_number, card_holder, status)
  VALUES (p_trainer, p_amount, v_card, upper(v_holder), 'pending') RETURNING * INTO v_payout;

  UPDATE public.trainer_profiles SET balance = balance - p_amount WHERE user_id = p_trainer RETURNING balance INTO v_new_bal;

  INSERT INTO public.trainer_ledger (trainer_id, kind, delta, balance_after, payout_id, note)
  VALUES (p_trainer, 'payout_hold', -p_amount, v_new_bal, v_payout.id, 'Pul yechish so''rovi');

  RETURN v_payout;
END $$;

-- Admin qarori: 'complete' (o'tkazildi) yoki 'reject' (rad + sabab + balans qaytadi)
CREATE OR REPLACE FUNCTION public.resolve_payout(p_payout uuid, p_admin uuid, p_action text, p_note text)
RETURNS public.payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE po public.payouts; v_note text; v_new_bal int;
BEGIN
  IF p_action NOT IN ('complete', 'reject') THEN RAISE EXCEPTION 'BAD_ACTION'; END IF;
  v_note := nullif(btrim(coalesce(p_note, '')), '');

  SELECT * INTO po FROM public.payouts WHERE id = p_payout FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_NOT_FOUND'; END IF;
  IF po.status <> 'pending' THEN RAISE EXCEPTION 'ALREADY_RESOLVED'; END IF;

  IF p_action = 'reject' THEN
    IF v_note IS NULL OR char_length(v_note) < 3 THEN RAISE EXCEPTION 'NOTE_REQUIRED'; END IF;

    PERFORM 1 FROM public.trainer_profiles WHERE user_id = po.trainer_id FOR UPDATE;
    UPDATE public.trainer_profiles SET balance = balance + po.amount WHERE user_id = po.trainer_id RETURNING balance INTO v_new_bal;
    INSERT INTO public.trainer_ledger (trainer_id, kind, delta, balance_after, payout_id, note, created_by)
    VALUES (po.trainer_id, 'payout_refund', po.amount, v_new_bal, po.id, 'So''rov rad etildi: ' || v_note, p_admin);

    UPDATE public.payouts SET status = 'rejected', admin_note = v_note, completed_at = now(), completed_by = p_admin
     WHERE id = po.id RETURNING * INTO po;
  ELSE
    UPDATE public.payouts SET status = 'completed', admin_note = v_note, completed_at = now(), completed_by = p_admin
     WHERE id = po.id RETURNING * INTO po;
  END IF;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (po.trainer_id, 'payout',
            CASE WHEN p_action = 'complete' THEN 'Pul o''tkazildi' ELSE 'Pul yechish rad etildi' END,
            CASE WHEN p_action = 'complete'
                 THEN to_char(po.amount, 'FM999G999G999') || ' so''m kartangizga o''tkazildi'
                 ELSE 'Sabab: ' || v_note || '. ' || to_char(po.amount, 'FM999G999G999') || ' so''m balansingizga qaytarildi' END,
            jsonb_build_object('payout_id', po.id));
  EXCEPTION WHEN OTHERS THEN NULL;  -- bildirishnoma xatosi to'lovni bekor qilmasin
  END;

  PERFORM public.log_admin_action(p_admin, 'payout_' || p_action, 'payout', po.id::text,
    jsonb_build_object('amount', po.amount, 'trainer_id', po.trainer_id, 'note', v_note));
  RETURN po;
END $$;

-- Click to'lovi muvaffaqiyatli: xarid + hisob daftari + balans — BITTA tranzaksiyada
CREATE OR REPLACE FUNCTION public.credit_click_sale(p_merchant_trans_id text, p_click_trans_id text, p_purchase_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  tx public.click_transactions; les public.lessons; tp public.trainer_profiles;
  v_has_tp boolean; v_rate numeric; v_comm int; v_net int; v_new_bal int;
  v_ptype text; v_exp timestamptz; v_sales_before int; v_sales_after int;
BEGIN
  SELECT * INTO tx FROM public.click_transactions WHERE merchant_trans_id = p_merchant_trans_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TX_NOT_FOUND'; END IF;
  IF tx.status = 'completed' THEN RETURN jsonb_build_object('status', 'already_paid'); END IF;
  IF tx.user_id IS NULL OR tx.lesson_id IS NULL THEN RAISE EXCEPTION 'TX_INCOMPLETE'; END IF;

  SELECT * INTO les FROM public.lessons WHERE id = tx.lesson_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'LESSON_NOT_FOUND'; END IF;

  SELECT * INTO tp FROM public.trainer_profiles WHERE user_id = les.trainer_id FOR UPDATE;
  v_has_tp := FOUND;  -- topilmasa: platforma darsligi (egasi admin) — trenerga pul o'tmaydi

  IF v_has_tp THEN
    v_rate := coalesce(tp.commission_rate, public.get_setting('default_commission_percent', 10));
    v_comm := round(tx.amount * v_rate / 100.0)::int;
    v_net  := tx.amount - v_comm;
  ELSE
    v_rate := 100; v_comm := tx.amount; v_net := 0;
  END IF;

  v_ptype := CASE WHEN p_purchase_type = 'monthly' THEN 'monthly' ELSE 'lifetime' END;
  v_exp   := CASE WHEN v_ptype = 'monthly' THEN now() + interval '30 days' ELSE NULL END;

  SELECT coalesce(total_sales, 0) INTO v_sales_before FROM public.lessons WHERE id = les.id;

  INSERT INTO public.purchases (user_id, lesson_id, trainer_id, amount, commission, trainer_amount,
                                payment_method, payment_id, status, purchase_type, expires_at)
  VALUES (tx.user_id, les.id, les.trainer_id, tx.amount, v_comm, v_net,
          'click', p_click_trans_id, 'paid', v_ptype, v_exp)
  ON CONFLICT (user_id, lesson_id) DO UPDATE SET
    amount = EXCLUDED.amount, commission = EXCLUDED.commission, trainer_amount = EXCLUDED.trainer_amount,
    payment_method = 'click', payment_id = EXCLUDED.payment_id, status = 'paid',
    purchase_type = EXCLUDED.purchase_type, expires_at = EXCLUDED.expires_at;

  -- Sotuv soni: agar trigger allaqachon oshirgan bo'lsa qayta oshirmaymiz
  SELECT coalesce(total_sales, 0) INTO v_sales_after FROM public.lessons WHERE id = les.id;
  IF v_sales_after = v_sales_before THEN
    UPDATE public.lessons SET total_sales = coalesce(total_sales, 0) + 1 WHERE id = les.id;
  END IF;

  UPDATE public.click_transactions SET status = 'completed', completed_at = now(), error_code = 0 WHERE id = tx.id;

  IF v_has_tp THEN
    UPDATE public.trainer_profiles
       SET balance = coalesce(balance, 0) + v_net, total_earned = coalesce(total_earned, 0) + v_net
     WHERE user_id = les.trainer_id RETURNING balance INTO v_new_bal;

    INSERT INTO public.trainer_ledger (trainer_id, kind, delta, balance_after, gross, commission, commission_rate,
                                       lesson_id, lesson_title, buyer_id, click_transaction_id, note)
    VALUES (les.trainer_id, 'sale', v_net, v_new_bal, tx.amount, v_comm, v_rate,
            les.id, les.title, tx.user_id, tx.id, v_ptype);

    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (les.trainer_id, 'sale', 'Yangi sotuv!',
              '"' || les.title || '" darsligingiz sotildi. +' || to_char(v_net, 'FM999G999G999') || ' so''m',
              jsonb_build_object('lesson_id', les.id));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'gross', tx.amount, 'commission', v_comm, 'net', v_net,
                            'rate', v_rate, 'trainer_id', les.trainer_id);
END $$;

-- Trener statistikasi (bitta so'rovda, izchil ko'rinish)
CREATE OR REPLACE FUNCTION public.trainer_earnings(p_trainer uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE tp public.trainer_profiles; v jsonb;
BEGIN
  SELECT * INTO tp FROM public.trainer_profiles WHERE user_id = p_trainer;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'rate', coalesce(tp.commission_rate, public.get_setting('default_commission_percent', 10)),
    'custom_rate', tp.commission_rate IS NOT NULL,
    'balance', coalesce(tp.balance, 0),
    'min_payout', public.get_setting('min_payout_amount', 100000)::int,
    'lifetime', (SELECT jsonb_build_object(
        'gross', coalesce(sum(gross), 0), 'commission', coalesce(sum(commission), 0),
        'net', coalesce(sum(delta), 0), 'sales', count(*))
      FROM public.trainer_ledger WHERE trainer_id = p_trainer AND kind = 'sale'),
    'adjustments', (SELECT coalesce(sum(delta), 0) FROM public.trainer_ledger WHERE trainer_id = p_trainer AND kind = 'adjustment'),
    'payouts', (SELECT jsonb_build_object(
        'pending', coalesce(sum(amount) FILTER (WHERE status = 'pending'), 0),
        'paid', coalesce(sum(amount) FILTER (WHERE status = 'completed'), 0),
        'paid_count', count(*) FILTER (WHERE status = 'completed'),
        'rejected_count', count(*) FILTER (WHERE status = 'rejected'))
      FROM public.payouts WHERE trainer_id = p_trainer),
    'reconciled', coalesce(tp.balance, 0) = (SELECT coalesce(sum(delta), 0) FROM public.trainer_ledger WHERE trainer_id = p_trainer),
    'lessons', coalesce((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.net DESC, x.title) FROM (
        SELECT l.id AS lesson_id, l.title, l.cover_image_url AS cover, l.status,
               coalesce(a.sales, 0) AS sales, coalesce(a.gross, 0) AS gross,
               coalesce(a.commission, 0) AS commission, coalesce(a.net, 0) AS net, a.last_sale_at
          FROM public.lessons l
          LEFT JOIN (SELECT lesson_id, count(*) AS sales, sum(gross) AS gross, sum(commission) AS commission,
                            sum(delta) AS net, max(created_at) AS last_sale_at
                       FROM public.trainer_ledger WHERE trainer_id = p_trainer AND kind = 'sale' AND lesson_id IS NOT NULL
                      GROUP BY lesson_id) a ON a.lesson_id = l.id
         WHERE l.trainer_id = p_trainer AND l.status <> 'removed'
        UNION ALL
        SELECT NULL::uuid, coalesce(lesson_title, 'O''chirilgan darslik'), NULL, 'deleted',
               count(*), sum(gross), sum(commission), sum(delta), max(created_at)
          FROM public.trainer_ledger
         WHERE trainer_id = p_trainer AND kind = 'sale' AND lesson_id IS NULL
         GROUP BY lesson_title
      ) x), '[]'::jsonb),
    'monthly', coalesce((
      SELECT jsonb_agg(to_jsonb(m) ORDER BY m.month) FROM (
        SELECT to_char(g.month, 'YYYY-MM') AS month,
               coalesce(s.gross, 0) AS gross, coalesce(s.commission, 0) AS commission,
               coalesce(s.net, 0) AS net, coalesce(s.sales, 0) AS sales
          FROM generate_series(date_trunc('month', (now() AT TIME ZONE 'Asia/Tashkent')) - interval '11 months',
                               date_trunc('month', (now() AT TIME ZONE 'Asia/Tashkent')), interval '1 month') AS g(month)
          LEFT JOIN (SELECT date_trunc('month', created_at AT TIME ZONE 'Asia/Tashkent') AS month,
                            sum(gross) AS gross, sum(commission) AS commission, sum(delta) AS net, count(*) AS sales
                       FROM public.trainer_ledger WHERE trainer_id = p_trainer AND kind = 'sale' GROUP BY 1) s
                 ON s.month = g.month
      ) m), '[]'::jsonb),
    'recent_sales', coalesce((
      SELECT jsonb_agg(to_jsonb(r)) FROM (
        SELECT created_at, lesson_title, gross, commission, delta AS net, commission_rate AS rate, note AS purchase_type
          FROM public.trainer_ledger WHERE trainer_id = p_trainer AND kind = 'sale'
         ORDER BY created_at DESC, id DESC LIMIT 20) r), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;

-- Admin dashboard uchun umumiy moliya
CREATE OR REPLACE FUNCTION public.admin_finance_summary()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'gross',       coalesce((SELECT sum(gross) FROM public.trainer_ledger WHERE kind = 'sale'), 0),
    'commission',  coalesce((SELECT sum(commission) FROM public.trainer_ledger WHERE kind = 'sale'), 0),
    'to_trainers', coalesce((SELECT sum(delta) FROM public.trainer_ledger WHERE kind = 'sale'), 0),
    'sales',       (SELECT count(*) FROM public.trainer_ledger WHERE kind = 'sale'),
    'balances',    coalesce((SELECT sum(balance) FROM public.trainer_profiles), 0),
    'pending_payouts', coalesce((SELECT sum(amount) FROM public.payouts WHERE status = 'pending'), 0),
    'paid_out',    coalesce((SELECT sum(amount) FROM public.payouts WHERE status = 'completed'), 0),
    'gross_30d',   coalesce((SELECT sum(gross) FROM public.trainer_ledger WHERE kind = 'sale' AND created_at > now() - interval '30 days'), 0),
    'commission_30d', coalesce((SELECT sum(commission) FROM public.trainer_ledger WHERE kind = 'sale' AND created_at > now() - interval '30 days'), 0),
    'unreconciled', (SELECT count(*) FROM public.trainer_profiles tp
                      WHERE coalesce(tp.balance, 0) <> coalesce((SELECT sum(delta) FROM public.trainer_ledger l WHERE l.trainer_id = tp.user_id), 0))
  )
$$;

-- ---------------------------------------------------------------------
-- 7. NISHON (TrainerTop Athlete)
-- ---------------------------------------------------------------------
-- Avtomatik nishon FAQAT beriladi (olib tashlash admin qo'lida): obunachi + reyting + sharhlar soni
CREATE OR REPLACE FUNCTION public.refresh_trainer_badge(p_trainer uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE tp public.trainer_profiles;
BEGIN
  SELECT * INTO tp FROM public.trainer_profiles WHERE user_id = p_trainer FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF tp.badge_source IN ('admin', 'revoked') OR tp.is_verified THEN RETURN; END IF;
  IF public.is_user_banned(p_trainer) THEN RETURN; END IF;

  IF coalesce(tp.followers_count, 0) >= public.get_setting('badge_min_followers', 1000)
     AND coalesce(tp.rating, 0)        >= public.get_setting('badge_min_rating', 4.5)
     AND coalesce(tp.total_reviews, 0) >= public.get_setting('badge_min_reviews', 10) THEN
    UPDATE public.trainer_profiles SET is_verified = true, badge_source = 'auto', badge_granted_at = now()
     WHERE user_id = p_trainer;
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (p_trainer, 'badge', 'Tabriklaymiz!', 'Siz TrainerTop Athlete nishonini oldingiz', '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    PERFORM public.log_admin_action(NULL, 'badge_auto_grant', 'trainer', p_trainer::text,
      jsonb_build_object('followers', tp.followers_count, 'rating', tp.rating, 'reviews', tp.total_reviews));
  END IF;
END $$;

-- Barcha (hali nishonsiz) trenerlarni qayta tekshirish — admin sozlamadagi chegarani o'zgartirganda ishlatiladi
CREATE OR REPLACE FUNCTION public.refresh_all_badges() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT user_id FROM public.trainer_profiles
            WHERE NOT is_verified AND coalesce(badge_source, '') NOT IN ('admin', 'revoked')
  LOOP
    PERFORM public.refresh_trainer_badge(r.user_id); n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.trg_refresh_badge() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.refresh_trainer_badge(NEW.user_id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_badge_refresh ON public.trainer_profiles;
CREATE TRIGGER trg_badge_refresh
  AFTER UPDATE OF followers_count, rating, total_reviews ON public.trainer_profiles
  FOR EACH ROW
  WHEN (NEW.followers_count IS DISTINCT FROM OLD.followers_count
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.total_reviews IS DISTINCT FROM OLD.total_reviews)
  EXECUTE FUNCTION public.trg_refresh_badge();

-- ---------------------------------------------------------------------
-- 8. DARSLIK MODERATSIYASI FUNKSIYALARI (o'chirish = yashirish, tiklash mumkin)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_lesson(p_lesson uuid, p_admin uuid, p_reason text)
RETURNS public.lessons LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE l public.lessons; v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF char_length(v_reason) < 5 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  SELECT * INTO l FROM public.lessons WHERE id = p_lesson FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LESSON_NOT_FOUND'; END IF;
  IF l.status = 'removed' THEN RAISE EXCEPTION 'ALREADY_REMOVED'; END IF;

  UPDATE public.lessons
     SET removed_prev_status = status, status = 'removed', removed_at = now(), removed_by = p_admin, removed_reason = v_reason
   WHERE id = p_lesson RETURNING * INTO l;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (l.trainer_id, 'lesson', 'Darsligingiz olib tashlandi', '"' || l.title || '": ' || v_reason,
            jsonb_build_object('lesson_id', l.id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM public.log_admin_action(p_admin, 'lesson_remove', 'lesson', l.id::text,
    jsonb_build_object('title', l.title, 'reason', v_reason, 'trainer_id', l.trainer_id));
  RETURN l;
END $$;

CREATE OR REPLACE FUNCTION public.restore_lesson(p_lesson uuid, p_admin uuid)
RETURNS public.lessons LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE l public.lessons;
BEGIN
  SELECT * INTO l FROM public.lessons WHERE id = p_lesson FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LESSON_NOT_FOUND'; END IF;
  IF l.status <> 'removed' THEN RAISE EXCEPTION 'NOT_REMOVED'; END IF;

  UPDATE public.lessons
     SET status = coalesce(removed_prev_status, 'draft'), removed_at = NULL, removed_by = NULL,
         removed_reason = NULL, removed_prev_status = NULL
   WHERE id = p_lesson RETURNING * INTO l;

  PERFORM public.log_admin_action(p_admin, 'lesson_restore', 'lesson', l.id::text, jsonb_build_object('title', l.title));
  RETURN l;
END $$;

-- ---------------------------------------------------------------------
-- 9. SHOGIRDLAR: trener kiritgan son + platformadagi xaridorlar
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_lesson_sales() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    UPDATE public.lessons SET total_sales = coalesce(total_sales, 0) + 1 WHERE id = NEW.lesson_id;
    UPDATE public.trainer_profiles
       SET total_students = coalesce(manual_students, 0) + (
             SELECT count(DISTINCT user_id) FROM public.purchases WHERE trainer_id = NEW.trainer_id AND status = 'paid')
     WHERE user_id = NEW.trainer_id;
  END IF;
  RETURN NEW;
END $$;

-- 9b. Reyting hisoblash triggerlari: SECURITY DEFINER bo'lishi shart.
--     Aks holda sharhni boshqa foydalanuvchi yozganda trenerning reytingi RLS tufayli
--     yangilanmay qoladi (nishon shartlari reyting/sharhlar soniga tayanadi).
CREATE OR REPLACE FUNCTION public.update_trainer_rating() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_trainer uuid := COALESCE(NEW.trainer_id, OLD.trainer_id);
BEGIN
  UPDATE public.trainer_profiles
     SET rating = (SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE trainer_id = v_trainer),
         total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE trainer_id = v_trainer)
   WHERE user_id = v_trainer;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.update_lesson_rating() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.lesson_id IS NOT NULL THEN
    UPDATE public.lessons
       SET rating = (SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE lesson_id = NEW.lesson_id),
           total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE lesson_id = NEW.lesson_id)
     WHERE id = NEW.lesson_id;
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- 10. OBUNACHILAR SONI (follows jadvalidan avtomatik) — "zzz" nomi: oxirida ishlaydi
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_followers_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_trainer uuid := COALESCE(NEW.trainer_id, OLD.trainer_id);
BEGIN
  UPDATE public.trainer_profiles
     SET followers_count = (SELECT count(*) FROM public.follows WHERE trainer_id = v_trainer)
   WHERE user_id = v_trainer;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS zzz_sync_followers_count ON public.follows;
CREATE TRIGGER zzz_sync_followers_count AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.sync_followers_count();

-- ---------------------------------------------------------------------
-- 11. HIMOYA TRIGGERLARI: brauzerdan (anon key) muhim ustunlarni o'zgartirib bo'lmaydi
--     Server (service_role) va ichki triggerlar ta'sirlanmaydi.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profiles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() = 1 AND current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN NEW.role := 'user'; ELSE NEW.role := OLD.role; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_profiles ON public.profiles;
CREATE TRIGGER trg_protect_profiles BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profiles();

CREATE OR REPLACE FUNCTION public.protect_trainer_profiles() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_buyers int;
BEGIN
  IF pg_trigger_depth() = 1 AND current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.balance := 0; NEW.total_earned := 0; NEW.rating := 0; NEW.total_reviews := 0;
      NEW.total_students := coalesce(NEW.manual_students, 0); NEW.followers_count := 0;
      NEW.is_verified := false; NEW.badge_source := NULL; NEW.badge_granted_at := NULL; NEW.commission_rate := NULL;
    ELSE
      NEW.user_id := OLD.user_id;
      NEW.balance := OLD.balance; NEW.total_earned := OLD.total_earned;
      NEW.rating := OLD.rating; NEW.total_reviews := OLD.total_reviews;
      NEW.total_students := OLD.total_students; NEW.followers_count := OLD.followers_count;
      NEW.is_verified := OLD.is_verified; NEW.badge_source := OLD.badge_source;
      NEW.badge_granted_at := OLD.badge_granted_at; NEW.commission_rate := OLD.commission_rate;
    END IF;
  END IF;

  -- Trener "shogirdlar soni"ni o'zgartirsa: jami = kiritgani + platformadagi xaridorlar
  IF TG_OP = 'UPDATE' AND NEW.manual_students IS DISTINCT FROM OLD.manual_students THEN
    SELECT count(DISTINCT user_id) INTO v_buyers FROM public.purchases WHERE trainer_id = NEW.user_id AND status = 'paid';
    NEW.total_students := coalesce(NEW.manual_students, 0) + coalesce(v_buyers, 0);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_trainer_profiles ON public.trainer_profiles;
CREATE TRIGGER trg_protect_trainer_profiles BEFORE INSERT OR UPDATE ON public.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_trainer_profiles();

CREATE OR REPLACE FUNCTION public.protect_lessons() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() = 1 AND current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.total_sales := 0; NEW.rating := 0; NEW.total_reviews := 0;
      NEW.removed_at := NULL; NEW.removed_by := NULL; NEW.removed_reason := NULL; NEW.removed_prev_status := NULL;
      IF NEW.status = 'removed' THEN NEW.status := 'draft'; END IF;
      IF to_jsonb(NEW) ? 'is_platform' THEN NEW := jsonb_populate_record(NEW, jsonb_build_object('is_platform', false)); END IF;
    ELSE
      NEW.trainer_id := OLD.trainer_id;
      NEW.total_sales := OLD.total_sales; NEW.rating := OLD.rating; NEW.total_reviews := OLD.total_reviews;
      NEW.removed_at := OLD.removed_at; NEW.removed_by := OLD.removed_by;
      NEW.removed_reason := OLD.removed_reason; NEW.removed_prev_status := OLD.removed_prev_status;
      IF OLD.status = 'removed' THEN NEW.status := 'removed';
      ELSIF NEW.status = 'removed' THEN NEW.status := OLD.status; END IF;
      IF to_jsonb(OLD) ? 'is_platform' THEN
        NEW := jsonb_populate_record(NEW, jsonb_build_object('is_platform', to_jsonb(OLD) -> 'is_platform'));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_lessons ON public.lessons;
CREATE TRIGGER trg_protect_lessons BEFORE INSERT OR UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.protect_lessons();

-- ---------------------------------------------------------------------
-- 12. RLS: pul jadvallari va maxfiy jadvallar faqat server orqali yoziladi
--     (mavjud policy'lar nomidan qat'i nazar, avval hammasi olib tashlanadi)
-- ---------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public' AND tablename IN ('purchases', 'payouts', 'notifications', 'messages')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- Xaridlar: o'qish faqat xaridor va trener; yozish faqat server (Click orqali)
CREATE POLICY purchases_select_own ON public.purchases FOR SELECT
  USING (user_id = auth.uid() OR trainer_id = auth.uid());

-- Pul yechish: trener faqat o'zinikini ko'radi; yozish faqat server (RPC)
CREATE POLICY payouts_select_own ON public.payouts FOR SELECT USING (trainer_id = auth.uid());

-- Bildirishnomalar: faqat o'ziniki; yaratish faqat server
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY notifications_delete_own ON public.notifications FOR DELETE USING (user_id = auth.uid());

-- Chat: xabarlarni faqat suhbat ishtirokchilari o'qiy oladi va yoza oladi
CREATE POLICY messages_select_participant ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversations c
           WHERE c.id = messages.conversation_id AND (c.trainer_id = auth.uid() OR c.user_id = auth.uid())));
CREATE POLICY messages_insert_participant ON public.messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.conversations c
           WHERE c.id = messages.conversation_id AND (c.trainer_id = auth.uid() OR c.user_id = auth.uid())));

-- Supabase Storage: brauzerdan yuklash/o'chirish yopiladi (fayllar endi R2 orqali server tomonidan yuklanadi).
-- Ochiq (public) bucket fayllarini o'qish saqlanadi.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Storage policy''lar o''tkazib yuborildi: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------
-- 13. FUNKSIYALARGA RUXSAT: faqat server (service_role) chaqira oladi
--     (Supabase public sxemasidagi funksiyalarni sukut bo'yicha hamma chaqira oladi!)
-- ---------------------------------------------------------------------
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.get_setting(text,numeric)', 'public.log_admin_action(uuid,text,text,text,jsonb)',
    'public.is_user_banned(uuid)', 'public.ban_user(uuid,uuid,text,timestamptz)', 'public.unban_user(uuid,uuid,text)',
    'public.request_payout(uuid,integer,text,text)', 'public.resolve_payout(uuid,uuid,text,text)',
    'public.credit_click_sale(text,text,text)', 'public.trainer_earnings(uuid)', 'public.admin_finance_summary()',
    'public.refresh_trainer_badge(uuid)', 'public.refresh_all_badges()', 'public.remove_lesson(uuid,uuid,text)', 'public.restore_lesson(uuid,uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 14. MAVJUD MA'LUMOTLARNI MOSLASHTIRISH (bir martalik)
-- ---------------------------------------------------------------------

-- 14.1 Obunachilar soni
UPDATE public.trainer_profiles tp
   SET followers_count = (SELECT count(*) FROM public.follows f WHERE f.trainer_id = tp.user_id);

-- 14.2 Shogirdlar: eski "total_students" = trener kiritgani (xaridorlarni ayirib)
UPDATE public.trainer_profiles tp
   SET manual_students = GREATEST(coalesce(tp.total_students, 0) -
         (SELECT count(DISTINCT user_id) FROM public.purchases p WHERE p.trainer_id = tp.user_id AND p.status = 'paid'), 0)
 WHERE tp.manual_students = 0;
UPDATE public.trainer_profiles tp
   SET total_students = tp.manual_students +
         (SELECT count(DISTINCT user_id) FROM public.purchases p WHERE p.trainer_id = tp.user_id AND p.status = 'paid');

-- 14.3 Avval berilgan "tasdiqlangan" belgilar admin qarori deb hisoblanadi
UPDATE public.trainer_profiles SET badge_source = 'admin', badge_granted_at = coalesce(badge_granted_at, now())
 WHERE is_verified = true AND badge_source IS NULL;

-- 14.4 Hisob daftarini mavjud sotuvlar va yechishlardan tiklash (faqat daftari bo'sh trenerlar uchun)
INSERT INTO public.trainer_ledger (trainer_id, kind, delta, balance_after, gross, commission, commission_rate,
                                   lesson_id, lesson_title, buyer_id, click_transaction_id, note, created_at)
SELECT l.trainer_id, 'sale',
       ct.amount - round(ct.amount * 0.1)::int, 0, ct.amount, round(ct.amount * 0.1)::int, 10,
       l.id, l.title, ct.user_id, ct.id, 'Migratsiya (10% deb hisoblandi)', coalesce(ct.completed_at, ct.created_at)
  FROM public.click_transactions ct
  JOIN public.lessons l ON l.id = ct.lesson_id
  JOIN public.trainer_profiles tp ON tp.user_id = l.trainer_id
 WHERE ct.status = 'completed'
   AND NOT EXISTS (SELECT 1 FROM public.trainer_ledger x WHERE x.trainer_id = l.trainer_id AND x.kind <> 'adjustment')
ON CONFLICT DO NOTHING;

INSERT INTO public.trainer_ledger (trainer_id, kind, delta, balance_after, payout_id, note, created_at)
SELECT po.trainer_id, 'payout_hold', -po.amount, 0, po.id, 'Migratsiya', po.requested_at
  FROM public.payouts po
 WHERE NOT EXISTS (SELECT 1 FROM public.trainer_ledger x WHERE x.payout_id = po.id AND x.kind = 'payout_hold')
   AND EXISTS (SELECT 1 FROM public.trainer_profiles t WHERE t.user_id = po.trainer_id)
ON CONFLICT DO NOTHING;

INSERT INTO public.trainer_ledger (trainer_id, kind, delta, balance_after, payout_id, note, created_at)
SELECT po.trainer_id, 'payout_refund', po.amount, 0, po.id, 'Migratsiya (rad etilgan)', coalesce(po.completed_at, po.requested_at)
  FROM public.payouts po
 WHERE po.status = 'rejected'
   AND EXISTS (SELECT 1 FROM public.trainer_ledger h WHERE h.payout_id = po.id AND h.kind = 'payout_hold' AND h.note = 'Migratsiya')
   AND NOT EXISTS (SELECT 1 FROM public.trainer_ledger x WHERE x.payout_id = po.id AND x.kind = 'payout_refund')
ON CONFLICT DO NOTHING;

-- Yuritilgan balans (balance_after) ni tartib bo'yicha hisoblash
WITH running AS (
  SELECT id, sum(delta) OVER (PARTITION BY trainer_id ORDER BY created_at, id) AS rb
    FROM public.trainer_ledger WHERE note LIKE 'Migratsiya%'
)
UPDATE public.trainer_ledger l SET balance_after = r.rb FROM running r WHERE l.id = r.id;

-- Daftar yig'indisi joriy balansga teng bo'lmasa — farq "moslashtirish" yozuvi bilan tenglashtiriladi
INSERT INTO public.trainer_ledger (trainer_id, kind, delta, balance_after, note)
SELECT tp.user_id, 'adjustment',
       coalesce(tp.balance, 0) - coalesce((SELECT sum(delta) FROM public.trainer_ledger l WHERE l.trainer_id = tp.user_id), 0),
       coalesce(tp.balance, 0), 'Boshlang''ich moslashtirish (migratsiyadan oldingi hisob)'
  FROM public.trainer_profiles tp
 WHERE coalesce(tp.balance, 0) <> coalesce((SELECT sum(delta) FROM public.trainer_ledger l WHERE l.trainer_id = tp.user_id), 0);

-- 14.5 Nishon: mavjud trenerlarni tekshirish (shartga mos bo'lsa avtomatik beriladi)
SELECT public.refresh_all_badges();

-- =====================================================================
-- TEKSHIRUV (natija: hammasi "OK" bo'lishi kerak)
-- =====================================================================
SELECT 'ledger jadvali'            AS tekshiruv, CASE WHEN to_regclass('public.trainer_ledger') IS NOT NULL THEN 'OK' ELSE 'XATO' END AS natija
UNION ALL SELECT 'himoya triggerlari (3 ta)',
       CASE WHEN (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_protect_profiles','trg_protect_trainer_profiles','trg_protect_lessons') AND NOT tgisinternal) = 3 THEN 'OK' ELSE 'XATO' END
UNION ALL SELECT 'balans = daftar yig''indisi (nomos trenerlar soni: 0 bo''lishi kerak)',
       (SELECT count(*) FROM public.trainer_profiles tp WHERE coalesce(tp.balance,0) <> coalesce((SELECT sum(delta) FROM public.trainer_ledger l WHERE l.trainer_id = tp.user_id),0))::text
UNION ALL SELECT 'purchases policy''lari (faqat 1 ta: select)',
       (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='purchases')::text
UNION ALL SELECT 'payouts policy''lari (faqat 1 ta: select)',
       (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='payouts')::text
UNION ALL SELECT 'sozlamalar (5 ta)', (SELECT count(*) FROM public.platform_settings)::text;
