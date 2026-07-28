-- ============================================================
-- RESIAR - v67
-- Ranking global migrado a exam_sessions.
--
-- Objetivo:
-- - Usar exam_sessions como fuente principal.
-- - Mantener resultados como legacy solo para sesiones previas a la primera
--   sesión normalizada del usuario, evitando doble conteo porque v59 también
--   escribe compatibilidad en resultados.
-- - Tomar el nombre desde profiles.username, no desde resultados.username.
-- ============================================================

create or replace function public.get_ranking_global()
returns table (
  user_id uuid,
  username text,
  sesiones integer,
  total_preguntas integer,
  total_correctas integer,
  pct_historico integer,
  mejor_pct integer,
  mejor_total integer,
  mejor_correctas integer
)
language sql
security definer
set search_path = public
as $$
with first_new_session as (
  select
    es.user_id,
    min(es.created_at) as first_new_at
  from public.exam_sessions es
  where es.user_id is not null
  group by es.user_id
),
new_sessions as (
  select
    es.user_id,
    es.created_at,
    greatest(coalesce(es.total, es.respondidas, 0), 0)::integer as total,
    greatest(coalesce(es.correctas, 0), 0)::integer as correctas,
    case
      when greatest(coalesce(es.total, es.respondidas, 0), 0) > 0 then
        round(
          greatest(coalesce(es.correctas, 0), 0)::numeric
          / nullif(greatest(coalesce(es.total, es.respondidas, 0), 0), 0)
          * 100
        )::integer
      else 0
    end as pct
  from public.exam_sessions es
  where es.user_id is not null
    and greatest(coalesce(es.total, es.respondidas, 0), 0) > 0
),
legacy_sessions as (
  select
    r.user_id,
    r.created_at::timestamptz as created_at,
    greatest(coalesce(r.total, 0), 0)::integer as total,
    greatest(coalesce(r.correctas, 0), 0)::integer as correctas,
    case
      when greatest(coalesce(r.total, 0), 0) > 0 then
        round(
          greatest(coalesce(r.correctas, 0), 0)::numeric
          / nullif(greatest(coalesce(r.total, 0), 0), 0)
          * 100
        )::integer
      else 0
    end as pct
  from public.resultados r
  left join first_new_session fns
    on fns.user_id = r.user_id
  where r.user_id is not null
    and greatest(coalesce(r.total, 0), 0) > 0
    and (
      fns.first_new_at is null
      or r.created_at::timestamptz < fns.first_new_at
    )
),
all_sessions as (
  select * from new_sessions
  union all
  select * from legacy_sessions
),
agg as (
  select
    s.user_id,
    count(*)::integer as sesiones,
    sum(s.total)::integer as total_preguntas,
    sum(s.correctas)::integer as total_correctas,
    round(
      sum(s.correctas)::numeric
      / nullif(sum(s.total), 0)
      * 100
    )::integer as pct_historico
  from all_sessions s
  group by s.user_id
),
best_session as (
  select distinct on (s.user_id)
    s.user_id,
    s.pct::integer as mejor_pct,
    s.total::integer as mejor_total,
    s.correctas::integer as mejor_correctas
  from all_sessions s
  where s.total >= 5
  order by s.user_id, s.pct desc, s.total desc, s.created_at desc
)
select
  a.user_id,
  coalesce(
    nullif(trim(p.username), ''),
    'Usuario ' || substring(a.user_id::text from 1 for 4)
  ) as username,
  a.sesiones,
  a.total_preguntas,
  a.total_correctas,
  coalesce(a.pct_historico, 0) as pct_historico,
  coalesce(bs.mejor_pct, 0) as mejor_pct,
  coalesce(bs.mejor_total, 0) as mejor_total,
  coalesce(bs.mejor_correctas, 0) as mejor_correctas
from agg a
left join public.profiles p
  on p.id = a.user_id
left join best_session bs
  on bs.user_id = a.user_id
where a.total_preguntas > 0
order by
  coalesce(a.pct_historico, 0) desc,
  a.total_preguntas desc,
  a.sesiones desc;
$$;

grant execute on function public.get_ranking_global() to authenticated;
grant execute on function public.get_ranking_global() to anon;
