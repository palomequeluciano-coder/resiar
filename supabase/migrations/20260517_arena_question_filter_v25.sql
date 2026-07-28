-- Arena v25: harden question selection.
-- Exclude null/blank answers, annulled questions, empty statements, and empty options.

create or replace function public.arena_pick_questions(
  p_scope text,
  p_count integer,
  p_seed text default null,
  p_filters jsonb default '{}'::jsonb
)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(id order by sort_key), '{}'::text[])
  from (
    select
      p.id,
      md5(coalesce(p_seed, '') || ':' || p.id) as sort_key
    from public.preguntas p
    left join public.preguntas_trial_cache tc on tc.pregunta_id = p.id
    where coalesce(p.anulada, false) = false
      and nullif(trim(coalesce(p.respuesta, '')), '') is not null
      and nullif(trim(coalesce(p.pregunta, '')), '') is not null
      and p.opciones is not null
      and jsonb_typeof(p.opciones) = 'object'
      and jsonb_array_length(jsonb_path_query_array(p.opciones, '$.* ? (@ != null && @ != "")')) > 0
      and (p_scope = 'full' or tc.pregunta_id is not null)
      and (coalesce(p_filters->>'especialidad', '') = '' or p.especialidad = p_filters->>'especialidad')
      and (coalesce(p_filters->>'tema', '') = '' or p.tema = p_filters->>'tema')
      and (coalesce(p_filters->>'examen', '') = '' or p.examen = p_filters->>'examen')
    order by sort_key
    limit greatest(1, least(coalesce(p_count, 10), 100))
  ) q;
$$;

grant execute on function public.arena_pick_questions(text, integer, text, jsonb) to authenticated, service_role;
