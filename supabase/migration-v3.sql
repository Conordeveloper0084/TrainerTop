-- =============================================
-- TRAINERTOP MIGRATION v3
-- Yetishmagan ustunlarni qo'shish
-- =============================================

-- 1. trainer_profiles ga yangi ustunlar
ALTER TABLE public.trainer_profiles 
  ADD COLUMN IF NOT EXISTS consultation_price INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_price INTEGER,
  ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;

-- 2. follows jadvali (agar yo'q bo'lsa)
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, trainer_id)
);

-- 3. posts jadvalida likes_count va comments_count
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

-- 4. RLS policies

-- Trainer profiles - hamma ko'ra olsin, o'zi o'zgartira olsin
ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_profiles_select" ON public.trainer_profiles;
CREATE POLICY "trainer_profiles_select" ON public.trainer_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "trainer_profiles_update" ON public.trainer_profiles;
CREATE POLICY "trainer_profiles_update" ON public.trainer_profiles
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "trainer_profiles_insert" ON public.trainer_profiles;
CREATE POLICY "trainer_profiles_insert" ON public.trainer_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Posts - hamma ko'rsin, o'zi yaratsin/o'zgartirsin
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select" ON public.posts;
CREATE POLICY "posts_select" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "posts_insert" ON public.posts;
CREATE POLICY "posts_insert" ON public.posts FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "posts_update" ON public.posts;
CREATE POLICY "posts_update" ON public.posts FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "posts_delete" ON public.posts;
CREATE POLICY "posts_delete" ON public.posts FOR DELETE USING (user_id = auth.uid());

-- Post likes
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_likes_select" ON public.post_likes;
CREATE POLICY "post_likes_select" ON public.post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "post_likes_insert" ON public.post_likes;
CREATE POLICY "post_likes_insert" ON public.post_likes FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "post_likes_delete" ON public.post_likes;
CREATE POLICY "post_likes_delete" ON public.post_likes FOR DELETE USING (user_id = auth.uid());

-- Post comments
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comments_select" ON public.post_comments;
CREATE POLICY "post_comments_select" ON public.post_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "post_comments_insert" ON public.post_comments;
CREATE POLICY "post_comments_insert" ON public.post_comments FOR INSERT WITH CHECK (user_id = auth.uid());

-- Follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_select" ON public.follows;
CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "follows_insert" ON public.follows;
CREATE POLICY "follows_insert" ON public.follows FOR INSERT WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS "follows_delete" ON public.follows;
CREATE POLICY "follows_delete" ON public.follows FOR DELETE USING (follower_id = auth.uid());

-- Lessons
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lessons_select" ON public.lessons;
CREATE POLICY "lessons_select" ON public.lessons FOR SELECT USING (true);

DROP POLICY IF EXISTS "lessons_insert" ON public.lessons;
CREATE POLICY "lessons_insert" ON public.lessons FOR INSERT WITH CHECK (trainer_id = auth.uid());

DROP POLICY IF EXISTS "lessons_update" ON public.lessons;
CREATE POLICY "lessons_update" ON public.lessons FOR UPDATE USING (trainer_id = auth.uid());

DROP POLICY IF EXISTS "lessons_delete" ON public.lessons;
CREATE POLICY "lessons_delete" ON public.lessons FOR DELETE USING (trainer_id = auth.uid());

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select" ON public.reviews;
CREATE POLICY "reviews_select" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;
CREATE POLICY "reviews_insert" ON public.reviews FOR INSERT WITH CHECK (user_id = auth.uid());

-- Storage buckets (agar yo'q bo'lsa)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('posts', 'posts', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('lessons', 'lessons', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('gyms', 'gyms', true) ON CONFLICT DO NOTHING;

-- Storage policies - har kim yuklash va ko'rish mumkin
DROP POLICY IF EXISTS "storage_public_select" ON storage.objects;
CREATE POLICY "storage_public_select" ON storage.objects FOR SELECT USING (true);

DROP POLICY IF EXISTS "storage_auth_insert" ON storage.objects;
CREATE POLICY "storage_auth_insert" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "storage_auth_update" ON storage.objects;
CREATE POLICY "storage_auth_update" ON storage.objects FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "storage_auth_delete" ON storage.objects;
CREATE POLICY "storage_auth_delete" ON storage.objects FOR DELETE USING (auth.role() = 'authenticated');
