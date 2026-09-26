-- ============================================================================
-- TRAINERTOP — migration v14a: xavfsizlik (1-qism) + support murojaatlari
-- Bu qism QO'SHIMCHA (additiv) — kodni deploy qilishdan OLDIN ishga tushiriladi.
-- Eski kod ham, yangi kod ham bu qismdan keyin ishlayveradi. Qayta ishga tushirsa xavfsiz.
-- Keyin: kodni deploy qiling → tekshiring → migration-v14b-lock-columns.sql ni ishga tushiring.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. O'Z profilim: brauzer email/telefon/balansni to'g'ridan-to'g'ri o'qimasligi uchun
--    (v14b da bu ustunlar brauzerdan yopiladi; o'z ma'lumotlarim shu funksiyalar orqali keladi)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.get_my_trainer_profile()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT to_jsonb(t) FROM public.trainer_profiles t WHERE t.user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.get_my_profile()         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_trainer_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile()         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_trainer_profile() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Keraksiz brauzer yozish huquqlari olib tashlanadi (hamma yozuv API orqali, service_role)
--    Siyosat nomlari muhitga qarab farq qilishi mumkin, shuning uchun jadval + amal bo'yicha o'chiriladi.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
     WHERE schemaname = 'public' AND (
           (tablename = 'lesson_questions' AND cmd IN ('UPDATE', 'ALL'))    -- savollarni hamma o'zgartira olardi
        OR (tablename = 'video_access_log'  AND cmd IN ('INSERT', 'ALL'))   -- hamma jurnalga yoza olardi
        OR (tablename = 'posts'             AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL'))  -- API'ni aylanib post yaratish
        OR (tablename = 'messages'          AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL'))) -- API'ni aylanib xabar yozish
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Ochiq turgan eski karta ma'lumotlari: ustunlar butunlay olib tashlanadi
--    (kodda hech qayerda ishlatilmaydi; to'lovlar o'z jadvalida `payouts`)
-- ---------------------------------------------------------------------------
ALTER TABLE public.trainer_profiles DROP COLUMN IF EXISTS card_number;
ALTER TABLE public.trainer_profiles DROP COLUMN IF EXISTS card_holder;

-- ---------------------------------------------------------------------------
-- 4. Oylik to'lov: muddat mavjud obunaning oxiridan uzaytiriladi (to'langan kunlar yo'qolmaydi)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_click_sale(p_merchant_trans_id text, p_click_trans_id text, p_purchase_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  tx public.click_transactions; les public.lessons; tp public.trainer_profiles;
  v_has_tp boolean; v_rate numeric; v_comm int; v_net int; v_new_bal int;
  v_ptype text; v_exp timestamptz; v_prev timestamptz; v_sales_before int; v_sales_after int;
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
  -- Oylik: agar avvalgi oylik obuna hali tugamagan bo'lsa (masalan, ikki marta parallel to'langan),
  -- yangi muddat uning OXIRIDAN hisoblanadi — to'langan kunlar yo'qolmaydi.
  SELECT expires_at INTO v_prev FROM public.purchases
   WHERE user_id = tx.user_id AND lesson_id = les.id AND status = 'paid' AND purchase_type = 'monthly';
  v_exp   := CASE WHEN v_ptype = 'monthly' THEN greatest(now(), coalesce(v_prev, now())) + interval '30 days' ELSE NULL END;

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

-- ---------------------------------------------------------------------------
-- 5. SUPPORT murojaatlari (sayt formasi → admin paneli)
--    Jadval nomlari ATAYLAB `web_support_*`: bazada eskidan `support_tickets` / `support_messages` (bot yoki boshqa
--    urinishdan) bo'lishi mumkin — ularga TEGILMAYDI, to'qnashuv bo'lmaydi.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.web_support_tickets (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name            text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  email           text NOT NULL CHECK (char_length(email) BETWEEN 5 AND 200),
  subject         text CHECK (subject IS NULL OR char_length(subject) <= 120),
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'answered', 'closed')),
  source          text NOT NULL DEFAULT 'web',
  ip_hash         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  answered_at     timestamptz,
  closed_at       timestamptz
);
CREATE TABLE IF NOT EXISTS public.web_support_messages (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   uuid NOT NULL REFERENCES public.web_support_tickets(id) ON DELETE CASCADE,
  sender      text NOT NULL CHECK (sender IN ('user', 'admin')),
  admin_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  delivered   text,                              -- admin javobi qanday yetkazildi: notification | email | both | none
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_support_tickets_status_idx ON public.web_support_tickets (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS web_support_tickets_email_idx  ON public.web_support_tickets (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS web_support_tickets_ip_idx     ON public.web_support_tickets (ip_hash, created_at DESC) WHERE ip_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS web_support_messages_ticket_idx ON public.web_support_messages (ticket_id, created_at);

-- Yangi xabar: foydalanuvchidan → "new" (qayta ochiladi), admindan → "answered". Yopilgan murojaat o'zgarmaydi.
CREATE OR REPLACE FUNCTION public.trg_web_support_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.web_support_tickets
     SET last_message_at = NEW.created_at,
         status = CASE WHEN NEW.sender = 'admin' THEN 'answered' ELSE 'new' END,
         answered_at = CASE WHEN NEW.sender = 'admin' THEN NEW.created_at ELSE answered_at END
   WHERE id = NEW.ticket_id AND status <> 'closed';
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS web_support_messages_touch ON public.web_support_messages;
CREATE TRIGGER web_support_messages_touch AFTER INSERT ON public.web_support_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_web_support_message();

-- Faqat server (service_role): brauzer/anon hech narsa o'qiy yoki yoza olmaydi
ALTER TABLE public.web_support_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_support_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_support_tickets, public.web_support_messages FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'get_my_profile / get_my_trainer_profile mavjud' AS tekshiruv,
       CASE WHEN to_regprocedure('public.get_my_profile()') IS NOT NULL AND to_regprocedure('public.get_my_trainer_profile()') IS NOT NULL THEN 'OK' ELSE 'XATO' END AS natija
UNION ALL SELECT 'karta ustunlari o''chirilgan (0 bo''lishi kerak)',
       (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='trainer_profiles' AND column_name IN ('card_number','card_holder'))::text
UNION ALL SELECT 'ochiq yozish siyosatlari qolmagan: posts/messages (0 bo''lishi kerak)',
       (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename IN ('posts','messages') AND cmd IN ('INSERT','UPDATE','DELETE','ALL'))::text
UNION ALL SELECT 'support jadvallari va RLS',
       CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid='public.web_support_tickets'::regclass) AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.web_support_messages'::regclass) THEN 'OK' ELSE 'XATO' END;
