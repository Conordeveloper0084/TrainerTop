-- ============================================================================
-- TRAINERTOP — R2 media URL'larini bir domendan boshqasiga KO'CHIRISH
--   masalan  https://pub-xxxx.r2.dev  →  https://cdn.trainertop.uz
--
-- NIMA UCHUN: rasm/video URL'lari bazada TO'LIQ manzil bilan saqlanadi. R2'ga custom domen ulangach,
-- eski yozuvlar hamon sekin/cheklangan `r2.dev` dan beriladi — ularni yangi domenga o'tkazish shart.
--
-- QANDAY ISHLATISH (Supabase → SQL Editor):
--   1) Pastdagi 4 ta parametrni to'ldiring (old_base, new_base, apply, only_tables).
--   2) apply = false  (standart) → HECH NARSA O'ZGARMAYDI, faqat nechta qator o'zgarishi ko'rsatiladi.
--   3) Natijani ko'rib, apply = true qilib qayta ishga tushiring.
--   4) Qaytarish kerak bo'lsa — old_base va new_base ni almashtirib yana ishga tushiring (idempotent, ikki tomonlama).
--
-- XAVFSIZLIK:
--   • Faqat `<old_base>/` bilan BOSHLANADIGAN qiymatlar o'zgaradi (boshqa domenlar, tashqi havolalar, o'xshash
--     prefikslar `https://pub-xxxx.r2.dev.evil.com/...` tegilmaydi).
--   • Butun skript BITTA tranzaksiya (DO bloki): birorta xato bo'lsa HAMMASI bekor bo'ladi.
--   • Qayta ishga tushirsa xavfsiz (ikkinchi marta 0 qator).
--   • Production'da bo'lmagan jadval/ustun jimgina o'tkazib yuboriladi (hisobotda ko'rinadi).
--   • Katta jadvallar (messages) uchun avval `only_tables` bilan bittadan bajaring; `messages` yangilanishi
--     Realtime'ga UPDATE hodisalari yuboradi — kam trafikli vaqtda bajaring.
--   • TAVSIYA: apply=true dan oldin Supabase backup oling (docs/account-purge.md dagi usul).
--   • `lessons.updated_at` / `profiles.updated_at` kabi trigger bilan yangilanadigan ustunlar o'zgaradi (zararsiz).
--   • Hisobga OLINMAYDI (tarixiy surat/jurnal, qo'lda ko'rib chiqing): reports.snapshot, chat_reports.snapshot,
--     notifications.data, admin_audit_log.details, chat_group_analyses.result.
-- ============================================================================

DROP TABLE IF EXISTS _media_url_report;
CREATE TEMP TABLE _media_url_report (jadval text, ustun text, qatorlar bigint, holat text);

DO $rewrite$
DECLARE
  -- ===================== PARAMETRLAR (faqat shu 4 qatorni tahrirlang) =====================
  old_base    text    := 'https://pub-XXXXXXXXXXXX.r2.dev';   -- hozir bazada turgan bazaviy URL (oxirida "/" YO'Q)
  new_base    text    := 'https://cdn.trainertop.uz';         -- yangi bazaviy URL (oxirida "/" YO'Q)
  apply       boolean := false;                               -- false = faqat ko'rish, true = haqiqiy o'zgartirish
  only_tables text[]  := NULL;                                -- masalan ARRAY['profiles','lessons']; NULL = hammasi
  -- ========================================================================================
  op text; np text; n bigint; t record; col_ok boolean; cond text;
BEGIN
  IF old_base !~ '^https://[^/]+(/[^/]+)*$' OR new_base !~ '^https://[^/]+(/[^/]+)*$' THEN
    RAISE EXCEPTION 'old_base/new_base "https://" bilan boshlanib, oxirida "/" bo''lmasligi kerak (hozir: %, %)', old_base, new_base;
  END IF;
  IF old_base = new_base THEN RAISE EXCEPTION 'old_base va new_base bir xil'; END IF;
  IF old_base LIKE '%XXXX%' THEN RAISE EXCEPTION 'old_base ni haqiqiy qiymatga almashtiring (hozir namuna: %)', old_base; END IF;
  op := old_base || '/'; np := new_base || '/';

  FOR t IN
    SELECT * FROM (VALUES
      ('announcements',    'image_url',           'text'),
      ('announcements',    'video_thumbnail_url', 'text'),
      ('announcements',    'video_url',           'text'),
      ('announcements',    'link_url',            'text'),
      ('channel_settings', 'avatar_url',          'text'),
      ('chat_groups',      'avatar_url',          'text'),
      ('lessons',          'cover_image_url',     'text'),
      ('lessons',          'content',             'jsonb'),
      ('messages',         'image_url',           'text'),
      ('messages',         'media_url',           'text'),
      ('messages',         'thumb_url',           'text'),
      ('posts',            'images',              'text[]'),
      ('posts',            'video_thumbnail_url', 'text'),
      ('posts',            'video_url',           'text'),
      ('profiles',         'avatar_url',          'text'),
      ('trainer_profiles', 'gym_photos',          'text[]')
    ) AS v(tbl, col, kind)
  LOOP
    IF only_tables IS NOT NULL AND NOT (t.tbl = ANY (only_tables)) THEN CONTINUE; END IF;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.tbl AND column_name = t.col)
      INTO col_ok;
    IF NOT col_ok THEN
      INSERT INTO _media_url_report VALUES (t.tbl, t.col, 0, 'YO''Q (o''tkazib yuborildi)');
      CONTINUE;
    END IF;

    IF t.kind = 'text' THEN
      cond := format('left(%I, length(%L)) = %L', t.col, op, op);
    ELSIF t.kind = 'text[]' THEN
      cond := format('EXISTS (SELECT 1 FROM unnest(%I) AS e WHERE left(e, length(%L)) = %L)', t.col, op, op);
    ELSE  -- jsonb: JSON matnida "/" belgisi ekranlanmaydi, shuning uchun matn bo'yicha almashtirish xavfsiz
      cond := format('position(%L in %I::text) > 0', op, t.col);
    END IF;

    IF apply THEN
      IF t.kind = 'text' THEN
        EXECUTE format('UPDATE public.%I SET %I = %L || substr(%I, length(%L) + 1) WHERE %s', t.tbl, t.col, np, t.col, op, cond);
      ELSIF t.kind = 'text[]' THEN
        EXECUTE format('UPDATE public.%I SET %I = ARRAY(SELECT CASE WHEN left(e, length(%L)) = %L THEN %L || substr(e, length(%L) + 1) ELSE e END FROM unnest(%I) WITH ORDINALITY AS u(e, ord) ORDER BY ord) WHERE %s',
                       t.tbl, t.col, op, op, np, op, t.col, cond);
      ELSE
        EXECUTE format('UPDATE public.%I SET %I = replace(%I::text, %L, %L)::jsonb WHERE %s', t.tbl, t.col, t.col, op, np, cond);
      END IF;
      GET DIAGNOSTICS n = ROW_COUNT;
      INSERT INTO _media_url_report VALUES (t.tbl, t.col, n, 'O''ZGARTIRILDI');
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %s', t.tbl, cond) INTO n;
      INSERT INTO _media_url_report VALUES (t.tbl, t.col, n, 'KO''RISH (o''zgarmadi)');
    END IF;
  END LOOP;
END
$rewrite$;

-- Hisobot: har bir jadval/ustun bo'yicha nechta qator (o'zgargan yoki o'zgaradigan); oxirgi qator — JAMI
SELECT jadval, ustun, qatorlar, holat FROM (
  SELECT jadval, ustun, qatorlar, holat, 0 AS tartib FROM _media_url_report
  UNION ALL
  SELECT 'JAMI', '', COALESCE(sum(qatorlar), 0), '', 1 FROM _media_url_report
) r ORDER BY tartib, jadval, ustun;
