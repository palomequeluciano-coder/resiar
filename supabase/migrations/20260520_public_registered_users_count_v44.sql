-- v44: public registered user counter for landing.
-- Returns only an aggregate count; no profile data is exposed.

create or replace function public.get_registered_users_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.profiles;
$$;

grant execute on function public.get_registered_users_count() to anon, authenticated, service_role;


-- v49: contador combinado usado por la landing pública.
create or replace function public.get_public_landing_counters()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'questions', (select count(*)::integer from public.preguntas where coalesce(anulada, false) = false),
    'specialties', (select count(distinct especialidad)::integer from public.preguntas where especialidad is not null and trim(especialidad) <> ''),
    'registered_users', (select count(*)::integer from public.profiles),
    'updated_at', now()
  );
$$;

grant execute on function public.get_public_landing_counters() to anon, authenticated, service_role;
