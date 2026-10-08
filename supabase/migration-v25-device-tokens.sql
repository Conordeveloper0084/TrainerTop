-- ============================================================================
-- TRAINERTOP — migration v25: FCM push (Android ilova) uchun qurilma tokenlari
--   * device_tokens: har bir foydalanuvchining FCM registratsiya tokenlari (token — UNIQUE).
--     Faqat service_role kiradi (brauzer/anon yopiq) — hamma yozish/o'qish /api/devices va
--     sendPush orqali serverdan.
--   * Foydalanuvchi (profil) o'chirilsa tokenlari ham CASCADE bilan o'chadi. O'z-o'zidan
--     akkaunt o'chirilganda (anonimlashtirish) DELETE /api/account tokenlarni aniq o'chiradi.
--   * chat_group_members.last_push_at + push_group_recipients(): guruh xabari uchun push
--     oluvchilarni tanlaydi va "guruh+foydalanuvchiga daqiqasiga bittadan" chegarasini ATOMIK
--     (bitta UPDATE ... RETURNING) qo'llaydi — bir nechta serverless nusxa parallel ishlasa ham
--     bir odamga daqiqada ikkinchi push ketmaydi.
--   * Bog'liqlik: v13 (chat guruhlari) va v15 (muted_until). Qayta ishga tushirsa xavfsiz.
-- DEPLOY: AVVAL shu SQL, KEYIN kod (push).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token        text NOT NULL UNIQUE,
  platform     text NOT NULL DEFAULT 'android',
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON public.device_tokens (user_id);
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.device_tokens FROM anon, authenticated;

ALTER TABLE public.chat_group_members ADD COLUMN IF NOT EXISTS last_push_at timestamptz;

-- Guruh xabari kelganda push olishi kerak bo'lganlar (yuboruvchidan tashqari):
--   * a'zolik faol (status='active'), guruh arxivlanmagan, darslik olib tashlanmagan;
--   * trener (role='owner') yoki to'langan va muddati tugamagan xaridor;
--   * yozishi cheklanmagan (muted_until yo'q yoki o'tib ketgan);
--   * oxirgi push p_throttle_seconds dan oldin bo'lgan (birinchi push — hech qachon yuborilmagan).
-- Tanlangan a'zolarning last_push_at'i shu zahoti yangilanadi (atomik). Banlangan/bloklangan
-- foydalanuvchilarni serverdagi sendPush() alohida chiqarib tashlaydi.
CREATE OR REPLACE FUNCTION public.push_group_recipients(p_group uuid, p_sender uuid, p_throttle_seconds integer DEFAULT 60)
RETURNS SETOF uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
  WITH upd AS (
    UPDATE public.chat_group_members m
       SET last_push_at = now()
      FROM public.chat_groups g
      JOIN public.lessons l ON l.id = g.lesson_id
     WHERE g.id = p_group AND m.group_id = g.id
       AND NOT g.is_archived AND l.status <> 'removed'
       AND m.status = 'active'
       AND m.user_id <> p_sender
       AND (m.muted_until IS NULL OR m.muted_until <= now())
       AND (
         m.role = 'owner'
         OR EXISTS (
           SELECT 1 FROM public.purchases pu
            WHERE pu.user_id = m.user_id AND pu.lesson_id = g.lesson_id AND pu.status = 'paid'
              AND NOT (pu.purchase_type = 'monthly' AND pu.expires_at IS NOT NULL AND pu.expires_at <= now())
         )
       )
       AND (m.last_push_at IS NULL OR m.last_push_at <= now() - make_interval(secs => greatest(p_throttle_seconds, 0)))
    RETURNING m.user_id AS uid
  )
  SELECT uid FROM upd;
END $$;

REVOKE ALL ON FUNCTION public.push_group_recipients(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_group_recipients(uuid, uuid, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v25: device_tokens + push_group_recipients' AS tekshiruv,
       CASE WHEN to_regclass('public.device_tokens') IS NOT NULL
             AND to_regprocedure('public.push_group_recipients(uuid,uuid,integer)') IS NOT NULL
             AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_group_members' AND column_name='last_push_at')
        THEN 'OK' ELSE 'XATO' END AS natija;
