-- ============================================================================
-- TRAINERTOP — migration v22: Audit tuzatishlari
--   * platform_review_featured(): banlangan foydalanuvchining sharhi (ism+rasm)
--     bosh sahifada ko'rsatilib qolmasligi kerak — ban ANIQ tekshiriladi.
--   * Mustaqil migratsiya — faqat v12 (is_user_banned) va v18 (platform_reviews) kerak,
--     ikkalasi ham allaqachon production'da.
-- Qayta ishga tushirsa xavfsiz.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.platform_review_featured(p_limit integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(x.item ORDER BY x.updated_at DESC), '[]'::jsonb) FROM (
    SELECT r.updated_at, jsonb_build_object(
      'name', CASE WHEN nm = '' THEN 'Foydalanuvchi'
                   WHEN position(' ' in nm) > 0 THEN split_part(nm, ' ', 1) || ' ' || upper(left(split_part(nm, ' ', 2), 1)) || '.'
                   ELSE nm END,
      'avatar_url', p.avatar_url, 'rating', r.rating, 'comment', r.comment, 'created_at', r.created_at) AS item
      FROM public.platform_reviews r JOIN public.profiles p ON p.id = r.user_id
      CROSS JOIN LATERAL (SELECT regexp_replace(btrim(p.full_name), '\s+', ' ', 'g') AS nm) n
     WHERE r.featured AND NOT r.hidden AND r.comment IS NOT NULL AND NOT public.is_user_banned(r.user_id)
     ORDER BY r.updated_at DESC LIMIT greatest(1, least(coalesce(p_limit, 6), 20))
  ) x
$$;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'platform_review_featured yangilandi' AS tekshiruv,
       CASE WHEN pg_get_functiondef('public.platform_review_featured(integer)'::regprocedure) LIKE '%is_user_banned%'
        THEN 'OK' ELSE 'XATO' END AS natija;
