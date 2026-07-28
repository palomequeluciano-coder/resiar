create or replace function public.get_vaccine_practice_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  has_access boolean := false;
  payload jsonb;
begin
  begin
    has_access := coalesce(public.can_access_bibliografia_2026(), false);
  exception when others then
    has_access := exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.plan in ('admin', 'pro', 'trial_activo')
          or p.trial_activado_at is not null
        )
    );
  end;

  if auth.uid() is null or not has_access then
    return jsonb_build_object(
      'allowed', false,
      'vaccines', '[]'::jsonb,
      'products', '[]'::jsonb,
      'sources', '[]'::jsonb,
      'cases', '[]'::jsonb
    );
  end if;

  select jsonb_build_object(
    'allowed', true,
    'vaccines', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'codigo', v.codigo,
          'nombre', v.nombre,
          'descripcion', v.descripcion,
          'grupo', coalesce(nullif(v.tipo_vacuna, ''), case when v.solo_zona_riesgo then 'zona de riesgo' else 'calendario' end),
          'solo_zona_riesgo', coalesce(v.solo_zona_riesgo, false),
          'requiere_orden_medica', coalesce(v.requiere_orden_medica, false),
          'tipo_vacuna', v.tipo_vacuna,
          'enfermedades_que_previene', v.enfermedades_que_previene,
          'contraindicaciones', v.contraindicaciones,
          'poblacion_riesgo', v.poblacion_riesgo,
          'via_administracion', v.via_administracion,
          'conservacion', v.conservacion,
          'presentacion', v.presentacion,
          'efectos_adversos', v.efectos_adversos,
          'url_fuente', v.url_fuente
        )
        order by v.id
      )
      from public.vacunas v
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'codigo', vp.codigo,
          'vacuna_codigo', vp.vacuna_codigo,
          'nombre', vp.nombre,
          'tipo_producto', vp.tipo_producto,
          'valencia', vp.valencia,
          'marca_comercial', vp.marca_comercial,
          'vigente', vp.vigente,
          'fuente_codigo', vp.fuente_codigo,
          'notas', vp.notas
        )
        order by vp.codigo
      )
      from public.vacuna_productos vp
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'codigo', vf.codigo,
          'titulo', vf.titulo,
          'tipo', vf.tipo,
          'anio', vf.anio,
          'vigente', vf.vigente,
          'url', vf.url,
          'notas', vf.notas
        )
        order by vf.codigo
      )
      from public.vacuna_fuentes vf
    ), '[]'::jsonb),
    'cases', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'nombre', n.nombre,
          'caso_clinico', n.caso_clinico,
          'motivo_consulta', n.motivo_consulta,
          'visita_motivo', n.visita_motivo,
          'categoria', n.categoria,
          'dificultad', n.dificultad,
          'zona_riesgo', coalesce(n.zona_riesgo, false),
          'sexo', n.sexo,
          'es_prematuro', coalesce(n.es_prematuro, false),
          'semanas_gestacion', n.semanas_gestacion,
          'condicion_especial', n.condicion_especial,
          'historial_vacunal', coalesce(n.historial_vacunal, '[]'::jsonb),
          'condiciones_medicas', coalesce(n.condiciones_medicas, '[]'::jsonb),
          'vacunas_correctas', coalesce(n.vacunas_correctas, '[]'::jsonb),
          'vacunas_incorrectas', coalesce(n.vacunas_incorrectas, '[]'::jsonb),
          'vacunas_previas', coalesce(n.vacunas_previas, '[]'::jsonb),
          'respuesta_sin_vacuna', coalesce(n.respuesta_sin_vacuna, false),
          'motivo_no_vacunar', n.motivo_no_vacunar,
          'fuente_principal_codigo', n.fuente_principal_codigo,
          'estado_validacion', n.estado_validacion,
          'explicacion', n.explicacion
        )
        order by n.id
      )
      from public.ninos n
      where jsonb_array_length(coalesce(n.vacunas_correctas, '[]'::jsonb)) > 0
         or coalesce(n.respuesta_sin_vacuna, false) = true
    ), '[]'::jsonb)
  )
  into payload;

  return payload;
end;
$$;

revoke all on function public.get_vaccine_practice_data() from public;
grant execute on function public.get_vaccine_practice_data() to authenticated;
