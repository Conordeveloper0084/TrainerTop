-- ============================================================================
-- TRAINERTOP — migration v14b: maxfiy ustunlarni brauzerdan YOPISH (2-qism)
--
-- !!! BU QISMNI FAQAT KOD DEPLOY QILINGANDAN KEYIN (va sayt ishlayotganini tekshirgach) ISHGA TUSHIRING !!!
-- Sabab: eski kod profillarni select("*") bilan o'qiydi — bu qism ishga tushgach u xato beradi.
-- Yangi kod esa o'z ma'lumotlarini get_my_profile() orqali oladi va bu qism bilan ishlayveradi.
--
-- Nima yopiladi (anon va authenticated uchun; service_role — ya'ni server API'lari — o'zgarmaydi):
--   profiles.email, profiles.phone                       — hamma foydalanuvchining pochta/telefoni
--   trainer_profiles.balance/total_earned/commission_rate — trenerlarning pul ma'lumotlari
--   lessons.content                                       — PULLIK darslik kontenti (videolar, matnlar)
--
-- MUHIM: bu jadvallarga KELAJAKDA yangi ustun qo'shsangiz, uni brauzerga ko'rsatish kerak bo'lsa
-- alohida GRANT SELECT (yangi_ustun) ON public.<jadval> TO anon, authenticated; qiling.
-- (Aks holda yangi ustun avtomatik YOPIQ bo'ladi — bu ataylab, xavfsiz standart.)
--
-- ORQAGA QAYTARISH (agar nimadir buzilsa, darhol):
--   GRANT SELECT ON public.profiles, public.trainer_profiles, public.lessons TO anon, authenticated;
--
-- Qayta ishga tushirsa xavfsiz (idempotent).
-- ============================================================================
DO $$
DECLARE t record; cols text;
BEGIN
  FOR t IN SELECT * FROM (VALUES
      ('profiles',         ARRAY['email', 'phone']),
      ('trainer_profiles', ARRAY['balance', 'total_earned', 'commission_rate']),
      ('lessons',          ARRAY['content'])
  ) AS v(tbl, hidden) LOOP
    IF to_regclass('public.' || t.tbl) IS NULL THEN CONTINUE; END IF;
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = t.tbl AND NOT (column_name = ANY (t.hidden));
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', t.tbl);   -- ustun huquqlarini ham tozalaydi
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon, authenticated', cols, t.tbl);
  END LOOP;
END $$;

-- TEKSHIRUV: hammasi "yopiq (OK)" bo'lishi kerak
SELECT 'profiles.email — anon o''qiy olmaydi' AS tekshiruv,
       CASE WHEN NOT has_column_privilege('anon', 'public.profiles', 'email', 'SELECT') THEN 'yopiq (OK)' ELSE 'OCHIQ (XATO)' END AS natija
UNION ALL SELECT 'profiles.phone — authenticated o''qiy olmaydi',
       CASE WHEN NOT has_column_privilege('authenticated', 'public.profiles', 'phone', 'SELECT') THEN 'yopiq (OK)' ELSE 'OCHIQ (XATO)' END
UNION ALL SELECT 'trainer_profiles.balance — anon o''qiy olmaydi',
       CASE WHEN NOT has_column_privilege('anon', 'public.trainer_profiles', 'balance', 'SELECT') THEN 'yopiq (OK)' ELSE 'OCHIQ (XATO)' END
UNION ALL SELECT 'lessons.content — anon o''qiy olmaydi',
       CASE WHEN NOT has_column_privilege('anon', 'public.lessons', 'content', 'SELECT') THEN 'yopiq (OK)' ELSE 'OCHIQ (XATO)' END
UNION ALL SELECT 'ochiq qolishi kerak: profiles.full_name (ism ko''rinishi uchun)',
       CASE WHEN has_column_privilege('anon', 'public.profiles', 'full_name', 'SELECT') THEN 'ochiq (OK)' ELSE 'YOPIQ (XATO)' END
UNION ALL SELECT 'ochiq qolishi kerak: lessons.title',
       CASE WHEN has_column_privilege('anon', 'public.lessons', 'title', 'SELECT') THEN 'ochiq (OK)' ELSE 'YOPIQ (XATO)' END;
