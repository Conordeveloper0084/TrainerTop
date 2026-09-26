-- ============================================
-- MIGRATION V9
-- Click payment transactions
-- ============================================

-- Click tranzaksiyalar jadvali
CREATE TABLE IF NOT EXISTS public.click_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Click tomonidan
  click_trans_id BIGINT UNIQUE,
  click_paydoc_id BIGINT,
  
  -- Bizning tomonimizdan
  merchant_trans_id TEXT NOT NULL,       -- order ID (purchase_id yoki custom)
  merchant_prepare_id BIGINT,            -- prepare bosqichida qaytariladi
  
  -- Ma'lumotlar
  user_id UUID REFERENCES public.profiles(id),
  lesson_id UUID REFERENCES public.lessons(id),
  amount INTEGER NOT NULL,               -- so'mda
  status TEXT CHECK (status IN ('pending', 'preparing', 'completed', 'cancelled', 'failed')) DEFAULT 'pending',
  error_code INTEGER DEFAULT 0,
  error_note TEXT,
  
  -- Vaqtlar
  sign_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_click_trans_merchant ON public.click_transactions(merchant_trans_id);
CREATE INDEX IF NOT EXISTS idx_click_trans_click ON public.click_transactions(click_trans_id);
CREATE INDEX IF NOT EXISTS idx_click_trans_user ON public.click_transactions(user_id);

ALTER TABLE public.click_transactions ENABLE ROW LEVEL SECURITY;

-- Faqat service role yoza oladi (webhook orqali)
DROP POLICY IF EXISTS "Click trans read own" ON public.click_transactions;
CREATE POLICY "Click trans read own" ON public.click_transactions
  FOR SELECT USING (auth.uid() = user_id);
