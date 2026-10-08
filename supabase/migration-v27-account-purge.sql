-- ============================================================================
-- TRAINERTOP — migration v27: Test/mock akkaunt va kontentni XAVFSIZ o'chirish
--
-- MUHIM XAVFSIZLIK QOIDASI: bu funksiyalar "ko'r-ko'rona CASCADE" EMAS. Agar
-- o'chirilayotgan trenerning biror darsligini SHU BATCHDA YO'Q boshqa (saqlanishi
-- kerak) foydalanuvchi sotib olgan bo'lsa yoki uning darslik guruhida SHU BATCHDA
-- YO'Q boshqa a'zo bo'lsa — butun operatsiya RAD ETILADI (hech narsa o'chmaydi,
-- xato xabarida aniq kimning nimasi to'siq ekani yoziladi). Bu — boshqa (haqiqiy)
-- foydalanuvchining xarid tarixini tasodifan yo'qotib qo'yishdan himoya.
--
-- * protected_accounts — bu yerga email qo'lda qo'shilgan akkauntlar HECH QACHON,
--   hech qanday holatda o'chirilmaydi (Google Play tekshiruvchi demo akkauntlari uchun).
-- * admin_preview_account_deletion(uuid[]) — FAQAT KO'RISH: nima o'chishini va
--   qanday to'siqlar borligini qaytaradi, hech narsani o'chirmaydi.
-- * admin_delete_accounts(uuid[], admin) — HAQIQIY o'chirish, bitta tranzaksiyada
--   (SQL funksiyasining o'zi atomik). Birorta akkaunt himoyalangan yoki to'siqli
--   bo'lsa — HAMMASI bekor qilinadi (hech biri o'chmaydi).
-- * admin_preview_content_deletion / admin_delete_content — bitta post yoki
--   darslikni (akkauntni qoldirib) xuddi shunday xavfsizlik tekshiruvi bilan o'chiradi.
-- * Ikkala o'chirish funksiyasi ham, o'chirishdan OLDIN, bog'liq barcha media
--   URL'larini (avatar, post rasm/video, darslik videolari, chat media) yig'ib,
--   natijada qaytaradi — bu URL'larni R2'dan o'chirish ILOVA DARAJASIDA, SHU
--   TRANZAKSIYA MUVAFFAQIYATLI YAKUNLANGANDAN KEYIN bajariladi (R2 Postgres
--   tranzaksiyasining bir qismi bo'la olmaydi — ikkita alohida tizim).
--
-- Bog'liqlik: v12 (payouts, trainer_profiles.balance), v13 (chat_groups), v26
-- (trainer_payout_cards). Qayta ishga tushirsa xavfsiz.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.protected_accounts (
  email      text PRIMARY KEY,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.protected_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.protected_accounts FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- Ichki yordamchi: bitta profil uchun to'liq hisobot (hisoblar + to'siqlar).
-- Ham preview, ham delete shu bitta funksiyadan foydalanadi — ikkalasi hech
-- qachon bir-biridan farqli natija bermasligi uchun.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._account_deletion_report(p_profile_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE pid uuid; prof record; out jsonb := '[]'::jsonb; blockers jsonb; counts jsonb; is_protected boolean;
BEGIN
  FOREACH pid IN ARRAY p_profile_ids LOOP
    SELECT * INTO prof FROM public.profiles WHERE id = pid;
    IF NOT FOUND THEN
      out := out || jsonb_build_object('profile_id', pid, 'found', false);
      CONTINUE;
    END IF;

    is_protected := EXISTS (SELECT 1 FROM public.protected_accounts pa WHERE lower(pa.email) = lower(prof.email));

    -- To'siq 1: shu profil treneri bo'lgan darslikni SHU BATCHDA YO'Q boshqa foydalanuvchi sotib olgan
    SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object(
             'type', 'external_purchase', 'lesson_id', pu.lesson_id, 'lesson_title', l.title,
             'buyer_id', pu.user_id, 'buyer_email', bp.email)), '[]'::jsonb)
      INTO blockers
      FROM public.purchases pu
      JOIN public.lessons l ON l.id = pu.lesson_id
      JOIN public.profiles bp ON bp.id = pu.user_id
     WHERE l.trainer_id = pid AND NOT (pu.user_id = ANY(p_profile_ids));

    -- To'siq 2: shu profil treneri bo'lgan darslik guruhida SHU BATCHDA YO'Q boshqa faol a'zo
    blockers := blockers || coalesce((
      SELECT jsonb_agg(DISTINCT jsonb_build_object(
               'type', 'external_group_member', 'group_id', cg.id, 'group_name', cg.name,
               'member_id', cgm.user_id, 'member_email', mp.email))
        FROM public.chat_groups cg
        JOIN public.lessons l2 ON l2.id = cg.lesson_id
        JOIN public.chat_group_members cgm ON cgm.group_id = cg.id
        JOIN public.profiles mp ON mp.id = cgm.user_id
       WHERE l2.trainer_id = pid AND cgm.status = 'active' AND NOT (cgm.user_id = ANY(p_profile_ids))
    ), '[]'::jsonb);

    SELECT jsonb_build_object(
      'posts', (SELECT count(*) FROM public.posts WHERE trainer_id = pid),
      'lessons', (SELECT count(*) FROM public.lessons WHERE trainer_id = pid),
      'purchases_made', (SELECT count(*) FROM public.purchases WHERE user_id = pid),
      'sales_as_trainer', (SELECT count(*) FROM public.purchases WHERE trainer_id = pid),
      'messages_sent', (SELECT count(*) FROM public.messages WHERE sender_id = pid),
      'conversations', (SELECT count(*) FROM public.conversations WHERE trainer_id = pid OR user_id = pid),
      'reviews_written', (SELECT count(*) FROM public.reviews WHERE user_id = pid),
      'payout_requests', (SELECT count(*) FROM public.payouts WHERE trainer_id = pid),
      'trainer_balance', (SELECT balance FROM public.trainer_profiles WHERE user_id = pid)
    ) INTO counts;

    out := out || jsonb_build_object(
      'profile_id', pid, 'found', true, 'email', prof.email, 'full_name', prof.full_name, 'role', prof.role,
      'protected', is_protected, 'blockers', blockers, 'blocked', is_protected OR jsonb_array_length(blockers) > 0,
      'counts', counts
    );
  END LOOP;
  RETURN out;
END $$;
REVOKE ALL ON FUNCTION public._account_deletion_report(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._account_deletion_report(uuid[]) TO service_role;

-- FAQAT KO'RISH — hech narsani o'chirmaydi.
CREATE OR REPLACE FUNCTION public.admin_preview_account_deletion(p_profile_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public._account_deletion_report(p_profile_ids);
$$;
REVOKE ALL ON FUNCTION public.admin_preview_account_deletion(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_preview_account_deletion(uuid[]) TO service_role;

-- Barcha o'chirilayotganlarga tegishli media URL'larni yig'adi (o'chirishdan OLDIN chaqiriladi).
CREATE OR REPLACE FUNCTION public._collect_media_urls(p_profile_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(DISTINCT u), '[]'::jsonb) FROM (
    SELECT avatar_url AS u FROM public.profiles WHERE id = ANY(p_profile_ids) AND avatar_url IS NOT NULL
    UNION ALL SELECT unnest(images) FROM public.posts WHERE trainer_id = ANY(p_profile_ids)
    UNION ALL SELECT video_url FROM public.posts WHERE trainer_id = ANY(p_profile_ids) AND video_url IS NOT NULL
    UNION ALL SELECT video_thumbnail_url FROM public.posts WHERE trainer_id = ANY(p_profile_ids) AND video_thumbnail_url IS NOT NULL
    UNION ALL SELECT video->>'url' FROM public.lessons l, jsonb_array_elements(coalesce(l.content->'sections', '[]'::jsonb)) sec,
               jsonb_array_elements(coalesce(sec->'videos', '[]'::jsonb)) video
               WHERE l.trainer_id = ANY(p_profile_ids) AND video->>'url' IS NOT NULL
    UNION ALL SELECT media_url FROM public.messages WHERE sender_id = ANY(p_profile_ids) AND media_url IS NOT NULL
    UNION ALL SELECT image_url FROM public.messages WHERE sender_id = ANY(p_profile_ids) AND image_url IS NOT NULL
    UNION ALL SELECT gym_photo FROM public.trainer_profiles tp, unnest(coalesce(tp.gym_photos, '{}'::text[])) gym_photo WHERE tp.user_id = ANY(p_profile_ids)
  ) x WHERE u IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public._collect_media_urls(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._collect_media_urls(uuid[]) TO service_role;

-- HAQIQIY O'CHIRISH — atomik (bitta SQL funksiyasi = bitta tranzaksiya; xato
-- bo'lsa PostgreSQL BUTUN funksiyani avtomatik bekor qiladi, hech narsa o'chmaydi).
CREATE OR REPLACE FUNCTION public.admin_delete_accounts(p_profile_ids uuid[], p_admin uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE report jsonb; item jsonb; media jsonb; deleted_emails text[];
BEGIN
  IF p_profile_ids IS NULL OR array_length(p_profile_ids, 1) IS NULL THEN RAISE EXCEPTION 'EMPTY_LIST'; END IF;

  report := public._account_deletion_report(p_profile_ids);
  FOR item IN SELECT * FROM jsonb_array_elements(report) LOOP
    IF (item->>'found')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'NOT_FOUND:%', item->>'profile_id'; END IF;
    IF (item->>'protected')::boolean THEN RAISE EXCEPTION 'PROTECTED:%', item->>'email'; END IF;
    IF (item->>'blocked')::boolean THEN RAISE EXCEPTION 'BLOCKED:% %', item->>'email', (item->'blockers')::text; END IF;
  END LOOP;

  media := public._collect_media_urls(p_profile_ids);
  SELECT array_agg(email) INTO deleted_emails FROM public.profiles WHERE id = ANY(p_profile_ids);

  -- Quyidagi ustunlarda ON DELETE CASCADE YO'Q (ataylab — moliyaviy/to'lov yozuvlari tasodifan
  -- yo'qolib ketmasligi uchun himoya) — shuning uchun profilni o'chirishdan oldin aniq hal qilinadi.
  -- purchases.trainer_id ham RESTRICT (lesson_id CASCADE orqali bilvosita ketishiga tayanib
  -- bo'lmaydi — Postgres cascade tartibida trainer_id cheklovi oldinroq tekshirilishi mumkin).
  DELETE FROM public.purchases WHERE trainer_id = ANY(p_profile_ids) OR user_id = ANY(p_profile_ids);
  
DELETE FROM public.payouts WHERE trainer_id = ANY(p_profile_ids);          -- trainer_id RESTRICT
  DELETE FROM public.trainer_ledger WHERE trainer_id = ANY(p_profile_ids);   -- trainer_id RESTRICT
  UPDATE public.payouts SET completed_by = NULL WHERE completed_by = ANY(p_profile_ids);             -- admin bo'lsa
  UPDATE public.click_transactions SET user_id = NULL WHERE user_id = ANY(p_profile_ids);            -- to'lov jurnali SAQLANADI
  -- Qolgan hammasi (postlar, darsliklar, chat, sharhlar, obunalar, kartalar, ...) CASCADE orqali ketadi.
  DELETE FROM auth.users WHERE id = ANY(p_profile_ids);

  PERFORM public.log_admin_action(p_admin, 'purge_accounts', 'profile', array_to_string(p_profile_ids, ','),
    jsonb_build_object('emails', to_jsonb(deleted_emails), 'media_count', jsonb_array_length(media)));

  RETURN jsonb_build_object('deleted', p_profile_ids, 'media_urls', media);
END $$;
REVOKE ALL ON FUNCTION public.admin_delete_accounts(uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_accounts(uuid[], uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- Bitta kontent (post yoki darslik) — akkauntni qoldirib, faqat shuni o'chirish.
-- Darslikda to'langan xaridi bo'lsa (kim bo'lishidan qat'iy nazar) standart
-- holatda RAD ETILADI — xaridor pulini to'lagan narsasini yo'qotmasligi uchun.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_preview_content_deletion(p_type text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE blockers jsonb := '[]'::jsonb; found boolean;
BEGIN
  IF p_type NOT IN ('post', 'lesson') THEN RAISE EXCEPTION 'BAD_TYPE'; END IF;
  IF p_type = 'post' THEN
    SELECT EXISTS (SELECT 1 FROM public.posts WHERE id = p_id) INTO found;
    RETURN jsonb_build_object('type', p_type, 'id', p_id, 'found', found, 'blocked', false, 'blockers', '[]'::jsonb,
      'counts', jsonb_build_object('comments', (SELECT count(*) FROM public.post_comments WHERE post_id = p_id),
                                    'likes', (SELECT count(*) FROM public.post_likes WHERE post_id = p_id)));
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.lessons WHERE id = p_id) INTO found;
    SELECT coalesce(jsonb_agg(jsonb_build_object('type', 'paid_purchase', 'buyer_id', pu.user_id, 'buyer_email', bp.email)), '[]'::jsonb)
      INTO blockers
      FROM public.purchases pu JOIN public.profiles bp ON bp.id = pu.user_id
     WHERE pu.lesson_id = p_id AND pu.status = 'paid';
    RETURN jsonb_build_object('type', p_type, 'id', p_id, 'found', found, 'blocked', jsonb_array_length(blockers) > 0, 'blockers', blockers,
      'counts', jsonb_build_object('purchases', (SELECT count(*) FROM public.purchases WHERE lesson_id = p_id),
                                    'reviews', (SELECT count(*) FROM public.reviews WHERE lesson_id = p_id)));
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_preview_content_deletion(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_preview_content_deletion(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_delete_content(p_type text, p_id uuid, p_admin uuid, p_force boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE prev jsonb; media jsonb := '[]'::jsonb;
BEGIN
  prev := public.admin_preview_content_deletion(p_type, p_id);
  IF (prev->>'found')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF (prev->>'blocked')::boolean AND NOT p_force THEN RAISE EXCEPTION 'BLOCKED:%', (prev->'blockers')::text; END IF;

  IF p_type = 'post' THEN
    SELECT coalesce(jsonb_agg(DISTINCT u), '[]'::jsonb) INTO media FROM (
      SELECT unnest(images) AS u FROM public.posts WHERE id = p_id
      UNION ALL SELECT video_url FROM public.posts WHERE id = p_id AND video_url IS NOT NULL
      UNION ALL SELECT video_thumbnail_url FROM public.posts WHERE id = p_id AND video_thumbnail_url IS NOT NULL
    ) x WHERE u IS NOT NULL;
    DELETE FROM public.posts WHERE id = p_id;
  ELSE
    SELECT coalesce(jsonb_agg(DISTINCT video->>'url'), '[]'::jsonb) INTO media
      FROM public.lessons l, jsonb_array_elements(coalesce(l.content->'sections', '[]'::jsonb)) sec,
           jsonb_array_elements(coalesce(sec->'videos', '[]'::jsonb)) video
     WHERE l.id = p_id AND video->>'url' IS NOT NULL;
    IF p_force THEN DELETE FROM public.purchases WHERE lesson_id = p_id; END IF;
    DELETE FROM public.lessons WHERE id = p_id;
  END IF;

  PERFORM public.log_admin_action(p_admin, 'purge_content', p_type, p_id::text, jsonb_build_object('forced', p_force, 'media_count', jsonb_array_length(media)));
  RETURN jsonb_build_object('deleted', p_id, 'media_urls', media);
END $$;
REVOKE ALL ON FUNCTION public.admin_delete_content(text, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_content(text, uuid, uuid, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v27: account/content purge' AS tekshiruv,
       CASE WHEN to_regclass('public.protected_accounts') IS NOT NULL
             AND to_regprocedure('public.admin_preview_account_deletion(uuid[])') IS NOT NULL
             AND to_regprocedure('public.admin_delete_accounts(uuid[],uuid)') IS NOT NULL
             AND to_regprocedure('public.admin_delete_content(text,uuid,uuid,boolean)') IS NOT NULL
        THEN 'OK' ELSE 'XATO' END AS natija;
