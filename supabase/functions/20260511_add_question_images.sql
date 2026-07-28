alter table public.preguntas
add column if not exists imagen_path text,
add column if not exists imagen_alt text,
add column if not exists imagen_caption text;

insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read question images" on storage.objects;

create policy "Public read question images"
on storage.objects
for select
using (bucket_id = 'question-images');
