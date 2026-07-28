create or replace function public.get_registered_users_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(count(*)::integer, 0)
  from public.profiles;
$$;

grant execute on function public.get_registered_users_count() to anon, authenticated, service_role;
