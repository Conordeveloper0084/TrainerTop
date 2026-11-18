-- ============================================================================
-- TRAINERTOP — migration v36: KUNDALIK (mashg'ulot jurnali, PR statistikasi)
--   * exercises        — mashqlar: platforma katalogi (owner_id NULL, slug bor) + foydalanuvchining o'z mashqlari
--   * workout_splits   — split kunlari (Push day, Leg day, Upper ...)
--   * split_exercises  — split ichidagi mashqlar tartibi
--   * workout_sessions — har zalga borish = BITTA yangi yozuv (eski natijalar hech qachon ustidan yozilmaydi)
--   * workout_sets     — padxodlar: og'irlik (kg) × takror
--   PR va statistika SAQLANMAYDI — har safar workout_sets'dan hisoblanadi (hech qachon eskirib qolmaydi).
--   Kirish faqat server orqali (service role), anon/authenticated'ga ruxsat yo'q — v24 kabi.
--   Mashg'ulot id'sini KLIENT yaratadi (uuid) — internet uzilib qayta yuborilsa ham ikki marta saqlanmaydi.
-- Qayta ishga tushirsa xavfsiz. Faqat asosiy sxemaga (profiles) bog'liq.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.exercises (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE,
  owner_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  name_uz       text CHECK (name_uz IS NULL OR char_length(name_uz) <= 80),
  aliases       text,
  muscle_group  text NOT NULL CHECK (muscle_group IN ('chest','back','shoulders','biceps','triceps','legs','glutes','core')),
  equipment     text NOT NULL DEFAULT 'other' CHECK (equipment IN ('barbell','dumbbell','machine','cable','bodyweight','other')),
  is_bodyweight boolean NOT NULL DEFAULT false,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercises_catalog_or_owner CHECK ((owner_id IS NULL) = (slug IS NOT NULL))
);
-- Bir foydalanuvchida bir xil nomli ikkita faol mashq bo'lmasin ("Bench press" va "bench press ")
CREATE UNIQUE INDEX IF NOT EXISTS exercises_owner_name_uq ON public.exercises (owner_id, lower(btrim(name))) WHERE owner_id IS NOT NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS exercises_owner_idx ON public.exercises (owner_id) WHERE owner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.workout_splits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS workout_splits_name_uq ON public.workout_splits (user_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS workout_splits_user_idx ON public.workout_splits (user_id, position, created_at);

CREATE TABLE IF NOT EXISTS public.split_exercises (
  split_id    uuid NOT NULL REFERENCES public.workout_splits(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (split_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id           uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  split_id     uuid REFERENCES public.workout_splits(id) ON DELETE SET NULL,   -- split o'chirilsa ham tarix qoladi
  title        text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),  -- split nomining o'sha kundagi nusxasi
  performed_on date NOT NULL,                                                  -- foydalanuvchining mahalliy sanasi
  duration_sec integer CHECK (duration_sec IS NULL OR duration_sec BETWEEN 0 AND 86400),
  note         text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workout_sessions_user_date_idx ON public.workout_sessions (user_id, performed_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS workout_sessions_split_idx ON public.workout_sessions (split_id) WHERE split_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.workout_sets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id    uuid NOT NULL REFERENCES public.exercises(id),   -- ishlatilgan mashq o'chirilmaydi, arxivlanadi
  exercise_order smallint NOT NULL DEFAULT 0,
  set_order      smallint NOT NULL DEFAULT 0,
  weight_kg      numeric(6,2) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0 AND weight_kg <= 1000),
  reps           smallint NOT NULL CHECK (reps BETWEEN 1 AND 1000)
);
CREATE INDEX IF NOT EXISTS workout_sets_session_idx ON public.workout_sets (session_id, exercise_order, set_order);
CREATE INDEX IF NOT EXISTS workout_sets_user_ex_idx ON public.workout_sets (user_id, exercise_id);
CREATE INDEX IF NOT EXISTS workout_sets_exercise_idx ON public.workout_sets (exercise_id);

ALTER TABLE public.exercises        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_splits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_exercises  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets     ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exercises, public.workout_splits, public.split_exercises, public.workout_sessions, public.workout_sets FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- FUNKSIYALAR. Hammasi faqat service_role uchun (API orqali). p_user — har doim joriy foydalanuvchi:
-- har funksiya faqat SHU foydalanuvchining ma'lumotini ko'radi/o'zgartiradi.
-- JSON maydon nomlari — API javobi bilan bir xil (website, Android, iOS shu formatni o'qiydi).
-- Xatolar (RAISE): WORKOUT_SESSION_FORBIDDEN, WORKOUT_EXERCISE_NOT_FOUND, WORKOUT_SPLIT_NOT_FOUND, WORKOUT_SPLIT_LIMIT
-- ---------------------------------------------------------------------------

-- Mashq JSON ko'rinishi (hamma joyda bir xil)
CREATE OR REPLACE FUNCTION public.workout_exercise_json(e public.exercises)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('id', e.id, 'slug', e.slug, 'name', e.name, 'name_uz', e.name_uz, 'muscle_group', e.muscle_group,
    'equipment', e.equipment, 'is_bodyweight', e.is_bodyweight, 'is_custom', e.owner_id IS NOT NULL, 'archived', e.archived_at IS NOT NULL);
$$;

-- Mashg'ulotni ATOMAR saqlash (yaratish yoki tahrirlash). Padxodlar to'liq almashtiriladi.
-- p_sets: [{ exercise_id, exercise_order, set_order, weight_kg, reps }]. Qaytadi: true — yangi yaratildi, false — yangilandi
DROP FUNCTION IF EXISTS public.workout_save_session(uuid, uuid, uuid, text, date, integer, text, jsonb);
CREATE OR REPLACE FUNCTION public.workout_save_session(
  p_user uuid, p_id uuid, p_split uuid, p_title text, p_date date, p_duration integer, p_note text, p_sets jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer;
  existed boolean;
BEGIN
  IF p_split IS NOT NULL AND NOT EXISTS (SELECT 1 FROM workout_splits WHERE id = p_split AND user_id = p_user) THEN
    p_split := NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(p_sets, '[]'::jsonb)) s
    LEFT JOIN exercises e ON e.id = (s->>'exercise_id')::uuid
    WHERE e.id IS NULL OR (e.owner_id IS NOT NULL AND e.owner_id <> p_user)
  ) THEN
    RAISE EXCEPTION 'WORKOUT_EXERCISE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  existed := EXISTS (SELECT 1 FROM workout_sessions WHERE id = p_id);
  INSERT INTO workout_sessions AS ws (id, user_id, split_id, title, performed_on, duration_sec, note)
  VALUES (p_id, p_user, p_split, btrim(p_title), p_date, p_duration, NULLIF(btrim(COALESCE(p_note, '')), ''))
  ON CONFLICT (id) DO UPDATE
    SET split_id = EXCLUDED.split_id, title = EXCLUDED.title, performed_on = EXCLUDED.performed_on,
        duration_sec = EXCLUDED.duration_sec, note = EXCLUDED.note, updated_at = now()
    WHERE ws.user_id = EXCLUDED.user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'WORKOUT_SESSION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  DELETE FROM workout_sets WHERE session_id = p_id;
  INSERT INTO workout_sets (session_id, user_id, exercise_id, exercise_order, set_order, weight_kg, reps)
  SELECT p_id, p_user, (s->>'exercise_id')::uuid, (s->>'exercise_order')::smallint, (s->>'set_order')::smallint,
         (s->>'weight_kg')::numeric, (s->>'reps')::smallint
  FROM jsonb_array_elements(COALESCE(p_sets, '[]'::jsonb)) s;
  RETURN NOT existed;
END $$;

-- Har mashq bo'yicha ENG OXIRGI mashg'ulotdagi padxodlar ("Oldingi: 100kg × 12·10·7").
-- p_exclude — tahrirlanayotgan mashg'ulot; p_before — shu sanagacha (shu kun ham) bo'lganlar (eski mashg'ulotni tahrirlaganda keyingilar hisobga olinmaydi)
DROP FUNCTION IF EXISTS public.workout_last_sets(uuid, uuid[], uuid);
CREATE OR REPLACE FUNCTION public.workout_last_sets(p_user uuid, p_exercises uuid[], p_exclude uuid DEFAULT NULL, p_before date DEFAULT NULL)
RETURNS TABLE (exercise_id uuid, session_id uuid, performed_on date, set_order smallint, weight_kg numeric, reps smallint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH last AS (
    SELECT DISTINCT ON (w.exercise_id) w.exercise_id, s.id AS session_id, s.performed_on
    FROM workout_sets w JOIN workout_sessions s ON s.id = w.session_id
    WHERE w.user_id = p_user AND w.exercise_id = ANY(p_exercises) AND (p_exclude IS NULL OR s.id <> p_exclude)
      AND (p_before IS NULL OR s.performed_on <= p_before)
    ORDER BY w.exercise_id, s.performed_on DESC, s.created_at DESC
  )
  SELECT l.exercise_id, l.session_id, l.performed_on, w.set_order, w.weight_kg, w.reps
  FROM last l JOIN workout_sets w ON w.session_id = l.session_id AND w.exercise_id = l.exercise_id
  ORDER BY l.exercise_id, w.set_order;
$$;

-- Har mashq bo'yicha eng yaxshi natijalar (PR'ni aniqlash uchun) — p_before sanasigacha. e1RM — Epley: kg × (1 + takror/30)
DROP FUNCTION IF EXISTS public.workout_exercise_bests(uuid, uuid[], uuid);
CREATE OR REPLACE FUNCTION public.workout_exercise_bests(p_user uuid, p_exercises uuid[], p_exclude uuid DEFAULT NULL, p_before date DEFAULT NULL)
RETURNS TABLE (exercise_id uuid, max_weight numeric, max_e1rm numeric, max_reps integer, sessions_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.exercise_id, max(w.weight_kg), round(max(w.weight_kg * (1 + w.reps / 30.0)), 2), max(w.reps)::integer, count(DISTINCT w.session_id)
  FROM workout_sets w JOIN workout_sessions s ON s.id = w.session_id
  WHERE w.user_id = p_user AND w.exercise_id = ANY(p_exercises) AND (p_exclude IS NULL OR w.session_id <> p_exclude)
    AND (p_before IS NULL OR s.performed_on <= p_before)
  GROUP BY w.exercise_id;
$$;

-- Mashg'ulotlar ro'yxati (qisqa): eng yangisi birinchi
DROP FUNCTION IF EXISTS public.workout_exercise_summary(uuid);
CREATE OR REPLACE FUNCTION public.workout_session_list(p_user uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(x.j ORDER BY x.performed_on DESC, x.created_at DESC), '[]'::jsonb) FROM (
    SELECT s.performed_on, s.created_at, jsonb_build_object(
      'id', s.id, 'split_id', s.split_id, 'title', s.title, 'performed_on', s.performed_on, 'duration_sec', s.duration_sec, 'note', s.note,
      'exercises_count', (SELECT count(DISTINCT w.exercise_id) FROM workout_sets w WHERE w.session_id = s.id),
      'sets_count', (SELECT count(*) FROM workout_sets w WHERE w.session_id = s.id),
      'volume_kg', (SELECT COALESCE(sum(w.weight_kg * w.reps), 0) FROM workout_sets w WHERE w.session_id = s.id),
      'exercise_names', COALESCE((SELECT jsonb_agg(q.name ORDER BY q.o) FROM (
          SELECT e.name, min(w.exercise_order) AS o FROM workout_sets w JOIN exercises e ON e.id = w.exercise_id
          WHERE w.session_id = s.id GROUP BY e.id, e.name) q), '[]'::jsonb)
    ) AS j
    FROM workout_sessions s WHERE s.user_id = p_user
    ORDER BY s.performed_on DESC, s.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100) OFFSET GREATEST(p_offset, 0)
  ) x;
$$;

-- Bitta mashg'ulot to'liq: mashqlar tartibida, har birida padxodlar. Begona yoki yo'q bo'lsa — NULL
CREATE OR REPLACE FUNCTION public.workout_session_detail(p_user uuid, p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'split_id', s.split_id, 'title', s.title, 'performed_on', s.performed_on, 'duration_sec', s.duration_sec,
    'note', s.note, 'created_at', s.created_at, 'updated_at', s.updated_at,
    'volume_kg', (SELECT COALESCE(sum(w.weight_kg * w.reps), 0) FROM workout_sets w WHERE w.session_id = s.id),
    'sets_count', (SELECT count(*) FROM workout_sets w WHERE w.session_id = s.id),
    'exercises', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('exercise', workout_exercise_json(e), 'sets', g.sets) ORDER BY g.o)
      FROM (
        SELECT w.exercise_id, min(w.exercise_order) AS o,
               jsonb_agg(jsonb_build_object('weight_kg', w.weight_kg, 'reps', w.reps) ORDER BY w.set_order) AS sets
        FROM workout_sets w WHERE w.session_id = s.id GROUP BY w.exercise_id
      ) g JOIN exercises e ON e.id = g.exercise_id), '[]'::jsonb)
  )
  FROM workout_sessions s WHERE s.id = p_id AND s.user_id = p_user;
$$;

-- Split JSON ko'rinishi: mashqlari tartibda, oxirgi bajarilgan sana va necha marta bajarilgani
CREATE OR REPLACE FUNCTION public.workout_split_json(sp public.workout_splits)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', sp.id, 'name', sp.name, 'position', sp.position, 'created_at', sp.created_at,
    'exercises', COALESCE((SELECT jsonb_agg(workout_exercise_json(e) ORDER BY se.position) FROM split_exercises se JOIN exercises e ON e.id = se.exercise_id WHERE se.split_id = sp.id), '[]'::jsonb),
    'last_performed_on', (SELECT max(s.performed_on) FROM workout_sessions s WHERE s.split_id = sp.id),
    'sessions_count', (SELECT count(*) FROM workout_sessions s WHERE s.split_id = sp.id));
$$;

-- Bitta split (faqat egasiga). Topilmasa — NULL
CREATE OR REPLACE FUNCTION public.workout_split_get(p_user uuid, p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workout_split_json(sp) FROM workout_splits sp WHERE sp.id = p_id AND sp.user_id = p_user;
$$;

-- Bosh sahifa ("Kundalik"): splitlar (mashqlari bilan), so'nggi 5 mashg'ulot, 2 haftalik statistika, faol haftalar (streak uchun)
CREATE OR REPLACE FUNCTION public.workout_overview(p_user uuid, p_today date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH wk AS (SELECT date_trunc('week', p_today)::date AS cur, (date_trunc('week', p_today) - interval '7 days')::date AS prev),
  ses AS (
    SELECT s.id, s.performed_on, (SELECT COALESCE(sum(w.weight_kg * w.reps), 0) FROM workout_sets w WHERE w.session_id = s.id) AS vol
    FROM workout_sessions s, wk WHERE s.user_id = p_user AND s.performed_on >= wk.prev AND s.performed_on < wk.cur + 7
  )
  SELECT jsonb_build_object(
    'splits', COALESCE((SELECT jsonb_agg(workout_split_json(sp) ORDER BY sp.position, sp.created_at)
                        FROM workout_splits sp WHERE sp.user_id = p_user), '[]'::jsonb),
    'recent', workout_session_list(p_user, 5, 0),
    'week', (SELECT jsonb_build_object(
      'start', wk.cur, 'today', p_today,
      'days', (SELECT jsonb_agg(jsonb_build_object('date', d::date, 'sessions', (SELECT count(*) FROM ses WHERE ses.performed_on = d::date)) ORDER BY d)
               FROM generate_series(wk.cur, wk.cur + 6, interval '1 day') d),
      'sessions', (SELECT count(*) FROM ses WHERE ses.performed_on >= wk.cur),
      'volume_kg', (SELECT COALESCE(sum(vol), 0) FROM ses WHERE ses.performed_on >= wk.cur),
      'prev_sessions', (SELECT count(*) FROM ses WHERE ses.performed_on < wk.cur),
      'prev_volume_kg', (SELECT COALESCE(sum(vol), 0) FROM ses WHERE ses.performed_on < wk.cur)
    ) FROM wk),
    'active_weeks', COALESCE((SELECT jsonb_agg(w ORDER BY w DESC) FROM (
       SELECT DISTINCT date_trunc('week', s.performed_on)::date AS w FROM workout_sessions s
       WHERE s.user_id = p_user AND s.performed_on > p_today - 400 AND s.performed_on <= p_today + 1) q), '[]'::jsonb),
    'total_sessions', (SELECT count(*) FROM workout_sessions s WHERE s.user_id = p_user)
  );
$$;

-- "Progress" ro'yxati: foydalanuvchi bajargan har mashq — necha marta, oxirgi sana, eng yaxshi natija
CREATE OR REPLACE FUNCTION public.workout_progress(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'exercise', workout_exercise_json(e), 'sessions_count', a.sessions_count, 'last_date', a.last_date,
      'max_weight', a.max_weight, 'max_e1rm', a.max_e1rm, 'max_reps', a.max_reps
    ) ORDER BY a.last_date DESC, e.name), '[]'::jsonb)
  FROM (
    SELECT w.exercise_id, count(DISTINCT w.session_id) AS sessions_count, max(s.performed_on) AS last_date, max(w.weight_kg) AS max_weight,
           round(max(w.weight_kg * (1 + w.reps / 30.0)), 2) AS max_e1rm, max(w.reps)::integer AS max_reps
    FROM workout_sets w JOIN workout_sessions s ON s.id = w.session_id
    WHERE w.user_id = p_user GROUP BY w.exercise_id
  ) a JOIN exercises e ON e.id = a.exercise_id;
$$;

-- Bitta mashq tarixi: har mashg'ulotdagi padxodlari (eng yangisi birinchi). Mashq ko'rinmasa — NULL
CREATE OR REPLACE FUNCTION public.workout_exercise_history(p_user uuid, p_exercise uuid, p_limit integer DEFAULT 200)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'exercise', workout_exercise_json(e),
    'sessions', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.performed_on DESC, x.created_at DESC) FROM (
       SELECT s.performed_on, s.created_at, jsonb_build_object('session_id', s.id, 'performed_on', s.performed_on, 'title', s.title,
         'sets', (SELECT jsonb_agg(jsonb_build_object('weight_kg', w.weight_kg, 'reps', w.reps) ORDER BY w.set_order)
                  FROM workout_sets w WHERE w.session_id = s.id AND w.exercise_id = e.id)) AS j
       FROM workout_sessions s
       WHERE s.user_id = p_user AND EXISTS (SELECT 1 FROM workout_sets w WHERE w.session_id = s.id AND w.exercise_id = e.id)
       ORDER BY s.performed_on DESC, s.created_at DESC LIMIT LEAST(GREATEST(p_limit, 1), 500)) x), '[]'::jsonb)
  )
  FROM exercises e WHERE e.id = p_exercise AND (e.owner_id IS NULL OR e.owner_id = p_user);
$$;

-- Split yaratish (p_split NULL) yoki tahrirlash: nom + mashqlar ro'yxati (tartibi bilan) ATOMAR almashtiriladi.
-- p_exercises NULL — mashqlar o'zgarmaydi. Qaytadi: split id. Nom band bo'lsa — unique_violation (23505)
CREATE OR REPLACE FUNCTION public.workout_save_split(p_user uuid, p_split uuid, p_name text, p_exercises uuid[], p_max_splits integer DEFAULT 20)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid := p_split;
BEGIN
  IF p_exercises IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(p_exercises) x LEFT JOIN exercises e ON e.id = x
    WHERE e.id IS NULL OR e.archived_at IS NOT NULL OR (e.owner_id IS NOT NULL AND e.owner_id <> p_user)
  ) THEN
    RAISE EXCEPTION 'WORKOUT_EXERCISE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF sid IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('workout_splits:' || p_user::text));
    IF (SELECT count(*) FROM workout_splits WHERE user_id = p_user) >= p_max_splits THEN
      RAISE EXCEPTION 'WORKOUT_SPLIT_LIMIT' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO workout_splits (user_id, name, position)
    VALUES (p_user, btrim(p_name), COALESCE((SELECT max(position) + 1 FROM workout_splits WHERE user_id = p_user), 0))
    RETURNING id INTO sid;
  ELSE
    UPDATE workout_splits SET name = COALESCE(btrim(p_name), name), updated_at = now() WHERE id = sid AND user_id = p_user;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'WORKOUT_SPLIT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF p_exercises IS NOT NULL THEN
    DELETE FROM split_exercises WHERE split_id = sid;
    INSERT INTO split_exercises (split_id, exercise_id, position)
    SELECT sid, x, min(i) - 1 FROM unnest(p_exercises) WITH ORDINALITY AS t(x, i) GROUP BY x;
  END IF;
  RETURN sid;
END $$;

-- O'z mashqini o'chirish: hech qayerda yozilmagan bo'lsa — butunlay o'chadi; tarixda bo'lsa — arxivlanadi
-- (tarix va statistika saqlanadi, lekin tanlash ro'yxatida va splitlarda endi ko'rinmaydi). Qaytadi: 'deleted' | 'archived'
CREATE OR REPLACE FUNCTION public.workout_delete_exercise(p_user uuid, p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM exercises WHERE id = p_id AND owner_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKOUT_EXERCISE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM split_exercises WHERE exercise_id = p_id;
  IF EXISTS (SELECT 1 FROM workout_sets WHERE exercise_id = p_id) THEN
    UPDATE exercises SET archived_at = now() WHERE id = p_id;
    RETURN 'archived';
  END IF;
  DELETE FROM exercises WHERE id = p_id;
  RETURN 'deleted';
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'workout_save_session(uuid, uuid, uuid, text, date, integer, text, jsonb)', 'workout_last_sets(uuid, uuid[], uuid, date)',
    'workout_exercise_bests(uuid, uuid[], uuid, date)', 'workout_session_list(uuid, integer, integer)', 'workout_session_detail(uuid, uuid)',
    'workout_overview(uuid, date)', 'workout_split_get(uuid, uuid)', 'workout_progress(uuid)', 'workout_exercise_history(uuid, uuid, integer)',
    'workout_save_split(uuid, uuid, text, uuid[], integer)', 'workout_delete_exercise(uuid, uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.workout_exercise_json(public.exercises), public.workout_split_json(public.workout_splits) FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.exercises, public.workout_splits, public.split_exercises, public.workout_sessions, public.workout_sets TO service_role;

-- ---------------------------------------------------------------------------
-- MASHQLAR KATALOGI. slug — o'zgarmas kalit (ilovalar ham shunga tayanishi mumkin).
-- Qayta ishga tushirilsa nomlar yangilanadi, id'lar o'zgarmaydi.
-- name — zallarda keng ishlatiladigan nom, name_uz — o'zbekcha tushuntirish, aliases — qidiruv uchun (ruscha/lotincha atamalar)
-- ---------------------------------------------------------------------------
INSERT INTO public.exercises (slug, name, name_uz, aliases, muscle_group, equipment, is_bodyweight) VALUES
  -- Ko'krak
  ('bench-press',              'Bench press',                 'Yotib shtanga jimi',                 'jim leja, жим лежа, jim lyoja, shtanga',        'chest',     'barbell',    false),
  ('incline-bench-press',      'Incline bench press',         'Qiya o''rindiqda shtanga jimi',      'naklon, наклонный жим',                         'chest',     'barbell',    false),
  ('decline-bench-press',      'Decline bench press',         'Boshi pastga qiyalikda jim',         'обратный наклон',                               'chest',     'barbell',    false),
  ('dumbbell-bench-press',     'Dumbbell bench press',        'Yotib gantel jimi',                  'gantel jim, жим гантелей',                      'chest',     'dumbbell',   false),
  ('incline-dumbbell-press',   'Incline dumbbell press',      'Qiya o''rindiqda gantel jimi',       'naklon gantel',                                 'chest',     'dumbbell',   false),
  ('chest-press-machine',      'Chest press machine',         'Trenajyorda ko''krak jimi',          'jim trenajyor',                                 'chest',     'machine',    false),
  ('pec-deck',                 'Fly machine (Pec deck)',      'Babochka trenajyori',                'babochka, бабочка, fly',                        'chest',     'machine',    false),
  ('dumbbell-fly',             'Dumbbell fly',                'Gantel bilan razvodka',              'razvodka, разводка',                            'chest',     'dumbbell',   false),
  ('cable-crossover',          'Cable crossover',             'Blokda krossover',                   'krossover, кроссовер',                          'chest',     'cable',      false),
  ('push-up',                  'Push-up',                     'Yerdan itarilish (otjimaniya)',      'otjimaniya, отжимания',                         'chest',     'bodyweight', true),
  ('dips',                     'Dips',                        'Brusda itarilish',                   'brusya, брусья',                                'chest',     'bodyweight', true),
  -- Orqa
  ('deadlift',                 'Deadlift',                    'Stanovaya tyaga',                    'stanovoy, становая тяга',                       'back',      'barbell',    false),
  ('pull-up',                  'Pull-up',                     'Turnikda tortilish',                 'turnik, подтягивания, podtyagivanie',           'back',      'bodyweight', true),
  ('chin-up',                  'Chin-up',                     'Teskari ushlab tortilish',           'обратный хват',                                 'back',      'bodyweight', true),
  ('lat-pulldown',             'Lat pulldown',                'Yuqori blokni ko''krakka tortish',   'verxniy blok, верхний блок',                    'back',      'cable',      false),
  ('seated-cable-row',         'Seated cable row',            'O''tirib gorizontal blok tortish',   'nijniy blok, горизонтальная тяга',              'back',      'cable',      false),
  ('barbell-row',              'Barbell row',                 'Engashib shtanga tortish',           'тяга штанги в наклоне',                         'back',      'barbell',    false),
  ('dumbbell-row',             'One-arm dumbbell row',        'Bir qo''lda gantel tortish',         'тяга гантели',                                  'back',      'dumbbell',   false),
  ('t-bar-row',                'T-bar row',                   'T-grif tortish',                     'т-гриф',                                        'back',      'barbell',    false),
  ('machine-row',              'Machine row',                 'Trenajyorda tortish',                'rychajnaya tyaga',                              'back',      'machine',    false),
  ('straight-arm-pulldown',    'Straight-arm pulldown',       'To''g''ri qo''l bilan blok tortish', 'pulover blok',                                  'back',      'cable',      false),
  ('back-extension',           'Back extension',              'Giperekstenziya',                    'giper, гиперэкстензия',                         'back',      'bodyweight', true),
  ('shrug',                    'Shrugs',                      'Yelka qisish (trapetsiya)',          'shragi, шраги',                                 'back',      'dumbbell',   false),
  -- Yelka
  ('overhead-press',           'Overhead press',              'Tik turib shtanga jimi (armeyskiy)', 'armeyskiy, армейский жим',                      'shoulders', 'barbell',    false),
  ('dumbbell-shoulder-press',  'Dumbbell shoulder press',     'O''tirib gantel jimi',               'жим гантелей сидя',                             'shoulders', 'dumbbell',   false),
  ('shoulder-press-machine',   'Shoulder press machine',      'Trenajyorda yelka jimi',             'jim trenajyor yelka',                           'shoulders', 'machine',    false),
  ('arnold-press',             'Arnold press',                'Arnold jimi',                        'арнольд',                                       'shoulders', 'dumbbell',   false),
  ('lateral-raise',            'Lateral raise',               'Gantelni yonga ko''tarish',          'max, махи, lateral rises',                      'shoulders', 'dumbbell',   false),
  ('cable-lateral-raise',      'Cable lateral raise',         'Blokda yonga ko''tarish',            'махи в блоке',                                  'shoulders', 'cable',      false),
  ('front-raise',              'Front raise',                 'Gantelni oldinga ko''tarish',        'махи вперед',                                   'shoulders', 'dumbbell',   false),
  ('rear-delt-fly',            'Rear delt fly',               'Orqa delta razvodka',                'задняя дельта',                                 'shoulders', 'dumbbell',   false),
  ('face-pull',                'Face pull',                   'Arqonni yuzga tortish',              'фейс пулл',                                     'shoulders', 'cable',      false),
  ('upright-row',              'Upright row',                 'Iyakka tortish',                     'протяжка, protyajka',                           'shoulders', 'barbell',    false),
  -- Biseps
  ('barbell-curl',             'Barbell curl',                'Shtanga bilan biseps',               'подъем штанги на бицепс',                       'biceps',    'barbell',    false),
  ('ez-bar-curl',              'EZ-bar curl',                 'EZ-grif bilan biseps',               'изогнутый гриф',                                'biceps',    'barbell',    false),
  ('dumbbell-curl',            'Dumbbell curl',               'Gantel bilan biseps',                'бицепс гантели',                                'biceps',    'dumbbell',   false),
  ('hammer-curl',              'Hammer curl',                 'Bolg''a (molotki)',                  'molotki, молотки',                              'biceps',    'dumbbell',   false),
  ('preacher-curl',            'Preacher curl',               'Skott o''rindig''ida biseps',        'skott, скотт',                                  'biceps',    'barbell',    false),
  ('concentration-curl',       'Concentration curl',          'Konsentratsiyali biseps',            'концентрированный',                             'biceps',    'dumbbell',   false),
  ('cable-curl',               'Cable curl',                  'Blokda biseps',                      'бицепс в блоке',                                'biceps',    'cable',      false),
  -- Triseps
  ('triceps-pushdown',         'Triceps pushdown',            'Blokda triseps',                     'trisep pushdown, разгибания в блоке',           'triceps',   'cable',      false),
  ('rope-pushdown',            'Rope pushdown',               'Arqon bilan triseps',                'канат',                                         'triceps',   'cable',      false),
  ('skull-crusher',            'Skull crusher',               'Fransuzcha jim',                     'francuzskiy, французский жим',                  'triceps',   'barbell',    false),
  ('overhead-triceps-extension','Overhead triceps extension', 'Bosh ortidan triseps',               'из-за головы',                                  'triceps',   'dumbbell',   false),
  ('close-grip-bench-press',   'Close-grip bench press',      'Tor ushlab jim',                     'узкий хват',                                    'triceps',   'barbell',    false),
  ('bench-dips',               'Bench dips',                  'O''rindiqda orqaga itarilish',       'обратные отжимания',                            'triceps',   'bodyweight', true),
  ('triceps-kickback',         'Triceps kickback',            'Gantelni orqaga yozish',             'разгибание в наклоне',                          'triceps',   'dumbbell',   false),
  -- Oyoq
  ('squat',                    'Squat',                       'Shtanga bilan o''tirib-turish',      'prised, prisedaniya, присед',                   'legs',      'barbell',    false),
  ('front-squat',              'Front squat',                 'Oldinda shtanga bilan o''tirish',    'фронтальный присед',                            'legs',      'barbell',    false),
  ('smith-squat',              'Smith machine squat',         'Smitda o''tirib-turish',             'смит',                                          'legs',      'machine',    false),
  ('hack-squat',               'Hack squat',                  'Gakk-o''tirish',                     'гакк',                                          'legs',      'machine',    false),
  ('goblet-squat',             'Goblet squat',                'Gantel bilan o''tirish',             'гоблет',                                        'legs',      'dumbbell',   false),
  ('leg-press',                'Leg press',                   'Oyoq jimi trenajyori',               'jim nogami, жим ногами',                        'legs',      'machine',    false),
  ('leg-extension',            'Leg extension',               'O''tirib oyoq yozish',               'разгибание ног',                                'legs',      'machine',    false),
  ('leg-curl',                 'Leg curl',                    'Oyoq bukish (son orqasi)',           'сгибание ног',                                  'legs',      'machine',    false),
  ('romanian-deadlift',        'Romanian deadlift',           'Rumin tyagasi',                      'rumin, румынская тяга',                         'legs',      'barbell',    false),
  ('lunges',                   'Lunges',                      'Vipadlar',                           'vipadi, выпады',                                'legs',      'dumbbell',   false),
  ('bulgarian-split-squat',    'Bulgarian split squat',       'Bolgarcha vipad',                    'болгарские выпады',                             'legs',      'dumbbell',   false),
  ('standing-calf-raise',      'Standing calf raise',         'Tik turib boldir (ikra)',            'ikra, икры',                                    'legs',      'machine',    false),
  ('seated-calf-raise',        'Seated calf raise',           'O''tirib boldir',                    'икры сидя',                                     'legs',      'machine',    false),
  ('adductor-machine',         'Adductor machine',            'Oyoqni ichkariga yig''ish',          'сведение ног',                                  'legs',      'machine',    false),
  ('abductor-machine',         'Abductor machine',            'Oyoqni tashqariga ochish',           'разведение ног',                                'glutes',    'machine',    false),
  -- Dumba
  ('hip-thrust',               'Hip thrust',                  'Shtanga bilan ko''prikcha',          'yagodichniy most, ягодичный мост',              'glutes',    'barbell',    false),
  ('glute-bridge',             'Glute bridge',                'Yerda ko''prikcha',                  'мостик',                                        'glutes',    'bodyweight', true),
  ('cable-kickback',           'Cable kickback',              'Blokda oyoqni orqaga siltash',       'отведение ноги',                                'glutes',    'cable',      false),
  ('sumo-deadlift',            'Sumo deadlift',               'Sumo tyaga',                         'сумо',                                          'glutes',    'barbell',    false),
  -- Qorin
  ('crunch',                   'Crunch',                      'Qorin (skruchivaniya)',              'press, скручивания',                            'core',      'bodyweight', true),
  ('hanging-leg-raise',        'Hanging leg raise',           'Turnikda oyoq ko''tarish',           'подъем ног в висе',                             'core',      'bodyweight', true),
  ('leg-raise',                'Lying leg raise',             'Yotib oyoq ko''tarish',              'подъем ног лежа',                               'core',      'bodyweight', true),
  ('cable-crunch',             'Cable crunch',                'Blokda qorin',                       'молитва',                                       'core',      'cable',      false),
  ('russian-twist',            'Russian twist',               'Ruscha burilish',                    'русский твист',                                 'core',      'bodyweight', true),
  ('ab-wheel',                 'Ab wheel rollout',            'Rolik bilan qorin',                  'rolik, ролик',                                  'core',      'bodyweight', true),
  ('decline-sit-up',           'Decline sit-up',              'Qiya o''rindiqda qorin',             'пресс на наклонной',                            'core',      'bodyweight', true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, name_uz = EXCLUDED.name_uz, aliases = EXCLUDED.aliases,
  muscle_group = EXCLUDED.muscle_group, equipment = EXCLUDED.equipment, is_bodyweight = EXCLUDED.is_bodyweight;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v36: kundalik jadvallari' AS tekshiruv,
       CASE WHEN to_regclass('public.workout_sets') IS NOT NULL AND to_regclass('public.workout_sessions') IS NOT NULL
             AND to_regclass('public.workout_splits') IS NOT NULL AND to_regclass('public.split_exercises') IS NOT NULL
        THEN 'OK' ELSE 'XATO' END AS natija
UNION ALL
SELECT 'v36: katalog mashqlari soni', (SELECT count(*)::text FROM public.exercises WHERE owner_id IS NULL);
