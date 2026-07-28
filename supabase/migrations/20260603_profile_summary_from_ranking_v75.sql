-- ============================================================
-- RESIAR - v75
-- Perfil: resumen global con la misma fuente que el ranking.
--
-- Objetivo:
-- - Evitar que el perfil recalcule el acumulado histórico desde las últimas
--   50 sesiones.
-- - Reutilizar get_ranking_global() como fuente canónica para sesiones,
--   preguntas, correctas, porcentaje histórico y mejor sesión.
-- ============================================================

create or replace function public.get_user_profile_summary(target_user_id uuid default null)
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
  select
    rg.user_id,
    rg.username,
    rg.sesiones,
    rg.total_preguntas,
    rg.total_correctas,
    rg.pct_historico,
    rg.mejor_pct,
    rg.mejor_total,
    rg.mejor_correctas
  from public.get_ranking_global() rg
  where rg.user_id = coalesce(target_user_id, auth.uid())
  limit 1;
$$;

grant execute on function public.get_user_profile_summary(uuid) to authenticated;
