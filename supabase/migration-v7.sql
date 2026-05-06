-- ============================================
-- MIGRATION V7
-- Pricing model + Security tracking
-- ============================================

-- 1. LESSONS - pricing model qo'shish
-- Endi 3 xil model: lifetime, monthly, both
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS pricing_model TEXT
  CHECK (pricing_model IN ('lifetime', 'monthly', 'both'))
  DEFAULT 'lifetime';

-- Lifetime narxi (bir martalik)
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS price_lifetime INTEGER DEFAULT 0;

-- Monthly narxi (oylik)
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS price_monthly INTEGER DEFAULT 0;

-- Eski 'price' ni price_lifetime'ga ko'chirish
UPDATE public.lessons SET price_lifetime = price WHERE price_lifetime = 0 AND price > 0;

-- 2. PURCHASES - subscription type
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS purchase_type TEXT
  CHECK (purchase_type IN ('lifetime', 'monthly'))
  DEFAULT 'lifetime';

-- Subscription muddati (monthly uchun)
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
-- NULL = lifetime (hech qachon tugamaydi)
-- Sana = monthly (shu sanadan keyin tugaydi)

-- 3. SECURITY - video kirish jurnalini yuritish
CREATE TABLE IF NOT EXISTS public.video_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_access_user ON public.video_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_video_access_lesson ON public.video_access_log(lesson_id);
CREATE INDEX IF NOT EXISTS idx_video_access_time ON public.video_access_log(accessed_at DESC);

-- RLS
ALTER TABLE public.video_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own access log" ON public.video_access_log;
CREATE POLICY "Users see own access log" ON public.video_access_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service inserts access log" ON public.video_access_log;
CREATE POLICY "Service inserts access log" ON public.video_access_log
  FOR INSERT WITH CHECK (true);

-- 4. ACTIVE SESSIONS - bir vaqtda 1 qurilma uchun
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON public.user_sessions(last_active DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own sessions" ON public.user_sessions;
CREATE POLICY "Users see own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own sessions" ON public.user_sessions;
CREATE POLICY "Users manage own sessions" ON public.user_sessions
  FOR ALL USING (auth.uid() = user_id);
