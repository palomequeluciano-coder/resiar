-- 20260528_fix_submit_bibliografia_2026_session.sql
-- La función submit_bibliografia_2026_session estaba definida en
-- 20260511_bibliografia_2026_v1.sql pero nunca se aplicó al schema.
-- Este archivo la aplica de forma idempotente (solo la función, sin recrear
-- las tablas ni políticas que ya existen).

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
  v_user      uuid := auth.uid();
  v_username  text;
  v_session_id uuid;
  v_total      integer := 0;
  v_correctas  integer := 0;
  v_incorrectas integer := 0;
  v_pct        integer := 0;
  v_modo       text := coalesce(nullif(btrim(p_modo), ''), 'rapida');
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
    user_id, username, modo, especialidad, tema, examen_relacionado,
    total, correctas, incorrectas, pct, tiempo, metadata
  ) values (
    v_user,
    coalesce(nullif(v_username, ''), 'Usuario'),
    v_modo,
    nullif(btrim(p_especialidad), ''),
    nullif(btrim(p_tema), ''),
    nullif(btrim(p_examen_relacionado), ''),
    v_total, v_correctas, v_incorrectas, v_pct,
    greatest(0, coalesce(p_tiempo, 0)),
    jsonb_build_object('source', 'bibliografia_2026')
  ) returning id into v_session_id;

  insert into public.bibliografia_2026_respuestas (
    sesion_id, user_id, pregunta_id, respuesta_elegida, respuesta_correcta,
    correcta, especialidad, tema, examen_relacionado, fuente
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

revoke all on function public.submit_bibliografia_2026_session(text, text, text, text, integer, jsonb) from public, anon;
grant execute on function public.submit_bibliografia_2026_session(text, text, text, text, integer, jsonb) to authenticated;
