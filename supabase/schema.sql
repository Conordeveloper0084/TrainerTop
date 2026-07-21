-- ============================================
-- TRAINERTOP DATABASE SCHEMA
-- Supabase PostgreSQL
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS (Supabase Auth bilan bog'langan)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('trainer', 'user')) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. TRAINER PROFILES
-- ============================================
CREATE TABLE public.trainer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Asosiy ma'lumotlar
  bio TEXT,
  experience_years INTEGER DEFAULT 0,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female')),
  
  -- Yo'nalish va ixtisoslik
  specializations TEXT[] DEFAULT '{}',  -- ['fitness', 'bodybuilding', 'yoga', 'powerlifting', 'dieta']
  
  -- Ish turi
  work_type TEXT CHECK (work_type IN ('online', 'offline', 'both')) DEFAULT 'both',
  
  -- Lokatsiya
  city TEXT,
  gym_name TEXT,
  gym_address TEXT,
  gym_photos TEXT[] DEFAULT '{}',       -- rasm URL lari
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  
  -- Reyting (avtomatik hisoblanadi)
  rating DECIMAL(2,1) DEFAULT 0.0,
  total_reviews INTEGER DEFAULT 0,
  total_students INTEGER DEFAULT 0,
  
  -- Status
  is_verified BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,   -- profil to'liq to'ldirilganmi
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. USER PROFILES (oddiy foydalanuvchilar)
-- ============================================
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female')),
  goal TEXT,               -- 'weight_loss', 'muscle_gain', 'health', 'strength'
  experience_level TEXT,   -- 'beginner', 'intermediate', 'advanced'
  interests TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. LESSONS (Darsliklar)
-- ============================================
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  price INTEGER NOT NULL DEFAULT 0,     -- so'mda (masalan 50000 = 50,000 so'm)
  
  -- Kategoriya
  category TEXT,           -- 'fitness', 'bodybuilding', 'yoga', 'diet', 'powerlifting'
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
  
  -- Kontent (bo'limlar JSON sifatida)
  content JSONB DEFAULT '[]',
  -- Format: [{ "title": "Kirish", "body": "...", "image_url": "..." }, ...]
  
  -- Statistika
  total_sales INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0.0,
  total_reviews INTEGER DEFAULT 0,
  
  -- Status
  status TEXT CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. PURCHASES (Sotib olishlar)
-- ============================================
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.profiles(id),
  
  amount INTEGER NOT NULL,              -- to'liq narx
  commission INTEGER NOT NULL,          -- platforma komissiyasi (10%)
  trainer_amount INTEGER NOT NULL,      -- trenerga tushadigan summa (90%)
  
  -- To'lov ma'lumotlari
  payment_method TEXT DEFAULT 'click',
  payment_id TEXT,                      -- Click transaction ID
  status TEXT CHECK (status IN ('pending', 'paid', 'failed', 'refunded')) DEFAULT 'pending',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bitta foydalanuvchi bitta darslikni faqat bir marta sotib oladi
ALTER TABLE public.purchases ADD CONSTRAINT unique_user_lesson UNIQUE (user_id, lesson_id);

-- ============================================
-- 6. POSTS (Trener postlari)
-- ============================================
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  caption TEXT,
  images TEXT[] DEFAULT '{}',           -- rasm URL lari (1-5 ta)
  
  -- Before/After post uchun
  is_before_after BOOLEAN DEFAULT FALSE,
  
  -- Statistika
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. POST LIKES
-- ============================================
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_post_like UNIQUE (post_id, user_id)
);

-- ============================================
-- 8. POST COMMENTS
-- ============================================
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. CONVERSATIONS (Chat suhbatlari)
-- ============================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  
  -- O'qilmagan xabarlar soni
  trainer_unread INTEGER DEFAULT 0,
  user_unread INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_conversation UNIQUE (trainer_id, user_id)
);

-- ============================================
-- 10. MESSAGES (Chat xabarlari)
-- ============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  content TEXT,
  image_url TEXT,
  
  is_read BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. REVIEWS (Sharhlar va reyting)
-- ============================================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Agar darslikka sharh bo'lsa
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_trainer_review UNIQUE (trainer_id, user_id)
);

-- ============================================
-- INDEXES (Tezkor qidirish uchun)
-- ============================================
CREATE INDEX idx_trainer_profiles_user_id ON public.trainer_profiles(user_id);
CREATE INDEX idx_trainer_profiles_specializations ON public.trainer_profiles USING GIN(specializations);
CREATE INDEX idx_trainer_profiles_city ON public.trainer_profiles(city);
CREATE INDEX idx_trainer_profiles_rating ON public.trainer_profiles(rating DESC);
CREATE INDEX idx_trainer_profiles_work_type ON public.trainer_profiles(work_type);
CREATE INDEX idx_trainer_profiles_published ON public.trainer_profiles(is_published) WHERE is_published = TRUE;

CREATE INDEX idx_lessons_trainer_id ON public.lessons(trainer_id);
CREATE INDEX idx_lessons_category ON public.lessons(category);
CREATE INDEX idx_lessons_status ON public.lessons(status) WHERE status = 'published';
CREATE INDEX idx_lessons_price ON public.lessons(price);

CREATE INDEX idx_posts_trainer_id ON public.posts(trainer_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);

CREATE INDEX idx_conversations_trainer_id ON public.conversations(trainer_id);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_last_message_at ON public.conversations(last_message_at DESC);

CREATE INDEX idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX idx_purchases_trainer_id ON public.purchases(trainer_id);

CREATE INDEX idx_reviews_trainer_id ON public.reviews(trainer_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Profil yangilanganda updated_at ni avtomatik yangilash
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggerlar
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_trainer_profiles_updated_at
  BEFORE UPDATE ON public.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trener reytingini avtomatik hisoblash
CREATE OR REPLACE FUNCTION update_trainer_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.trainer_profiles
  SET 
    rating = (SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE trainer_id = COALESCE(NEW.trainer_id, OLD.trainer_id)),
    total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE trainer_id = COALESCE(NEW.trainer_id, OLD.trainer_id))
  WHERE user_id = COALESCE(NEW.trainer_id, OLD.trainer_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trainer_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_trainer_rating();

-- Darslik reytingini avtomatik hisoblash
CREATE OR REPLACE FUNCTION update_lesson_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lesson_id IS NOT NULL THEN
    UPDATE public.lessons
    SET 
      rating = (SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE lesson_id = NEW.lesson_id),
      total_reviews = (SELECT COUNT(*) FROM public.reviews WHERE lesson_id = NEW.lesson_id)
    WHERE id = NEW.lesson_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lesson_rating
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_lesson_rating();

-- Sotuvlar sonini avtomatik yangilash
CREATE OR REPLACE FUNCTION update_lesson_sales()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    UPDATE public.lessons
    SET total_sales = total_sales + 1
    WHERE id = NEW.lesson_id;
    
    UPDATE public.trainer_profiles
    SET total_students = (
      SELECT COUNT(DISTINCT user_id) 
      FROM public.purchases 
      WHERE trainer_id = NEW.trainer_id AND status = 'paid'
    )
    WHERE user_id = NEW.trainer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lesson_sales
  AFTER INSERT OR UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION update_lesson_sales();

-- Post like/comment sonini yangilash
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_likes
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_comments
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- PROFILES: hamma ko'ra oladi, faqat o'zini o'zgartira oladi
CREATE POLICY "Profiles: public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: own update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles: own insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- TRAINER PROFILES: published bo'lganlarni hamma ko'radi
CREATE POLICY "Trainers: public read published" ON public.trainer_profiles 
  FOR SELECT USING (is_published = true OR user_id = auth.uid());
CREATE POLICY "Trainers: own update" ON public.trainer_profiles 
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Trainers: own insert" ON public.trainer_profiles 
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- USER PROFILES: faqat o'zini ko'radi/o'zgartiradi
CREATE POLICY "Users: own read" ON public.user_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users: own update" ON public.user_profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users: own insert" ON public.user_profiles FOR INSERT WITH CHECK (user_id = auth.uid());

-- LESSONS: published bo'lganlarni hamma ko'radi
CREATE POLICY "Lessons: public read published" ON public.lessons 
  FOR SELECT USING (status = 'published' OR trainer_id = auth.uid());
CREATE POLICY "Lessons: trainer insert" ON public.lessons 
  FOR INSERT WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "Lessons: trainer update" ON public.lessons 
  FOR UPDATE USING (trainer_id = auth.uid());
CREATE POLICY "Lessons: trainer delete" ON public.lessons 
  FOR DELETE USING (trainer_id = auth.uid());

-- PURCHASES: faqat o'ziga tegishli
CREATE POLICY "Purchases: own read" ON public.purchases 
  FOR SELECT USING (user_id = auth.uid() OR trainer_id = auth.uid());
CREATE POLICY "Purchases: user insert" ON public.purchases 
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- POSTS: hamma ko'radi, faqat trener yaratadi
CREATE POLICY "Posts: public read" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Posts: trainer insert" ON public.posts 
  FOR INSERT WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "Posts: trainer update" ON public.posts 
  FOR UPDATE USING (trainer_id = auth.uid());
CREATE POLICY "Posts: trainer delete" ON public.posts 
  FOR DELETE USING (trainer_id = auth.uid());

-- POST LIKES
CREATE POLICY "Likes: public read" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Likes: auth insert" ON public.post_likes 
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Likes: own delete" ON public.post_likes 
  FOR DELETE USING (user_id = auth.uid());

-- POST COMMENTS
CREATE POLICY "Comments: public read" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Comments: auth insert" ON public.post_comments 
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Comments: own delete" ON public.post_comments 
  FOR DELETE USING (user_id = auth.uid());

-- CONVERSATIONS: faqat ishtirokchilar
CREATE POLICY "Conversations: participant read" ON public.conversations 
  FOR SELECT USING (trainer_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY "Conversations: auth insert" ON public.conversations 
  FOR INSERT WITH CHECK (trainer_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY "Conversations: participant update" ON public.conversations 
  FOR UPDATE USING (trainer_id = auth.uid() OR user_id = auth.uid());

-- MESSAGES: faqat suhbat ishtirokchilari
CREATE POLICY "Messages: conversation participant read" ON public.messages 
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM public.conversations 
      WHERE trainer_id = auth.uid() OR user_id = auth.uid()
    )
  );
CREATE POLICY "Messages: sender insert" ON public.messages 
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- REVIEWS: hamma ko'radi, faqat o'zi yozadi
CREATE POLICY "Reviews: public read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Reviews: auth insert" ON public.reviews 
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Reviews: own update" ON public.reviews 
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- REALTIME (Chat uchun)
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- ============================================
-- STORAGE BUCKETS (Supabase Dashboard'da yaratiladi)
-- ============================================
-- Bucket: avatars (profil rasmlari)
-- Bucket: posts (post rasmlari)
-- Bucket: lessons (darslik cover va kontent rasmlari)
-- Bucket: gyms (zal rasmlari)
