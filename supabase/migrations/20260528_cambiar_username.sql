-- 20260528_cambiar_username.sql
-- RPC que permite a un usuario cambiar su propio username.
-- Reglas:
--   - Solo el propio usuario puede cambiarlo (auth.uid() = uid).
--   - 3–20 caracteres, solo letras, números y guiones bajos.
--   - Cooldown de 30 días entre cambios.
--   - El username nuevo debe ser único en profiles.
-- El frontend (profile.js) llama: sb().rpc('cambiar_username', { uid, nuevo_username })

create or replace function public.cambiar_username(
  uid uuid,
  nuevo_username text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller        uuid := auth.uid();
  v_username_norm text := lower(btrim(nuevo_username));
  v_changed_at    timestamptz;
  v_dias          numeric;
begin
  -- El llamador debe ser el propio usuario
  if v_caller is null or v_caller <> uid then
    raise exception 'No autorizado';
  end if;

  -- Validar formato: 3–20 chars, solo letras ASCII, números y guión bajo
  if v_username_norm is null or length(v_username_norm) = 0 then
    raise exception 'El nombre no puede estar vacío';
  end if;
  if length(v_username_norm) < 3 then
    raise exception 'Mínimo 3 caracteres';
  end if;
  if length(v_username_norm) > 20 then
    raise exception 'Máximo 20 caracteres';
  end if;
  if v_username_norm !~ '^[a-z0-9_]+$' then
    raise exception 'Solo se permiten letras, números y guiones bajos';
  end if;

  -- Verificar cooldown de 30 días
  select username_changed_at
    into v_changed_at
    from public.profiles
   where id = v_caller;

  if v_changed_at is not null then
    v_dias := extract(epoch from (now() - v_changed_at)) / 86400.0;
    if v_dias < 30 then
      raise exception 'Podés cambiar tu username en % día%',
        ceil(30 - v_dias)::int,
        case when ceil(30 - v_dias)::int = 1 then '' else 's' end;
    end if;
  end if;

  -- Verificar unicidad (case-insensitive)
  if exists (
    select 1 from public.profiles
     where lower(username) = v_username_norm
       and id <> v_caller
  ) then
    raise exception 'Ese nombre ya está en uso';
  end if;

  -- Actualizar
  update public.profiles
     set username            = nuevo_username,
         username_changed_at = now()
   where id = v_caller;
end;
$$;

-- Solo usuarios autenticados pueden llamar a esta función
revoke all on function public.cambiar_username(uuid, text) from public, anon;
grant execute on function public.cambiar_username(uuid, text) to authenticated;
