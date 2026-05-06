-- =============================================
-- TRAINERTOP MIGRATION v5
-- Chat, Notifications, Post Views
-- =============================================

-- 1. Post views ustuni
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- 2. Notifications jadvali
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'message', 'like', 'comment', 'follow', 'payout'
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}', -- qo'shimcha ma'lumot (post_id, conversation_id, ...)
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);

-- 3. RLS policies

-- Conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conv_select" ON public.conversations;
CREATE POLICY "conv_select" ON public.conversations FOR SELECT USING (
  trainer_id = auth.uid() OR user_id = auth.uid()
);
DROP POLICY IF EXISTS "conv_insert" ON public.conversations;
CREATE POLICY "conv_insert" ON public.conversations FOR INSERT WITH CHECK (
  trainer_id = auth.uid() OR user_id = auth.uid()
);
DROP POLICY IF EXISTS "conv_update" ON public.conversations;
CREATE POLICY "conv_update" ON public.conversations FOR UPDATE USING (
  trainer_id = auth.uid() OR user_id = auth.uid()
);

-- Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "msg_select" ON public.messages;
CREATE POLICY "msg_select" ON public.messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "msg_insert" ON public.messages;
CREATE POLICY "msg_insert" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
CREATE POLICY "notif_select" ON public.notifications FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "notif_update" ON public.notifications;
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- 4. Supabase Realtime yoqish
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
