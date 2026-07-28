create or replace function public.get_question_search_previews_v1(
  p_question_ids text[] default '{}'::text[],
  p_limit integer default 30
)
returns table(question_id text, preview_text text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 60);
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  return query
  with requested as (
    select distinct on (id)
      trim(id) as id,
      ord
    from unnest(coalesce(p_question_ids, '{}'::text[])) with ordinality as t(id, ord)
    where nullif(trim(id), '') is not null
    order by trim(id), ord
  )
  select
    q.id as question_id,
    left(regexp_replace(coalesce(q.pregunta, ''), '\s+', ' ', 'g'), 360) as preview_text
  from requested r
  join public.preguntas q on q.id = r.id
  left join public.preguntas_eliminadas e on e.id = q.id
  where e.id is null
  order by r.ord
  limit v_limit;
end;
$function$;

grant execute on function public.get_question_search_previews_v1(text[], integer) to authenticated;
