-- ============================================================
-- RESIAR v69B - Sesiones seguras de examen
-- Objetivo:
--   - El frontend pide solo las preguntas de una sesión.
--   - La respuesta correcta no viaja antes de responder.
--   - La corrección se valida en backend por pregunta.
--   - Se registra auditoría básica de entrega/corrección.
-- ============================================================

create table if not exists public.secure_exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mode text not null default 'exam',
  requested_count integer not null default 0,
  delivered_count integer not null default 0,
  filters jsonb not null default '{}'::jsonb,
  question_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 hours')
);

create table if not exists public.secure_exam_session_answers (
  id bigserial primary key,
  session_id uuid not null references public.secure_exam_sessions(id) on delete cascade,
  user_id uuid not null,
  question_id text not null,
  selected_answer text not null,
  correct_answer text,
  is_correct boolean not null default false,
  is_annulled boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (session_id, question_id)
);

alter table public.secure_exam_sessions enable row level security;
alter table public.secure_exam_session_answers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'secure_exam_sessions'
      and policyname = 'secure_exam_sessions_select_own'
  ) then
    create policy secure_exam_sessions_select_own
    on public.secure_exam_sessions
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'secure_exam_session_answers'
      and policyname = 'secure_exam_session_answers_select_own'
  ) then
    create policy secure_exam_session_answers_select_own
    on public.secure_exam_session_answers
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;
end $$;

create index if not exists idx_secure_exam_sessions_user_created
on public.secure_exam_sessions (user_id, created_at desc);

create index if not exists idx_secure_exam_answers_user_session
on public.secure_exam_session_answers (user_id, session_id);

create or replace function public.get_exam_session_v69(
  p_question_ids text[] default '{}'::text[],
  p_limit integer default 100,
  p_mode text default 'exam',
  p_filters jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 120);
  v_requested integer := coalesce(array_length(p_question_ids, 1), 0);
  v_recent_sessions integer := 0;
  v_delivered_ids text[] := '{}'::text[];
  v_questions jsonb := '[]'::jsonb;
  v_delivered integer := 0;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if v_requested <= 0 then
    raise exception 'No se recibieron preguntas para la sesión';
  end if;

  select count(*)
    into v_recent_sessions
  from public.secure_exam_sessions
  where user_id = v_user_id
    and created_at > now() - interval '10 minutes';

  if v_recent_sessions >= 20 then
    raise exception 'Demasiadas sesiones solicitadas. Esperá unos minutos y reintentá.';
  end if;

  with requested as (
    select distinct on (id)
      id,
      ord
    from unnest(p_question_ids) with ordinality as t(id, ord)
    where nullif(trim(id), '') is not null
    order by id, ord
  ),
  selected as (
    select
      q.id,
      q.pregunta,
      q.opciones,
      q.examen,
      q.anio,
      q.tipo,
      q.especialidad,
      q.tema,
      q.especialidad_v2,
      q.tema_v2,
      q.num_original,
      q.corregida,
      q.anulada,
      q.imagen_path,
      q.imagenes_paths,
      q.imagen_alt,
      q.imagen_caption,
      r.ord
    from requested r
    join public.preguntas q
      on q.id = r.id
    order by r.ord
    limit v_limit
  )
  select
    coalesce(array_agg(id order by ord), '{}'::text[]),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'pregunta', pregunta,
          'opciones', opciones,
          'examen', examen,
          'anio', anio,
          'tipo', tipo,
          'especialidad', especialidad,
          'tema', tema,
          'especialidad_v2', especialidad_v2,
          'tema_v2', tema_v2,
          'num_original', num_original,
          'corregida', corregida,
          'anulada', coalesce(anulada, false),
          'imagen_path', imagen_path,
          'imagenes_paths', imagenes_paths,
          'imagen_alt', imagen_alt,
          'imagen_caption', imagen_caption,
          '_resiarServerOrder', ord
        )
        order by ord
      ),
      '[]'::jsonb
    ),
    count(*)
  into v_delivered_ids, v_questions, v_delivered
  from selected;

  if v_delivered <= 0 then
    raise exception 'No se encontraron preguntas disponibles para esta sesión';
  end if;

  insert into public.secure_exam_sessions (
    user_id,
    mode,
    requested_count,
    delivered_count,
    filters,
    question_ids
  ) values (
    v_user_id,
    left(coalesce(nullif(trim(p_mode), ''), 'exam'), 64),
    v_requested,
    v_delivered,
    coalesce(p_filters, '{}'::jsonb),
    v_delivered_ids
  )
  returning id into v_session_id;

  return jsonb_build_object(
    'session_id', v_session_id,
    'requested_count', v_requested,
    'delivered_count', v_delivered,
    'expires_at', (select expires_at from public.secure_exam_sessions where id = v_session_id),
    'questions', v_questions
  );
end;
$$;

create or replace function public.submit_exam_answer_v69(
  p_session_id uuid,
  p_question_id text,
  p_selected_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.secure_exam_sessions%rowtype;
  v_correct_raw text;
  v_correct text;
  v_selected text := lower(trim(coalesce(p_selected_answer, '')));
  v_is_annulled boolean := false;
  v_is_correct boolean := false;
  v_anulada boolean := false;
  v_answered_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if p_session_id is null then
    raise exception 'Sesión inválida';
  end if;

  if nullif(trim(coalesce(p_question_id, '')), '') is null then
    raise exception 'Pregunta inválida';
  end if;

  if v_selected = '' then
    raise exception 'Respuesta inválida';
  end if;

  select *
    into v_session
  from public.secure_exam_sessions
  where id = p_session_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Sesión no encontrada';
  end if;

  if v_session.expires_at < now() then
    raise exception 'La sesión de examen expiró';
  end if;

  if not (p_question_id = any(v_session.question_ids)) then
    raise exception 'La pregunta no pertenece a esta sesión';
  end if;

  select respuesta, coalesce(anulada, false)
    into v_correct_raw, v_anulada
  from public.preguntas
  where id = p_question_id;

  if not found then
    raise exception 'Pregunta no encontrada';
  end if;

  v_correct := lower(trim(coalesce(v_correct_raw, '')));
  v_is_annulled := v_anulada or v_correct in ('', 'null', 'anulada', 'anulado');
  v_is_correct := (not v_is_annulled) and v_selected = v_correct;

  insert into public.secure_exam_session_answers (
    session_id,
    user_id,
    question_id,
    selected_answer,
    correct_answer,
    is_correct,
    is_annulled,
    answered_at
  ) values (
    p_session_id,
    v_user_id,
    p_question_id,
    v_selected,
    nullif(v_correct, ''),
    v_is_correct,
    v_is_annulled,
    v_answered_at
  )
  on conflict (session_id, question_id)
  do update set
    selected_answer = excluded.selected_answer,
    correct_answer = excluded.correct_answer,
    is_correct = excluded.is_correct,
    is_annulled = excluded.is_annulled,
    answered_at = excluded.answered_at;

  return jsonb_build_object(
    'session_id', p_session_id,
    'question_id', p_question_id,
    'selected_answer', v_selected,
    'correct_answer', nullif(v_correct, ''),
    'is_correct', v_is_correct,
    'is_annulled', v_is_annulled,
    'answered_at', v_answered_at
  );
end;
$$;

revoke execute on function public.get_exam_session_v69(text[], integer, text, jsonb) from public;
revoke execute on function public.get_exam_session_v69(text[], integer, text, jsonb) from anon;
grant execute on function public.get_exam_session_v69(text[], integer, text, jsonb) to authenticated;

revoke execute on function public.submit_exam_answer_v69(uuid, text, text) from public;
revoke execute on function public.submit_exam_answer_v69(uuid, text, text) from anon;
grant execute on function public.submit_exam_answer_v69(uuid, text, text) to authenticated;
