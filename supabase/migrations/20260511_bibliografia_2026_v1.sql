-- 20260511_bibliografia_2026_v1.sql
-- V1: Práctica con bibliografía 2026
-- - Preguntas desde public.preguntas_bibliografia_2026
-- - No usa corregida
-- - Oculta solo anuladas
-- - Resultados, estadísticas y ranking separados de bancos oficiales

-- Lectura de preguntas bibliográficas no anuladas
alter table public.preguntas_bibliografia_2026 enable row level security;

drop policy if exists "Authenticated read bibliografia 2026 questions" on public.preguntas_bibliografia_2026;
create policy "Authenticated read bibliografia 2026 questions"
on public.preguntas_bibliografia_2026
for select
to authenticated
using (coalesce(anulada, false) = false);

grant select on public.preguntas_bibliografia_2026 to authenticated;

-- Sesiones separadas de la práctica bibliográfica
create table if not exists public.bibliografia_2026_sesiones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  modo text not null default 'rapida' check (modo in ('rapida', 'especialidad_tema', 'examen_relacionado')),
  especialidad text,
  tema text,
  examen_relacionado text,
  total integer not null default 0 check (total >= 0),
  correctas integer not null default 0 check (correctas >= 0),
  incorrectas integer not null default 0 check (incorrectas >= 0),
  pct integer not null default 0 check (pct >= 0 and pct <= 100),
  tiempo integer check (tiempo is null or tiempo >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bibliografia_2026_sesiones_user_created_idx
on public.bibliografia_2026_sesiones (user_id, created_at desc);

create index if not exists bibliografia_2026_sesiones_ranking_idx
on public.bibliografia_2026_sesiones (pct desc, total desc, tiempo asc nulls last);

alter table public.bibliografia_2026_sesiones enable row level security;

drop policy if exists "Users read own bibliografia 2026 sessions" on public.bibliografia_2026_sesiones;
create policy "Users read own bibliografia 2026 sessions"
on public.bibliografia_2026_sesiones
for select
to authenticated
using (auth.uid() = user_id);

grant select on public.bibliografia_2026_sesiones to authenticated;

-- Respuestas separadas para estadísticas propias
create table if not exists public.bibliografia_2026_respuestas (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references public.bibliografia_2026_sesiones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pregunta_id uuid not null references public.preguntas_bibliografia_2026(id) on delete cascade,
  respuesta_elegida text check (respuesta_elegida is null or respuesta_elegida in ('a','b','c','d')),
  respuesta_correcta text check (respuesta_correcta is null or respuesta_correcta in ('a','b','c','d')),
  correcta boolean not null default false,
  especialidad text,
  tema text,
  examen_relacionado text,
  fuente text,
  created_at timestamptz not null default now()
);

create index if not exists bibliografia_2026_respuestas_user_created_idx
on public.bibliografia_2026_respuestas (user_id, created_at desc);

create index if not exists bibliografia_2026_respuestas_user_tema_idx
on public.bibliografia_2026_respuestas (user_id, tema);

create index if not exists bibliografia_2026_respuestas_user_especialidad_idx
on public.bibliografia_2026_respuestas (user_id, especialidad);

alter table public.bibliografia_2026_respuestas enable row level security;

drop policy if exists "Users read own bibliografia 2026 answers" on public.bibliografia_2026_respuestas;
create policy "Users read own bibliografia 2026 answers"
on public.bibliografia_2026_respuestas
for select
to authenticated
using (auth.uid() = user_id);

grant select on public.bibliografia_2026_respuestas to authenticated;

-- Catálogo para pantalla inicial y filtros
create or replace function public.get_bibliografia_2026_catalog()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select *
    from public.preguntas_bibliografia_2026
    where coalesce(anulada, false) = false
  ),
  esp as (
    select coalesce(especialidad, 'Sin especialidad') as label, count(*)::int as total
    from base
    group by 1
    order by 2 desc, 1
  ),
  temas as (
    select coalesce(especialidad, 'Sin especialidad') as especialidad,
           coalesce(tema, 'Sin tema') as tema,
           count(*)::int as total
    from base
    group by 1, 2
    order by 1, 3 desc, 2
  ),
  examenes_flat as (
    select unnest(coalesce(examenes, array[]::text[])) as examen
    from base
  ),
  examenes_ag as (
    select examen, count(*)::int as total
    from examenes_flat
    where nullif(btrim(examen), '') is not null
    group by examen
    order by 2 desc, 1
  )
  select jsonb_build_object(
    'total', (select count(*)::int from base),
    'especialidades', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'total', total)) from esp), '[]'::jsonb),
    'temas', coalesce((select jsonb_agg(jsonb_build_object('especialidad', especialidad, 'tema', tema, 'total', total)) from temas), '[]'::jsonb),
    'examenes', coalesce((select jsonb_agg(jsonb_build_object('label', examen, 'total', total)) from examenes_ag), '[]'::jsonb)
  );
$$;

grant execute on function public.get_bibliografia_2026_catalog() to authenticated;

-- Obtiene preguntas random según modo/filtros
create or replace function public.get_preguntas_bibliografia_2026(
  p_limit integer default 20,
  p_especialidad text default null,
  p_tema text default null,
  p_examen_relacionado text default null
)
returns table (
  id uuid,
  pregunta text,
  opciones jsonb,
  respuesta text,
  tipo text,
  especialidad text,
  tema text,
  num_original integer,
  fuente text,
  examenes text[],
  pista text,
  explicaciones jsonb
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.pregunta,
    p.opciones,
    lower(nullif(btrim(p.respuesta), '')) as respuesta,
    p.tipo,
    p.especialidad,
    p.tema,
    p.num_original,
    p.fuente,
    p.examenes,
    p.pista,
    p.explicaciones
  from public.preguntas_bibliografia_2026 p
  where coalesce(p.anulada, false) = false
    and (nullif(btrim(p_especialidad), '') is null or p.especialidad = p_especialidad)
    and (nullif(btrim(p_tema), '') is null or p.tema = p_tema)
    and (
      nullif(btrim(p_examen_relacionado), '') is null
      or p.examenes @> array[p_examen_relacionado]::text[]
    )
    and lower(nullif(btrim(p.respuesta), '')) in ('a','b','c','d')
    and p.opciones ? 'a'
    and p.opciones ? 'b'
    and p.opciones ? 'c'
    and p.opciones ? 'd'
  order by random()
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

grant execute on function public.get_preguntas_bibliografia_2026(integer, text, text, text) to authenticated;

-- Submit seguro: recalcula correctas desde la tabla de preguntas.
create or replace function public.submit_bibliografia_2026_session(
  p_modo text,
  p_especialidad text default null,
  p_tema text default null,
  p_examen_relacionado text default null,
  p_tiempo integer default null,
  p_respuestas jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_username text;
  v_session_id uuid;
  v_total integer := 0;
  v_correctas integer := 0;
  v_incorrectas integer := 0;
  v_pct integer := 0;
  v_modo text := coalesce(nullif(btrim(p_modo), ''), 'rapida');
begin
  if v_user is null then
    raise exception 'Usuario no autenticado';
  end if;

  if v_modo not in ('rapida', 'especialidad_tema', 'examen_relacionado') then
    v_modo := 'rapida';
  end if;

  if p_respuestas is null or jsonb_typeof(p_respuestas) <> 'array' then
    raise exception 'Formato inválido de respuestas';
  end if;

  create temporary table tmp_bibliografia_2026_answers on commit drop as
  select distinct on (pregunta_id)
    pregunta_id,
    respuesta_elegida
  from (
    select
      nullif(value->>'pregunta_id', '')::uuid as pregunta_id,
      lower(nullif(btrim(value->>'respuesta_elegida'), '')) as respuesta_elegida,
      ordinality
    from jsonb_array_elements(p_respuestas) with ordinality
  ) x
  where pregunta_id is not null
    and respuesta_elegida in ('a','b','c','d')
  order by pregunta_id, ordinality;

  select count(*)::int into v_total
  from tmp_bibliografia_2026_answers;

  if v_total <= 0 then
    raise exception 'No hay respuestas válidas para guardar';
  end if;

  select count(*)::int into v_correctas
  from tmp_bibliografia_2026_answers a
  join public.preguntas_bibliografia_2026 p on p.id = a.pregunta_id
  where coalesce(p.anulada, false) = false
    and lower(nullif(btrim(p.respuesta), '')) = a.respuesta_elegida;

  v_incorrectas := greatest(0, v_total - v_correctas);
  v_pct := case when v_total > 0 then round((100.0 * v_correctas / v_total))::int else 0 end;

  select username into v_username
  from public.profiles
  where id = v_user;

  insert into public.bibliografia_2026_sesiones (
    user_id,
    username,
    modo,
    especialidad,
    tema,
    examen_relacionado,
    total,
    correctas,
    incorrectas,
    pct,
    tiempo,
    metadata
  ) values (
    v_user,
    coalesce(nullif(v_username, ''), 'Usuario'),
    v_modo,
    nullif(btrim(p_especialidad), ''),
    nullif(btrim(p_tema), ''),
    nullif(btrim(p_examen_relacionado), ''),
    v_total,
    v_correctas,
    v_incorrectas,
    v_pct,
    greatest(0, coalesce(p_tiempo, 0)),
    jsonb_build_object('source', 'bibliografia_2026')
  ) returning id into v_session_id;

  insert into public.bibliografia_2026_respuestas (
    sesion_id,
    user_id,
    pregunta_id,
    respuesta_elegida,
    respuesta_correcta,
    correcta,
    especialidad,
    tema,
    examen_relacionado,
    fuente
  )
  select
    v_session_id,
    v_user,
    p.id,
    a.respuesta_elegida,
    lower(nullif(btrim(p.respuesta), '')),
    lower(nullif(btrim(p.respuesta), '')) = a.respuesta_elegida,
    p.especialidad,
    p.tema,
    coalesce(nullif(btrim(p_examen_relacionado), ''), array_to_string(p.examenes, ', ')),
    p.fuente
  from tmp_bibliografia_2026_answers a
  join public.preguntas_bibliografia_2026 p on p.id = a.pregunta_id
  where coalesce(p.anulada, false) = false;

  return jsonb_build_object(
    'session_id', v_session_id,
    'total', v_total,
    'correctas', v_correctas,
    'incorrectas', v_incorrectas,
    'pct', v_pct,
    'tiempo', greatest(0, coalesce(p_tiempo, 0))
  );
end;
$$;

grant execute on function public.submit_bibliografia_2026_session(text, text, text, text, integer, jsonb) to authenticated;

-- Ranking separado, con la misma lógica base del ranking oficial.
create or replace function public.get_ranking_bibliografia_2026()
returns table (
  user_id uuid,
  username text,
  sesiones integer,
  total_preguntas integer,
  total_correctas integer,
  pct_historico integer,
  mejor_pct integer,
  mejor_total integer,
  mejor_correctas integer,
  mejor_tiempo integer
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with agg as (
    select
      s.user_id,
      coalesce(max(nullif(s.username, '')), 'Usuario') as username,
      count(*)::int as sesiones,
      coalesce(sum(s.total), 0)::int as total_preguntas,
      coalesce(sum(s.correctas), 0)::int as total_correctas,
      case when coalesce(sum(s.total), 0) > 0
        then round(100.0 * sum(s.correctas) / nullif(sum(s.total), 0))::int
        else 0
      end as pct_historico
    from public.bibliografia_2026_sesiones s
    group by s.user_id
  ),
  best as (
    select distinct on (s.user_id)
      s.user_id,
      s.pct as mejor_pct,
      s.total as mejor_total,
      s.correctas as mejor_correctas,
      s.tiempo as mejor_tiempo
    from public.bibliografia_2026_sesiones s
    where s.total >= 5
    order by s.user_id, s.pct desc, s.total desc, s.tiempo asc nulls last, s.created_at desc
  )
  select
    a.user_id,
    a.username,
    a.sesiones,
    a.total_preguntas,
    a.total_correctas,
    a.pct_historico,
    coalesce(b.mejor_pct, 0) as mejor_pct,
    coalesce(b.mejor_total, 0) as mejor_total,
    coalesce(b.mejor_correctas, 0) as mejor_correctas,
    coalesce(b.mejor_tiempo, 0) as mejor_tiempo
  from agg a
  left join best b on b.user_id = a.user_id
  order by a.pct_historico desc, a.total_preguntas desc, a.sesiones desc;
$$;

grant execute on function public.get_ranking_bibliografia_2026() to authenticated;

-- Estadísticas propias del usuario autenticado.
create or replace function public.get_bibliografia_2026_my_stats()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with me as (
    select auth.uid() as uid
  ),
  sess as (
    select s.*
    from public.bibliografia_2026_sesiones s, me
    where s.user_id = me.uid
  ),
  resp as (
    select r.*
    from public.bibliografia_2026_respuestas r, me
    where r.user_id = me.uid
  ),
  overview as (
    select jsonb_build_object(
      'sesiones', count(*)::int,
      'total_preguntas', coalesce(sum(total), 0)::int,
      'total_correctas', coalesce(sum(correctas), 0)::int,
      'total_incorrectas', coalesce(sum(incorrectas), 0)::int,
      'pct_historico', case when coalesce(sum(total), 0) > 0 then round(100.0 * sum(correctas) / nullif(sum(total), 0))::int else 0 end,
      'mejor_pct', coalesce(max(pct), 0)::int
    ) as value
    from sess
  ),
  by_esp as (
    select coalesce(jsonb_agg(item order by (item->>'total')::int desc, item->>'label'), '[]'::jsonb) as value
    from (
      select jsonb_build_object(
        'label', coalesce(especialidad, 'Sin especialidad'),
        'total', count(*)::int,
        'correctas', count(*) filter (where correcta)::int,
        'pct', case when count(*) > 0 then round(100.0 * count(*) filter (where correcta) / count(*))::int else 0 end
      ) as item
      from resp
      group by coalesce(especialidad, 'Sin especialidad')
    ) x
  ),
  by_tema as (
    select coalesce(jsonb_agg(item order by (item->>'total')::int desc, item->>'label'), '[]'::jsonb) as value
    from (
      select jsonb_build_object(
        'label', coalesce(tema, 'Sin tema'),
        'especialidad', coalesce(max(especialidad), 'Sin especialidad'),
        'total', count(*)::int,
        'correctas', count(*) filter (where correcta)::int,
        'pct', case when count(*) > 0 then round(100.0 * count(*) filter (where correcta) / count(*))::int else 0 end
      ) as item
      from resp
      group by coalesce(tema, 'Sin tema')
    ) x
  ),
  by_exam as (
    select coalesce(jsonb_agg(item order by (item->>'total')::int desc, item->>'label'), '[]'::jsonb) as value
    from (
      select jsonb_build_object(
        'label', coalesce(examen_relacionado, 'Sin examen relacionado'),
        'total', count(*)::int,
        'correctas', count(*) filter (where correcta)::int,
        'pct', case when count(*) > 0 then round(100.0 * count(*) filter (where correcta) / count(*))::int else 0 end
      ) as item
      from resp
      group by coalesce(examen_relacionado, 'Sin examen relacionado')
    ) x
  ),
  recent as (
    select coalesce(jsonb_agg(item order by item->>'created_at' desc), '[]'::jsonb) as value
    from (
      select jsonb_build_object(
        'id', id,
        'modo', modo,
        'especialidad', especialidad,
        'tema', tema,
        'examen_relacionado', examen_relacionado,
        'total', total,
        'correctas', correctas,
        'incorrectas', incorrectas,
        'pct', pct,
        'tiempo', tiempo,
        'created_at', created_at
      ) as item
      from sess
      order by created_at desc
      limit 12
    ) x
  )
  select jsonb_build_object(
    'overview', (select value from overview),
    'by_especialidad', (select value from by_esp),
    'by_tema', (select value from by_tema),
    'by_examen', (select value from by_exam),
    'recent_sessions', (select value from recent)
  );
$$;

grant execute on function public.get_bibliografia_2026_my_stats() to authenticated;
