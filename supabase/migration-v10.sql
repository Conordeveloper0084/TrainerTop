-- MIGRATION V10: Oylik obuna tizimi
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS purchase_type TEXT DEFAULT 'lifetime';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
