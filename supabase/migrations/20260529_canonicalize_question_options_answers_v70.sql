create or replace function public.resiar_answer_key_to_letter(p_value text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(p_value, '')))
    when '0' then 'a'
    when '1' then 'b'
    when '2' then 'c'
    when '3' then 'd'
    when '4' then 'e'
    when '5' then 'f'
    when '6' then 'g'
    when '7' then 'h'
    else lower(trim(coalesce(p_value, '')))
  end;
$$;

create or replace function public.resiar_canonical_options(p_options jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when p_options is null then '{}'::jsonb
    when jsonb_typeof(p_options) = 'array' then coalesce((
      select jsonb_object_agg(chr(96 + ord::int), value order by ord)
      from jsonb_array_elements(p_options) with ordinality as e(value, ord)
      where ord between 1 and 26
    ), '{}'::jsonb)
    when jsonb_typeof(p_options) = 'object' then coalesce((
      select jsonb_object_agg(public.resiar_answer_key_to_letter(key), value order by key)
      from jsonb_each(p_options) as e(key, value)
      where nullif(public.resiar_answer_key_to_letter(key), '') is not null
    ), '{}'::jsonb)
    else '{}'::jsonb
  end;
$$;

update public.preguntas
set
  opciones = public.resiar_canonical_options(opciones),
  respuesta = nullif(public.resiar_answer_key_to_letter(respuesta), '')
where
  jsonb_typeof(opciones) <> 'object'
  or exists (
    select 1
    from jsonb_object_keys(case when jsonb_typeof(opciones) = 'object' then opciones else '{}'::jsonb end) as k(key)
    where k.key ~ '^[0-7]$'
  )
  or respuesta ~ '^[0-7]$';
