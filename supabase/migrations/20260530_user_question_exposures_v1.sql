-- ============================================================
-- RESIAR - Random balanceado por usuario
-- Objetivo:
--   - Evitar repetir preguntas en pools aleatorios hasta agotar las menos vistas.
--   - Registrar una vista solo cuando la pregunta se renderiza en pantalla.
--   - Mantener el orden original de exámenes específicos fuera de esta lógica.
-- ============================================================

create table if not exists public.user_question_exposures (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.preguntas(id) on delete cascade,
  seen_count integer not null default 0 check (seen_count >= 0),
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  last_mode text,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table if not exists public.user_question_exposure_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.secure_exam_sessions(id) on delete cascade,
  question_id text not null references public.preguntas(id) on delete cascade,
  mode text not null default 'exam',
  seen_at timestamptz not null default now(),
  primary key (user_id, session_id, question_id)
);

alter table public.user_question_exposures enable row level security;
alter table public.user_question_exposure_events enable row level security;

create index if not exists idx_user_question_exposures_user_seen
on public.user_question_exposures (user_id, seen_count, last_seen_at nulls first);

create index if not exists idx_user_question_exposure_events_user_question
on public.user_question_exposure_events (user_id, question_id, seen_at desc);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_question_exposures'
      and policyname = 'user_question_exposures_select_own'
  ) then
    create policy user_question_exposures_select_own
    on public.user_question_exposures
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_question_exposure_events'
      and policyname = 'user_question_exposure_events_select_own'
  ) then
    create policy user_question_exposure_events_select_own
    on public.user_question_exposure_events
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;
end $$;

create or replace function public.get_balanced_question_ids_v1(
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
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 120);
  v_requested integer := coalesce(array_length(p_question_ids, 1), 0);
  v_ids text[] := '{}'::text[];
  v_returned integer := 0;
  v_min_seen integer := 0;
  v_max_seen integer := 0;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if v_requested <= 0 then
    raise exception 'No se recibieron preguntas para balancear';
  end if;

  with requested as (
    select distinct on (id)
      trim(id) as id,
      ord
    from unnest(p_question_ids) with ordinality as t(id, ord)
    where nullif(trim(id), '') is not null
    order by id, ord
  ),
  eligible as (
    select
      r.id,
      r.ord,
      coalesce(e.seen_count, 0) as seen_count,
      e.last_seen_at,
      random() as tie_breaker
    from requested r
    join public.preguntas q
      on q.id = r.id
    left join public.user_question_exposures e
      on e.user_id = v_user_id
     and e.question_id = r.id
  ),
  selected as (
    select *
    from eligible
    order by seen_count asc, tie_breaker asc, ord asc
    limit v_limit
  )
  select
    coalesce(array_agg(id order by seen_count asc, tie_breaker asc, ord asc), '{}'::text[]),
    count(*),
    coalesce(min(seen_count), 0),
    coalesce(max(seen_count), 0)
  into v_ids, v_returned, v_min_seen, v_max_seen
  from selected;

  if v_returned <= 0 then
    raise exception 'No se encontraron preguntas elegibles para balancear';
  end if;

  return jsonb_build_object(
    'question_ids', v_ids,
    'requested_count', v_requested,
    'returned_count', v_returned,
    'diagnostics', jsonb_build_object(
      'mode', coalesce(nullif(trim(p_mode), ''), 'exam'),
      'limit', v_limit,
      'min_seen_count', v_min_seen,
      'max_seen_count', v_max_seen,
      'filters', coalesce(p_filters, '{}'::jsonb)
    )
  );
end;
$$;

create or replace function public.mark_question_seen_v1(
  p_question_id text,
  p_mode text default 'exam',
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_question_id text := trim(coalesce(p_question_id, ''));
  v_mode text := left(coalesce(nullif(trim(p_mode), ''), 'exam'), 64);
  v_seen_count integer := 0;
  v_rows integer := 0;
  v_incremented boolean := true;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if v_question_id = '' then
    raise exception 'Pregunta inválida';
  end if;

  if not exists (select 1 from public.preguntas where id = v_question_id) then
    raise exception 'Pregunta no encontrada';
  end if;

  if p_session_id is not null then
    if not exists (
      select 1
      from public.secure_exam_sessions s
      where s.id = p_session_id
        and s.user_id = v_user_id
        and v_question_id = any(s.question_ids)
    ) then
      raise exception 'La pregunta no pertenece a una sesión válida del usuario';
    end if;

    insert into public.user_question_exposure_events (
      user_id,
      session_id,
      question_id,
      mode,
      seen_at
    ) values (
      v_user_id,
      p_session_id,
      v_question_id,
      v_mode,
      now()
    )
    on conflict (user_id, session_id, question_id) do nothing;

    get diagnostics v_rows = row_count;
    v_incremented := v_rows > 0;
  end if;

  if v_incremented then
    insert into public.user_question_exposures (
      user_id,
      question_id,
      seen_count,
      first_seen_at,
      last_seen_at,
      last_mode,
      updated_at
    ) values (
      v_user_id,
      v_question_id,
      1,
      now(),
      now(),
      v_mode,
      now()
    )
    on conflict (user_id, question_id)
    do update set
      seen_count = public.user_question_exposures.seen_count + 1,
      first_seen_at = coalesce(public.user_question_exposures.first_seen_at, excluded.first_seen_at),
      last_seen_at = excluded.last_seen_at,
      last_mode = excluded.last_mode,
      updated_at = excluded.updated_at;
  end if;

  select coalesce(seen_count, 0)
    into v_seen_count
  from public.user_question_exposures
  where user_id = v_user_id
    and question_id = v_question_id;

  return jsonb_build_object(
    'question_id', v_question_id,
    'session_id', p_session_id,
    'seen_count', coalesce(v_seen_count, 0),
    'incremented', v_incremented
  );
end;
$$;

revoke execute on function public.get_balanced_question_ids_v1(text[], integer, text, jsonb) from public;
revoke execute on function public.get_balanced_question_ids_v1(text[], integer, text, jsonb) from anon;
grant execute on function public.get_balanced_question_ids_v1(text[], integer, text, jsonb) to authenticated;

revoke execute on function public.mark_question_seen_v1(text, text, uuid) from public;
revoke execute on function public.mark_question_seen_v1(text, text, uuid) from anon;
grant execute on function public.mark_question_seen_v1(text, text, uuid) to authenticated;
