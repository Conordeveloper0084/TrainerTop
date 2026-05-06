-- =============================================
-- TRAINERTOP MIGRATION v6
-- Admin role + Pul yechish tizimi
-- =============================================

-- 1. profiles.role - 'admin' qo'shish
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('trainer', 'user', 'admin'));

-- 2. trainer_profiles - karta raqami va balans
ALTER TABLE public.trainer_profiles ADD COLUMN IF NOT EXISTS card_number TEXT;
ALTER TABLE public.trainer_profiles ADD COLUMN IF NOT EXISTS card_holder TEXT;
ALTER TABLE public.trainer_profiles ADD COLUMN IF NOT EXISTS balance INTEGER DEFAULT 0;
ALTER TABLE public.trainer_profiles ADD COLUMN IF NOT EXISTS total_earned INTEGER DEFAULT 0;

-- 3. Payouts jadvali - pul yechish requestlari
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  card_number TEXT NOT NULL,
  card_holder TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
  admin_note TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_payouts_trainer ON public.payouts(trainer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);

-- 4. RLS Policies

-- Payouts: Trener o'zinikini ko'radi, admin hammasini
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payouts_select" ON public.payouts;
CREATE POLICY "payouts_select" ON public.payouts FOR SELECT USING (
  trainer_id = auth.uid() 
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "payouts_insert" ON public.payouts;
CREATE POLICY "payouts_insert" ON public.payouts FOR INSERT WITH CHECK (
  trainer_id = auth.uid()
);

DROP POLICY IF EXISTS "payouts_update" ON public.payouts;
CREATE POLICY "payouts_update" ON public.payouts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5. Admin o'qish uchun profiles policy
DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.profiles;
CREATE POLICY "admin_read_all_profiles" ON public.profiles FOR SELECT USING (
  auth.uid() = id  -- o'z profilini ko'radi
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  OR true  -- public read ochiq (landing'da trenerlar ko'rinadi)
);

-- 6. Notifications - payout uchun
-- Notifications jadvali v5 da yaratilgan, qo'shimcha policy kerak emas

-- =============================================
-- MUHIM: Shu migration bajarilgandan keyin
-- o'z akkauntingizni ADMIN qilish uchun:
--
-- 1. Sign up qiling (agar hali qilmagan bo'lsangiz)
-- 2. Shu SQL ni run qiling:
--
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE email = 'sizning_email@example.com';
--
-- =============================================
