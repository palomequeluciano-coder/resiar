-- ============================================================
-- RESIAR v71 - límite estructural de sesiones seguras
-- Objetivo:
--   - Permitir que selecciones explícitas de banco/año/especialidad/tema
--     entreguen todo el pool filtrado.
--   - Mantener el límite bajo de pool aleatorio en frontend.
--   - No modifica tablas ni políticas; solo reemplaza funciones RPC.
-- ============================================================

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
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 1000);
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

revoke execute on function public.get_exam_session_v69(text[], integer, text, jsonb) from public;
revoke execute on function public.get_exam_session_v69(text[], integer, text, jsonb) from anon;
grant execute on function public.get_exam_session_v69(text[], integer, text, jsonb) to authenticated;

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
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 1000);
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

revoke execute on function public.get_balanced_question_ids_v1(text[], integer, text, jsonb) from public;
revoke execute on function public.get_balanced_question_ids_v1(text[], integer, text, jsonb) from anon;
grant execute on function public.get_balanced_question_ids_v1(text[], integer, text, jsonb) to authenticated;
