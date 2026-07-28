-- 20260703_bibliografia_2026_catalog_por_examen.sql
-- Corrección estructural del módulo Bibliografía 2026:
-- 1) El catálogo ahora expone el cruce especialidad/tema × examen relacionado,
--    para que el frontend pueda ocultar temas (y especialidades) sin preguntas
--    para el examen elegido, en vez de mostrar combinaciones vacías.
-- 2) get_preguntas_bibliografia_2026 eleva el techo de p_limit para soportar
--    la selección de "todas las preguntas disponibles" de un tema/examen.

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
  ),
  base_por_examen as (
    select
      b.*,
      unnest(coalesce(b.examenes, array[]::text[])) as examen
    from base b
  ),
  base_por_examen_valido as (
    select *
    from base_por_examen
    where nullif(btrim(examen), '') is not null
  ),
  esp_por_examen as (
    select
      examen,
      coalesce(especialidad, 'Sin especialidad') as especialidad,
      count(*)::int as total
    from base_por_examen_valido
    group by 1, 2
    order by 1, 3 desc, 2
  ),
  temas_por_examen as (
    select
      examen,
      coalesce(especialidad, 'Sin especialidad') as especialidad,
      coalesce(tema, 'Sin tema') as tema,
      count(*)::int as total
    from base_por_examen_valido
    group by 1, 2, 3
    order by 1, 2, 4 desc, 3
  )
  select jsonb_build_object(
    'total', (select count(*)::int from base),
    'especialidades', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'total', total)) from esp), '[]'::jsonb),
    'temas', coalesce((select jsonb_agg(jsonb_build_object('especialidad', especialidad, 'tema', tema, 'total', total)) from temas), '[]'::jsonb),
    'examenes', coalesce((select jsonb_agg(jsonb_build_object('label', examen, 'total', total)) from examenes_ag), '[]'::jsonb),
    'especialidades_por_examen', coalesce((select jsonb_agg(jsonb_build_object('examen', examen, 'especialidad', especialidad, 'total', total)) from esp_por_examen), '[]'::jsonb),
    'temas_por_examen', coalesce((select jsonb_agg(jsonb_build_object('examen', examen, 'especialidad', especialidad, 'tema', tema, 'total', total)) from temas_por_examen), '[]'::jsonb)
  );
$$;

grant execute on function public.get_bibliografia_2026_catalog() to authenticated;

-- Eleva el techo de preguntas devueltas por consulta (antes 100) para permitir
-- traer "todas" las preguntas disponibles de un tema/examen con muchas preguntas.
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
  limit greatest(1, least(coalesce(p_limit, 20), 300));
$$;

grant execute on function public.get_preguntas_bibliografia_2026(integer, text, text, text) to authenticated;
