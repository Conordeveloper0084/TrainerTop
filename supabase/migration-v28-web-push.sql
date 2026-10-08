-- ============================================================================
-- TRAINERTOP — migration v28: Web Push (VAPID) qo'llab-quvvatlash — iOS Safari standalone
-- PWA va boshqa Web Push brauzerlar uchun. device_tokens jadvalining o'ziga qo'shiladi
-- (yangi jadval shart emas) — platform='web' bo'lganda token ustuni Push subscription'ning
-- "endpoint" manzilini saqlaydi (noyob, UNIQUE constraint shu bilan ishlayveradi), yangi
-- web_push_keys ustuni esa {p256dh, auth} shifrlash kalitlarini saqlaydi.
-- Bog'liqlik: v25 (device_tokens). Qayta ishga tushirsa xavfsiz.
-- ============================================================================

ALTER TABLE public.device_tokens ADD COLUMN IF NOT EXISTS web_push_keys jsonb;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v28: web_push_keys' AS tekshiruv,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='device_tokens' AND column_name='web_push_keys')
        THEN 'OK' ELSE 'XATO' END AS natija;
