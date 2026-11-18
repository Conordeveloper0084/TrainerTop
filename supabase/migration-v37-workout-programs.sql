-- ============================================================================
-- TRAINERTOP — migration v37: KUNDALIK 2-bosqich
--   * Programmalar: Programma (PPL, Upper/Lower...) → kunlar (Push day...) → mashqlar. Mavjud splitlar avtomatik
--     har foydalanuvchining "Mening programmam" programmasiga o'tkaziladi (hech narsa yo'qolmaydi).
--   * Har mashq uchun padxodlar soni (1–10) — izolyatsion mashqlarga 1–2 ta qo'yish mumkin.
--   * O'z nomi bilan mashq: mushak guruhi ixtiyoriy ('other').
--   * Katalogga mahalliy nomlar (temirda anjimaniya, arqonda pastga bosish, o'tirib turish...).
--   * Yutuqlar: har mashg'ulotdagi har mashqni OLDINGI natija bilan solishtirish (rekord / vazn oshdi / takror oshdi).
--   * Hisobotni trenerga ulashish: jonli havola (trener har doim eng yangi ma'lumotni ko'radi), istalgan payt to'xtatiladi.
-- v36 dan keyin ishga tushiriladi. Qayta ishga tushirsa xavfsiz.
-- ============================================================================

-- 1) O'z nomi bilan yaratilgan mashq uchun mushak guruhi ixtiyoriy
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_muscle_group_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_muscle_group_check
  CHECK (muscle_group IN ('chest','back','shoulders','biceps','triceps','legs','glutes','core','other'));

-- 2) Programmalar
CREATE TABLE IF NOT EXISTS public.workout_programs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  position   integer NOT NULL DEFAULT 0,          -- eng kichigi — "asosiy" programma (bosh sahifada birinchi)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS workout_programs_name_uq ON public.workout_programs (user_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS workout_programs_user_idx ON public.workout_programs (user_id, position, created_at);
ALTER TABLE public.workout_programs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_programs FROM anon, authenticated;
GRANT ALL ON public.workout_programs TO service_role;

ALTER TABLE public.workout_splits ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.workout_programs(id) ON DELETE CASCADE;

-- Mavjud splitlar → "Mening programmam"
INSERT INTO public.workout_programs (user_id, name)
SELECT DISTINCT s.user_id, 'Mening programmam' FROM public.workout_splits s
WHERE s.program_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.workout_programs p WHERE p.user_id = s.user_id AND lower(btrim(p.name)) = 'mening programmam');
UPDATE public.workout_splits s SET program_id = p.id
FROM public.workout_programs p
WHERE s.program_id IS NULL AND p.user_id = s.user_id AND lower(btrim(p.name)) = 'mening programmam';
ALTER TABLE public.workout_splits ALTER COLUMN program_id SET NOT NULL;

-- Kun nomi endi PROGRAMMA ichida yagona ("Upper A" ikki programmada bo'lishi mumkin)
DROP INDEX IF EXISTS public.workout_splits_name_uq;
CREATE UNIQUE INDEX IF NOT EXISTS workout_splits_prog_name_uq ON public.workout_splits (program_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS workout_splits_program_idx ON public.workout_splits (program_id, position, created_at);

-- 3) Har mashq uchun padxodlar soni
ALTER TABLE public.split_exercises ADD COLUMN IF NOT EXISTS target_sets smallint NOT NULL DEFAULT 3;
ALTER TABLE public.split_exercises DROP CONSTRAINT IF EXISTS split_exercises_target_sets_check;
ALTER TABLE public.split_exercises ADD CONSTRAINT split_exercises_target_sets_check CHECK (target_sets BETWEEN 1 AND 10);

-- 4) Mashg'ulot qaysi programmaga tegishli (kun keyin o'chirilsa ham hisobotda qoladi)
ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.workout_programs(id) ON DELETE SET NULL;
UPDATE public.workout_sessions s SET program_id = sp.program_id
FROM public.workout_splits sp WHERE s.split_id = sp.id AND s.program_id IS NULL;
CREATE INDEX IF NOT EXISTS workout_sessions_program_idx ON public.workout_sessions (program_id, performed_on DESC) WHERE program_id IS NOT NULL;

-- 5) Hisobotni ulashish (trenerga)
CREATE TABLE IF NOT EXISTS public.workout_report_shares (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.workout_programs(id) ON DELETE CASCADE,
  viewer_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT workout_report_shares_not_self CHECK (owner_id <> viewer_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS workout_report_shares_active_uq ON public.workout_report_shares (program_id, viewer_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS workout_report_shares_viewer_idx ON public.workout_report_shares (viewer_id) WHERE revoked_at IS NULL;
ALTER TABLE public.workout_report_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_report_shares FROM anon, authenticated;
GRANT ALL ON public.workout_report_shares TO service_role;

-- 6) Katalogga mahalliy nomlar (qidiruvda topilishi uchun). Har safar to'liq qiymat yoziladi — qayta ishga tushirish xavfsiz.
UPDATE public.exercises e SET aliases = v.a
FROM (VALUES
  ('bench-press',            'temirda anjimaniya, temirda otjimaniya, jim lyoja, jim lyuja, jim leja, shtanga jim, yotib jim, жим лежа, жим лёжа'),
  ('incline-bench-press',    'qiya jim, naklon jim, naklonda jim, verxniy jim, наклонный жим'),
  ('dumbbell-bench-press',   'gantel jim, gantelda anjimaniya, gantel bilan jim, жим гантелей'),
  ('incline-dumbbell-press', 'qiya gantel jim, naklon gantel, наклонный жим гантелей'),
  ('pec-deck',               'babochka, бабочка, fly, butterfly, trenajyorda razvodka'),
  ('dumbbell-fly',           'razvodka, разводка, gantel razvodka'),
  ('push-up',                'anjimaniya, otjimaniya, yerdan itarilish, yerda anjimaniya, отжимания'),
  ('dips',                   'brus, brusda anjimaniya, brusda itarilish, brusya, брусья'),
  ('deadlift',               'stanovoy, stanovaya tyaga, yerdan ko''tarish, становая тяга'),
  ('pull-up',                'turnik, turnikda tortilish, podtyagivaniya, podtyagivanie, подтягивания'),
  ('lat-pulldown',           'verxniy blok, tepadan tortish, blokni ko''krakka tortish, тяга верхнего блока'),
  ('seated-cable-row',       'nijniy blok, gorizontal tyaga, o''tirib tortish, горизонтальная тяга'),
  ('barbell-row',            'tyaga, engashib tortish, shtanga tyaga, тяга штанги в наклоне'),
  ('dumbbell-row',           'gantel tyaga, bir qo''lda tortish, тяга гантели'),
  ('back-extension',         'giper, giperekstenziya, гиперэкстензия'),
  ('shrug',                  'shragi, yelka qisish, шраги'),
  ('overhead-press',         'armeyskiy jim, tepaga jim, boshdan jim, армейский жим'),
  ('dumbbell-shoulder-press','gantel jim tepaga, o''tirib gantel jim, жим гантелей сидя'),
  ('lateral-raise',          'maxi, max, yonga ko''tarish, lateral rises, махи'),
  ('rear-delt-fly',          'orqa delta, задняя дельта, engashib razvodka'),
  ('barbell-curl',           'biseps shtanga, shtanga biseps, подъем на бицепс'),
  ('dumbbell-curl',          'gantel biseps, бицепс гантели'),
  ('hammer-curl',            'molotki, molotok, bolg''a, молотки'),
  ('preacher-curl',          'skott, скотт'),
  ('triceps-pushdown',       'arqonda pastga bosish, blokda pastga bosish, trisep pushdown, triseps blok, разгибания в блоке'),
  ('rope-pushdown',          'arqonda pastga bosish, kanat, arqon bilan triseps, канат'),
  ('skull-crusher',          'fransuzskiy jim, francuzskiy, fransuzcha, французский жим'),
  ('overhead-triceps-extension','boshdan triseps, bosh ortidan, из-за головы'),
  ('squat',                  'o''tirib turish, prised, prisedaniya, shtanga bilan o''tirish, присед'),
  ('leg-press',              'oyoq jim, jim nogami, platforma, жим ногами'),
  ('leg-extension',          'oyoq yozish, razgibaniya nog, разгибание ног'),
  ('leg-curl',               'oyoq bukish, sgibaniya nog, сгибание ног'),
  ('romanian-deadlift',      'rumin tyaga, ruminskaya tyaga, румынская тяга'),
  ('lunges',                 'vipad, vipadlar, qadam tashlab o''tirish, выпады'),
  ('standing-calf-raise',    'ikra, boldir, икры'),
  ('hip-thrust',             'yagodichniy most, ko''prik, ягодичный мост'),
  ('crunch',                 'press, qorin, skruchivaniya, скручивания'),
  ('hanging-leg-raise',      'turnikda oyoq ko''tarish, visda press, подъем ног в висе')
) AS v(slug, a)
WHERE e.slug = v.slug;

-- ---------------------------------------------------------------------------
-- FUNKSIYALAR (faqat service_role). Xatolar: WORKOUT_PROGRAM_NOT_FOUND, WORKOUT_PROGRAM_LIMIT, WORKOUT_SPLIT_LIMIT,
-- WORKOUT_SPLIT_NOT_FOUND, WORKOUT_EXERCISE_NOT_FOUND, WORKOUT_SHARE_NO_CHAT
-- ---------------------------------------------------------------------------

-- Kun (split) JSON: mashqlar tartibda + har birining padxodlar soni
CREATE OR REPLACE FUNCTION public.workout_split_json(sp public.workout_splits)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', sp.id, 'program_id', sp.program_id, 'name', sp.name, 'position', sp.position, 'created_at', sp.created_at,
    'exercises', COALESCE((SELECT jsonb_agg(workout_exercise_json(e) || jsonb_build_object('target_sets', se.target_sets) ORDER BY se.position)
                           FROM split_exercises se JOIN exercises e ON e.id = se.exercise_id WHERE se.split_id = sp.id), '[]'::jsonb),
    'last_performed_on', (SELECT max(s.performed_on) FROM workout_sessions s WHERE s.split_id = sp.id),
    'sessions_count', (SELECT count(*) FROM workout_sessions s WHERE s.split_id = sp.id));
$$;

-- Programma JSON: kunlari, umumiy sanoq, oxirgi bajarilgan kun (navbatdagini aniqlash uchun)
CREATE OR REPLACE FUNCTION public.workout_program_json(p public.workout_programs)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', p.id, 'name', p.name, 'position', p.position, 'created_at', p.created_at,
    'days', COALESCE((SELECT jsonb_agg(workout_split_json(sp) ORDER BY sp.position, sp.created_at) FROM workout_splits sp WHERE sp.program_id = p.id), '[]'::jsonb),
    'sessions_count', (SELECT count(*) FROM workout_sessions s WHERE s.program_id = p.id),
    'sessions_30d', (SELECT count(*) FROM workout_sessions s WHERE s.program_id = p.id AND s.performed_on > current_date - 30),
    'last_performed_on', (SELECT max(s.performed_on) FROM workout_sessions s WHERE s.program_id = p.id),
    'last_split_id', (SELECT s.split_id FROM workout_sessions s WHERE s.program_id = p.id AND s.split_id IS NOT NULL
                      ORDER BY s.performed_on DESC, s.created_at DESC LIMIT 1));
$$;

CREATE OR REPLACE FUNCTION public.workout_program_get(p_user uuid, p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workout_program_json(p) FROM workout_programs p WHERE p.id = p_id AND p.user_id = p_user;
$$;

-- Programma yaratish (kunlari va mashqlari bilan, ATOMAR). p_days: [{ name, exercises: [{ exercise_id, target_sets }] }]
CREATE OR REPLACE FUNCTION public.workout_create_program(p_user uuid, p_name text, p_days jsonb, p_max_programs integer DEFAULT 10, p_max_days integer DEFAULT 14)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pid uuid; d jsonb; sid uuid; i integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('workout_programs:' || p_user::text));
  IF (SELECT count(*) FROM workout_programs WHERE user_id = p_user) >= p_max_programs THEN
    RAISE EXCEPTION 'WORKOUT_PROGRAM_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(COALESCE(p_days, '[]'::jsonb)) > p_max_days THEN
    RAISE EXCEPTION 'WORKOUT_SPLIT_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO workout_programs (user_id, name, position)
  VALUES (p_user, btrim(p_name), COALESCE((SELECT max(position) + 1 FROM workout_programs WHERE user_id = p_user), 0))
  RETURNING id INTO pid;
  FOR d IN SELECT * FROM jsonb_array_elements(COALESCE(p_days, '[]'::jsonb)) LOOP
    INSERT INTO workout_splits (user_id, program_id, name, position) VALUES (p_user, pid, btrim(d->>'name'), i) RETURNING id INTO sid;
    PERFORM workout_set_split_items(p_user, sid, COALESCE(d->'exercises', '[]'::jsonb));
    i := i + 1;
  END LOOP;
  RETURN pid;
END $$;

-- Kun mashqlarini to'liq almashtirish (ichki yordamchi). p_items: [{ exercise_id, target_sets }]
CREATE OR REPLACE FUNCTION public.workout_set_split_items(p_user uuid, p_split uuid, p_items jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) x
    LEFT JOIN exercises e ON e.id = (x->>'exercise_id')::uuid
    WHERE e.id IS NULL OR e.archived_at IS NOT NULL OR (e.owner_id IS NOT NULL AND e.owner_id <> p_user)
  ) THEN
    RAISE EXCEPTION 'WORKOUT_EXERCISE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM split_exercises WHERE split_id = p_split;
  INSERT INTO split_exercises (split_id, exercise_id, position, target_sets)
  SELECT p_split, q.eid, q.pos, q.ts FROM (
    SELECT DISTINCT ON ((x->>'exercise_id')::uuid) (x->>'exercise_id')::uuid AS eid, (i - 1)::integer AS pos,
           LEAST(10, GREATEST(1, COALESCE((x->>'target_sets')::integer, 3)))::smallint AS ts
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) WITH ORDINALITY AS t(x, i)
    ORDER BY (x->>'exercise_id')::uuid, i
  ) q;
END $$;

-- Kun yaratish (p_split NULL, p_program majburiy) yoki tahrirlash: nom va/yoki mashqlar. Qaytadi: kun id
DROP FUNCTION IF EXISTS public.workout_save_split(uuid, uuid, text, uuid[], integer);
CREATE OR REPLACE FUNCTION public.workout_save_split(p_user uuid, p_split uuid, p_program uuid, p_name text, p_items jsonb, p_max_days integer DEFAULT 14)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid := p_split;
BEGIN
  IF sid IS NULL THEN
    PERFORM 1 FROM workout_programs WHERE id = p_program AND user_id = p_user FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'WORKOUT_PROGRAM_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    IF (SELECT count(*) FROM workout_splits WHERE program_id = p_program) >= p_max_days THEN
      RAISE EXCEPTION 'WORKOUT_SPLIT_LIMIT' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO workout_splits (user_id, program_id, name, position)
    VALUES (p_user, p_program, btrim(p_name), COALESCE((SELECT max(position) + 1 FROM workout_splits WHERE program_id = p_program), 0))
    RETURNING id INTO sid;
  ELSE
    UPDATE workout_splits SET name = COALESCE(btrim(p_name), name), updated_at = now() WHERE id = sid AND user_id = p_user;
    IF NOT FOUND THEN RAISE EXCEPTION 'WORKOUT_SPLIT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  END IF;
  IF p_items IS NOT NULL THEN PERFORM workout_set_split_items(p_user, sid, p_items); END IF;
  RETURN sid;
END $$;

-- Mashg'ulot saqlanganda programma ham yoziladi (kun keyin o'chirilsa ham hisobotda qoladi)
CREATE OR REPLACE FUNCTION public.workout_save_session(
  p_user uuid, p_id uuid, p_split uuid, p_title text, p_date date, p_duration integer, p_note text, p_sets jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer; existed boolean; prog uuid;
BEGIN
  IF p_split IS NOT NULL THEN
    SELECT program_id INTO prog FROM workout_splits WHERE id = p_split AND user_id = p_user;
    IF NOT FOUND THEN p_split := NULL; END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(p_sets, '[]'::jsonb)) s
    LEFT JOIN exercises e ON e.id = (s->>'exercise_id')::uuid
    WHERE e.id IS NULL OR (e.owner_id IS NOT NULL AND e.owner_id <> p_user)
  ) THEN
    RAISE EXCEPTION 'WORKOUT_EXERCISE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  existed := EXISTS (SELECT 1 FROM workout_sessions WHERE id = p_id);
  INSERT INTO workout_sessions AS ws (id, user_id, split_id, program_id, title, performed_on, duration_sec, note)
  VALUES (p_id, p_user, p_split, prog, btrim(p_title), p_date, p_duration, NULLIF(btrim(COALESCE(p_note, '')), ''))
  ON CONFLICT (id) DO UPDATE
    SET split_id = EXCLUDED.split_id,
        program_id = CASE WHEN EXCLUDED.split_id IS NULL THEN ws.program_id ELSE EXCLUDED.program_id END,
        title = EXCLUDED.title, performed_on = EXCLUDED.performed_on,
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

-- Mashg'ulot tafsiloti: programma ham
CREATE OR REPLACE FUNCTION public.workout_session_detail(p_user uuid, p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'split_id', s.split_id, 'program_id', s.program_id, 'title', s.title, 'performed_on', s.performed_on, 'duration_sec', s.duration_sec,
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

-- Bosh sahifa: programmalar (kunlari bilan), so'nggi 5 mashg'ulot, hafta, faol haftalar
CREATE OR REPLACE FUNCTION public.workout_overview(p_user uuid, p_today date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH wk AS (SELECT date_trunc('week', p_today)::date AS cur, (date_trunc('week', p_today) - interval '7 days')::date AS prev),
  ses AS (
    SELECT s.id, s.performed_on, (SELECT COALESCE(sum(w.weight_kg * w.reps), 0) FROM workout_sets w WHERE w.session_id = s.id) AS vol
    FROM workout_sessions s, wk WHERE s.user_id = p_user AND s.performed_on >= wk.prev AND s.performed_on < wk.cur + 7
  )
  SELECT jsonb_build_object(
    'programs', COALESCE((SELECT jsonb_agg(workout_program_json(p) ORDER BY p.position, p.created_at)
                          FROM workout_programs p WHERE p.user_id = p_user), '[]'::jsonb),
    'recent', workout_session_list(p_user, 5, 0),
    'week', (SELECT jsonb_build_object(
      'start', wk.cur, 'today', p_today,
      'days', (SELECT jsonb_agg(jsonb_build_object('date', d::date, 'sessions', (SELECT count(*) FROM ses WHERE ses.performed_on = d::date)) ORDER BY d)
               FROM generate_series(wk.cur, wk.cur + 6, interval '1 day') d),
      'sessions', (SELECT count(*) FROM ses WHERE ses.performed_on >= wk.cur),
      'volume_kg', (SELECT COALESCE(sum(vol), 0) FROM ses WHERE ses.performed_on >= wk.cur),
      'prev_sessions', (SELECT count(*) FROM ses WHERE ses.performed_on < wk.cur),
      'prev_volume_kg', (SELECT COALESCE(sum(vol), 0) FROM ses WHERE ses.performed_on < wk.cur),
      'session_ids', COALESCE((SELECT jsonb_agg(ses.id) FROM ses WHERE ses.performed_on >= wk.cur), '[]'::jsonb)
    ) FROM wk),
    'active_weeks', COALESCE((SELECT jsonb_agg(w ORDER BY w DESC) FROM (
       SELECT DISTINCT date_trunc('week', s.performed_on)::date AS w FROM workout_sessions s
       WHERE s.user_id = p_user AND s.performed_on > p_today - 400 AND s.performed_on <= p_today + 1) q), '[]'::jsonb),
    'total_sessions', (SELECT count(*) FROM workout_sessions s WHERE s.user_id = p_user)
  );
$$;

-- Progress ro'yxati: + birinchi va oxirgi mashg'ulotdagi eng og'ir vazn ("boshlaganidan beri +X kg")
CREATE OR REPLACE FUNCTION public.workout_progress(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH per AS (
    SELECT w.exercise_id, s.id AS session_id, s.performed_on, s.created_at, max(w.weight_kg) AS mw, max(w.reps) AS mr
    FROM workout_sets w JOIN workout_sessions s ON s.id = w.session_id
    WHERE w.user_id = p_user GROUP BY w.exercise_id, s.id, s.performed_on, s.created_at
  ),
  agg AS (
    SELECT exercise_id, count(*) AS sessions_count, max(performed_on) AS last_date, max(mw) AS max_weight,
           max(mr)::integer AS max_reps,
           (array_agg(mw ORDER BY performed_on, created_at))[1] AS first_max_weight,
           (array_agg(mw ORDER BY performed_on DESC, created_at DESC))[1] AS last_max_weight,
           (array_agg(mr ORDER BY performed_on, created_at))[1]::integer AS first_max_reps,
           (array_agg(mr ORDER BY performed_on DESC, created_at DESC))[1]::integer AS last_max_reps
    FROM per GROUP BY exercise_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'exercise', workout_exercise_json(e), 'sessions_count', a.sessions_count, 'last_date', a.last_date,
      'max_weight', a.max_weight, 'max_reps', a.max_reps,
      'first_max_weight', a.first_max_weight, 'last_max_weight', a.last_max_weight,
      'first_max_reps', a.first_max_reps, 'last_max_reps', a.last_max_reps
    ) ORDER BY a.last_date DESC, e.name), '[]'::jsonb)
  FROM agg a JOIN exercises e ON e.id = a.exercise_id;
$$;

-- YUTUQLAR uchun xom ma'lumot: berilgan mashg'ulotlardagi har mashq — joriy natija, OLDINGI mashg'ulotdagi natija va
-- undan oldingi hamma natijalarning eng yaxshisi. Tasnif (rekord / vazn oshdi / takror oshdi) — src/lib/workout.ts classifyOutcome.
-- "Oldin" = sana bo'yicha, bir kunda bo'lsa — yaratilgan vaqti bo'yicha (eski mashg'ulotni tahrirlash keyingilar bilan solishtirilmaydi).
CREATE OR REPLACE FUNCTION public.workout_outcome_rows(p_user uuid, p_sessions uuid[])
RETURNS TABLE (session_id uuid, exercise_id uuid, is_bodyweight boolean,
               cur_max_weight numeric, cur_reps_at_top integer, cur_total_reps integer, cur_max_reps integer,
               prev_session_id uuid, prev_performed_on date, prev_max_weight numeric, prev_reps_at_top integer, prev_total_reps integer, prev_max_reps integer,
               prior_max_weight numeric, prior_max_reps integer, prior_sessions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cur AS (
    SELECT w.session_id, w.exercise_id, s.performed_on, s.created_at,
           max(w.weight_kg) AS mw, sum(w.reps)::integer AS tr, max(w.reps)::integer AS mr
    FROM workout_sets w JOIN workout_sessions s ON s.id = w.session_id
    WHERE w.user_id = p_user AND w.session_id = ANY(p_sessions)
    GROUP BY w.session_id, w.exercise_id, s.performed_on, s.created_at
  )
  SELECT c.session_id, c.exercise_id, e.is_bodyweight,
         c.mw, (SELECT max(x.reps)::integer FROM workout_sets x WHERE x.session_id = c.session_id AND x.exercise_id = c.exercise_id AND x.weight_kg = c.mw),
         c.tr, c.mr,
         p.id, p.performed_on, p.mw,
         (SELECT max(x.reps)::integer FROM workout_sets x WHERE x.session_id = p.id AND x.exercise_id = c.exercise_id AND x.weight_kg = p.mw),
         p.tr, p.mr,
         a.mw, a.mr, COALESCE(a.n, 0)
  FROM cur c
  JOIN exercises e ON e.id = c.exercise_id
  LEFT JOIN LATERAL (
    SELECT s2.id, s2.performed_on, max(x.weight_kg) AS mw, sum(x.reps)::integer AS tr, max(x.reps)::integer AS mr
    FROM workout_sessions s2 JOIN workout_sets x ON x.session_id = s2.id AND x.exercise_id = c.exercise_id
    WHERE s2.user_id = p_user AND (s2.performed_on, s2.created_at) < (c.performed_on, c.created_at)
    GROUP BY s2.id, s2.performed_on, s2.created_at
    ORDER BY s2.performed_on DESC, s2.created_at DESC LIMIT 1
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT max(x.weight_kg) AS mw, max(x.reps)::integer AS mr, count(DISTINCT x.session_id) AS n
    FROM workout_sets x JOIN workout_sessions s3 ON s3.id = x.session_id
    WHERE x.user_id = p_user AND x.exercise_id = c.exercise_id AND (s3.performed_on, s3.created_at) < (c.performed_on, c.created_at)
  ) a ON true;
$$;

-- Programma hisobotining xom ma'lumoti: davrdagi mashg'ulotlar (eskidan yangiga), har biri to'liq (mashqlar va padxodlar)
CREATE OR REPLACE FUNCTION public.workout_program_sessions(p_user uuid, p_program uuid, p_from date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(workout_session_detail(p_user, x.id) ORDER BY x.performed_on, x.created_at), '[]'::jsonb)
  FROM (SELECT s.id, s.performed_on, s.created_at FROM workout_sessions s
        WHERE s.user_id = p_user AND s.program_id = p_program AND (p_from IS NULL OR s.performed_on >= p_from)
        ORDER BY s.performed_on DESC, s.created_at DESC LIMIT 500) x;
$$;

-- Ulashish: faqat chatda gaplashgan odamga (trener ↔ shogird suhbati bo'lishi shart). Faol ulashish bo'lsa — o'sha qaytadi.
-- Qaytadi: { share_id, conversation_id, created }
CREATE OR REPLACE FUNCTION public.workout_share_program(p_owner uuid, p_program uuid, p_viewer uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  conv uuid; sid uuid; was boolean := false;
BEGIN
  PERFORM 1 FROM workout_programs WHERE id = p_program AND user_id = p_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'WORKOUT_PROGRAM_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT id INTO conv FROM conversations
  WHERE (trainer_id = p_viewer AND user_id = p_owner) OR (trainer_id = p_owner AND user_id = p_viewer)
  ORDER BY last_message_at DESC NULLS LAST LIMIT 1;
  IF conv IS NULL OR p_viewer = p_owner THEN RAISE EXCEPTION 'WORKOUT_SHARE_NO_CHAT' USING ERRCODE = 'P0002'; END IF;
  SELECT id INTO sid FROM workout_report_shares WHERE program_id = p_program AND viewer_id = p_viewer AND revoked_at IS NULL;
  IF sid IS NULL THEN
    INSERT INTO workout_report_shares (owner_id, program_id, viewer_id) VALUES (p_owner, p_program, p_viewer)
    ON CONFLICT (program_id, viewer_id) WHERE revoked_at IS NULL DO NOTHING
    RETURNING id INTO sid;
    IF sid IS NULL THEN
      SELECT id INTO sid FROM workout_report_shares WHERE program_id = p_program AND viewer_id = p_viewer AND revoked_at IS NULL;
    ELSE was := true; END IF;
  END IF;
  RETURN jsonb_build_object('share_id', sid, 'conversation_id', conv, 'created', was);
END $$;

-- Ulashilgan hisobotga kirish: faqat egasi yoki tanlangan trener, to'xtatilmagan bo'lsa. Aks holda NULL.
CREATE OR REPLACE FUNCTION public.workout_share_access(p_user uuid, p_share uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('share_id', r.id, 'owner_id', r.owner_id, 'program_id', r.program_id, 'viewer_id', r.viewer_id,
    'is_owner', r.owner_id = p_user, 'created_at', r.created_at,
    'owner', (SELECT jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'avatar_url', pr.avatar_url) FROM profiles pr WHERE pr.id = r.owner_id))
  FROM workout_report_shares r
  WHERE r.id = p_share AND r.revoked_at IS NULL AND (r.viewer_id = p_user OR r.owner_id = p_user);
$$;

-- Programmaning faol ulashishlari (egasi uchun)
CREATE OR REPLACE FUNCTION public.workout_program_shares(p_owner uuid, p_program uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'created_at', r.created_at,
    'viewer', jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'avatar_url', pr.avatar_url)) ORDER BY r.created_at DESC), '[]'::jsonb)
  FROM workout_report_shares r JOIN profiles pr ON pr.id = r.viewer_id
  WHERE r.owner_id = p_owner AND r.program_id = p_program AND r.revoked_at IS NULL;
$$;

-- Kimga yuborish mumkin: chatdagi trenerlar (foydalanuvchi shogird bo'lgan suhbatlar)
CREATE OR REPLACE FUNCTION public.workout_share_targets(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'avatar_url', pr.avatar_url, 'conversation_id', c.id)
                            ORDER BY c.last_message_at DESC NULLS LAST), '[]'::jsonb)
  FROM conversations c JOIN profiles pr ON pr.id = c.trainer_id
  WHERE c.user_id = p_user AND c.trainer_id <> p_user;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'workout_program_get(uuid, uuid)', 'workout_create_program(uuid, text, jsonb, integer, integer)',
    'workout_set_split_items(uuid, uuid, jsonb)', 'workout_save_split(uuid, uuid, uuid, text, jsonb, integer)',
    'workout_save_session(uuid, uuid, uuid, text, date, integer, text, jsonb)', 'workout_session_detail(uuid, uuid)',
    'workout_overview(uuid, date)', 'workout_progress(uuid)', 'workout_outcome_rows(uuid, uuid[])',
    'workout_program_sessions(uuid, uuid, date)', 'workout_share_program(uuid, uuid, uuid)', 'workout_share_access(uuid, uuid)',
    'workout_program_shares(uuid, uuid)', 'workout_share_targets(uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.workout_split_json(public.workout_splits), public.workout_program_json(public.workout_programs) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- TEKSHIRUV
-- ---------------------------------------------------------------------------
SELECT 'v37: programmalar' AS tekshiruv,
       CASE WHEN to_regclass('public.workout_programs') IS NOT NULL AND to_regclass('public.workout_report_shares') IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM public.workout_splits WHERE program_id IS NULL)
        THEN 'OK' ELSE 'XATO' END AS natija
UNION ALL
SELECT 'v37: programmalar soni', (SELECT count(*)::text FROM public.workout_programs);
