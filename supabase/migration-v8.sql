-- ============================================
-- MIGRATION V8
-- Lesson Questions + Review fix
-- ============================================

-- 1. LESSON QUESTIONS — savollar
CREATE TABLE IF NOT EXISTS public.lesson_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT, -- trener javobi
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_questions_lesson ON public.lesson_questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_questions_user ON public.lesson_questions(user_id);

ALTER TABLE public.lesson_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads questions" ON public.lesson_questions;
CREATE POLICY "Anyone reads questions" ON public.lesson_questions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users create questions" ON public.lesson_questions;
CREATE POLICY "Users create questions" ON public.lesson_questions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Trainers answer questions" ON public.lesson_questions;
CREATE POLICY "Trainers answer questions" ON public.lesson_questions
  FOR UPDATE USING (true);

-- 2. Reviews — lesson_id uchun unique constraint
-- Eski constraint trener uchun edi, endi lesson uchun ham
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS unique_lesson_review;
ALTER TABLE public.reviews ADD CONSTRAINT unique_lesson_review UNIQUE (lesson_id, user_id);
