-- =============================================
-- TRAINERTOP MIGRATION v4
-- Video va katta fayllar uchun
-- =============================================

-- lessons bucket uchun fayl hajmini oshirish
-- Supabase free: 50MB per file, Pro: 5GB per file
-- Bu SQL faqat bucket yaratadi, hajm Supabase Dashboard dan o'zgartiriladi

INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('lessons', 'lessons', true, 52428800) -- 50MB
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800;

INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('posts', 'posts', true, 10485760) -- 10MB
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('avatars', 'avatars', true, 5242880) -- 5MB
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

INSERT INTO storage.buckets (id, name, public, file_size_limit) 
VALUES ('gyms', 'gyms', true, 10485760) -- 10MB
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

-- Storage policies yangilash
DROP POLICY IF EXISTS "s_select" ON storage.objects;
CREATE POLICY "s_select" ON storage.objects FOR SELECT USING (true);

DROP POLICY IF EXISTS "s_insert" ON storage.objects;
CREATE POLICY "s_insert" ON storage.objects FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "s_update" ON storage.objects;
CREATE POLICY "s_update" ON storage.objects FOR UPDATE USING (true);

DROP POLICY IF EXISTS "s_delete" ON storage.objects;
CREATE POLICY "s_delete" ON storage.objects FOR DELETE USING (true);
