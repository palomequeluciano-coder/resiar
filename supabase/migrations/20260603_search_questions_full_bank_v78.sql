-- RESIAR v78 - búsqueda real de preguntas en todo el banco
-- El frontend no vuelve a leer public.preguntas directamente.
-- La búsqueda vive en backend, respeta acceso por plan y devuelve solo catálogo + preview.

create or replace function public.search_questions_full_bank_v78(
  p_query text,
  p_limit integer default 60
)
returns table(
  id text,
  examen text,
  anio integer,
  tipo text,
  especialidad text,
  tema text,
  especialidad_v2 text,
  tema_v2 text,
  num_original integer,
  corregida boolean,
  anulada boolean,
  imagen_path text,
  imagenes_paths jsonb,
  imagen_alt text,
  imagen_caption text,
  preview_text text,
  search_rank integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_query text := btrim(coalesce(p_query, ''));
  v_query_norm text := unaccent(lower(btrim(coalesce(p_query, ''))));
  v_limit integer := least(greatest(coalesce(p_limit, 60), 1), 100);
  v_is_admin boolean := false;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if length(v_query_norm) < 2 then
    return;
  end if;

  select exists (
    select 1
    from public.profiles pr
    where pr.id = v_user_id
      and pr.plan = 'admin'
  ) into v_is_admin;

  return query
  with terms as (
    select array_remove(regexp_split_to_array(v_query_norm, '\s+'), '') as tokens
  ),
  searchable as (
    select
      q.id,
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
      left(regexp_replace(coalesce(q.pregunta, ''), '\s+', ' ', 'g'), 420) as preview_text,
      unaccent(lower(concat_ws(' ',
        q.id,
        q.examen,
        q.anio::text,
        q.tipo,
        q.especialidad,
        q.tema,
        q.especialidad_v2,
        q.tema_v2,
        q.num_original::text,
        q.pregunta,
        q.opciones::text,
        q.imagen_alt,
        q.imagen_caption,
        q.repetida_en::text
      ))) as haystack,
      unaccent(lower(coalesce(q.pregunta, ''))) as pregunta_norm,
      unaccent(lower(coalesce(q.tema_v2, q.tema, ''))) as tema_norm,
      unaccent(lower(coalesce(q.especialidad_v2, q.especialidad, ''))) as especialidad_norm,
      unaccent(lower(coalesce(q.examen, ''))) as examen_norm
    from public.preguntas q
    left join public.preguntas_eliminadas e on e.id = q.id
    where e.id is null
      and (v_is_admin or public.pregunta_visible_para_usuario(q.examen, q.id))
  ),
  matched as (
    select
      s.*,
      (
        case when s.pregunta_norm like '%' || v_query_norm || '%' then 10000 else 0 end +
        case when s.tema_norm like '%' || v_query_norm || '%' then 2500 else 0 end +
        case when s.especialidad_norm like '%' || v_query_norm || '%' then 1800 else 0 end +
        case when s.examen_norm like '%' || v_query_norm || '%' then 900 else 0 end +
        case when s.haystack like '%' || v_query_norm || '%' then 600 else 0 end +
        coalesce((
          select sum(case
            when s.pregunta_norm like '%' || token || '%' then 180
            when s.haystack like '%' || token || '%' then 60
            else 0
          end)
          from unnest((select tokens from terms)) token
        ), 0)
      )::integer as rank_value
    from searchable s
    where (select bool_and(s.haystack like '%' || token || '%') from unnest((select tokens from terms)) token)
  )
  select
    m.id,
    m.examen,
    m.anio,
    m.tipo,
    m.especialidad,
    m.tema,
    m.especialidad_v2,
    m.tema_v2,
    m.num_original,
    m.corregida,
    coalesce(m.anulada, false) as anulada,
    m.imagen_path,
    m.imagenes_paths,
    m.imagen_alt,
    m.imagen_caption,
    m.preview_text,
    m.rank_value as search_rank
  from matched m
  where m.rank_value > 0
  order by m.rank_value desc, m.examen nulls last, m.anio nulls last, m.num_original nulls last, m.id
  limit v_limit;
end;
$$;

revoke execute on function public.search_questions_full_bank_v78(text, integer) from public;
revoke execute on function public.search_questions_full_bank_v78(text, integer) from anon;
grant execute on function public.search_questions_full_bank_v78(text, integer) to authenticated;
