-- ============================================================
-- RESIAR - Fases 58/59
-- Normalización de resultados:
--   exam_sessions = una fila por examen finalizado
--   exam_answers  = una fila por respuesta individual
--
-- Es idempotente: no elimina public.resultados.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  mode text not null default 'exam',
  total integer not null default 0 check (total >= 0),
  correctas integer not null default 0 check (correctas >= 0),
  incorrectas integer not null default 0 check (incorrectas >= 0),
  respondidas integer not null default 0 check (respondidas >= 0),
  porcentaje numeric(5,2) not null default 0 check (porcentaje >= 0 and porcentaje <= 100),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  source text not null default 'web',
  legacy_result_id uuid null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.exam_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  question_id text not null,
  especialidad text null,
  tema text null,
  subtema text null,
  selected_answer text null,
  correct_answer text null,
  is_correct boolean not null default false,
  is_answered boolean not null default true,
  is_annulled boolean not null default false,
  time_ms integer null check (time_ms is null or time_ms >= 0),
  question_index integer null check (question_index is null or question_index >= 0),
  mode text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_exam_sessions_user_created
on public.exam_sessions (user_id, created_at desc);

create index if not exists idx_exam_sessions_user_mode_created
on public.exam_sessions (user_id, mode, created_at desc);

create index if not exists idx_exam_answers_user_created
on public.exam_answers (user_id, created_at desc);

create index if not exists idx_exam_answers_session
on public.exam_answers (session_id);

create index if not exists idx_exam_answers_user_question
on public.exam_answers (user_id, question_id);

create index if not exists idx_exam_answers_user_specialty
on public.exam_answers (user_id, especialidad);

create index if not exists idx_exam_answers_user_topic
on public.exam_answers (user_id, tema);

create index if not exists idx_exam_answers_user_specialty_topic
on public.exam_answers (user_id, especialidad, tema);

create index if not exists idx_exam_answers_user_correct_created
on public.exam_answers (user_id, is_correct, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_exam_sessions_updated_at on public.exam_sessions;
create trigger trg_exam_sessions_updated_at
before update on public.exam_sessions
for each row
execute function public.set_updated_at();

alter table public.exam_sessions enable row level security;
alter table public.exam_answers enable row level security;

-- Fuerza RLS incluso si algún acceso ocurre con roles propietarios no service-role.
alter table public.exam_sessions force row level security;
alter table public.exam_answers force row level security;

drop policy if exists "Users can select own exam sessions" on public.exam_sessions;
create policy "Users can select own exam sessions"
on public.exam_sessions for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own exam sessions" on public.exam_sessions;
create policy "Users can insert own exam sessions"
on public.exam_sessions for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own exam sessions" on public.exam_sessions;
create policy "Users can update own exam sessions"
on public.exam_sessions for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own exam sessions" on public.exam_sessions;
create policy "Users can delete own exam sessions"
on public.exam_sessions for delete to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can select own exam answers" on public.exam_answers;
create policy "Users can select own exam answers"
on public.exam_answers for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own exam answers" on public.exam_answers;
create policy "Users can insert own exam answers"
on public.exam_answers for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.exam_sessions s
    where s.id = session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own exam answers" on public.exam_answers;
create policy "Users can update own exam answers"
on public.exam_answers for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.exam_sessions s
    where s.id = session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own exam answers" on public.exam_answers;
create policy "Users can delete own exam answers"
on public.exam_answers for delete to authenticated
using (auth.uid() = user_id);

-- SECURITY INVOKER evita que las vistas salteen RLS de las tablas base.
create or replace view public.user_specialty_performance
with (security_invoker = true)
as
select
  user_id,
  especialidad,
  count(*) filter (where is_answered = true and is_annulled = false) as total,
  count(*) filter (where is_correct = true and is_annulled = false) as correctas,
  count(*) filter (
    where is_answered = true
      and is_correct = false
      and is_annulled = false
  ) as incorrectas,
  round(
    (
      count(*) filter (where is_correct = true and is_annulled = false)::numeric
      / nullif(count(*) filter (where is_answered = true and is_annulled = false), 0)
    ) * 100,
    2
  ) as porcentaje,
  avg(time_ms) filter (where time_ms is not null) as avg_time_ms,
  max(created_at) as last_answer_at
from public.exam_answers
where especialidad is not null
group by user_id, especialidad;

create or replace view public.user_topic_performance
with (security_invoker = true)
as
select
  user_id,
  especialidad,
  tema,
  count(*) filter (where is_answered = true and is_annulled = false) as total,
  count(*) filter (where is_correct = true and is_annulled = false) as correctas,
  count(*) filter (
    where is_answered = true
      and is_correct = false
      and is_annulled = false
  ) as incorrectas,
  round(
    (
      count(*) filter (where is_correct = true and is_annulled = false)::numeric
      / nullif(count(*) filter (where is_answered = true and is_annulled = false), 0)
    ) * 100,
    2
  ) as porcentaje,
  avg(time_ms) filter (where time_ms is not null) as avg_time_ms,
  max(created_at) as last_answer_at
from public.exam_answers
where tema is not null
group by user_id, especialidad, tema;

grant select on public.user_specialty_performance to authenticated;
grant select on public.user_topic_performance to authenticated;
