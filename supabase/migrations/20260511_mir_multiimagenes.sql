-- 20260511_mir_multiimagenes.sql
-- Soporte de varias imágenes por pregunta para MIR 2024/2025.
-- Idempotente. Ejecutar en Supabase SQL Editor.

begin;

alter table public.preguntas
add column if not exists imagen_path text,
add column if not exists imagen_alt text,
add column if not exists imagen_caption text,
add column if not exists imagenes_paths jsonb;

insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read question images" on storage.objects;

create policy "Public read question images"
on storage.objects
for select
using (bucket_id = 'question-images');

with imagenes_mir as (
  select
    (m[1])::int as anio,
    (m[2])::int as num_original,
    coalesce(m[3], '') as sufijo,
    o.name as imagen_path
  from storage.objects o
  cross join lateral regexp_match(
    o.name,
    '^preguntas/MIR_(2024|2025)_([0-9]+)([a-zA-Z])?\.(jpg|jpeg|png|webp)$'
  ) as m
  where o.bucket_id = 'question-images'
),
agrupadas as (
  select
    anio,
    num_original,
    array_agg(imagen_path order by num_original, sufijo, imagen_path) as paths
  from imagenes_mir
  group by anio, num_original
)
update public.preguntas p
set
  imagen_path = a.paths[1],
  imagenes_paths = to_jsonb(a.paths),
  imagen_alt = coalesce(
    p.imagen_alt,
    'Imagen de la pregunta ' || p.num_original || ' del MIR ' || p.anio
  )
from agrupadas a
where p.examen = 'MIR'
  and p.anio in (2024, 2025)
  and p.num_original = a.num_original;

commit;
