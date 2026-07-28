-- 20260511_clear_missing_question_images.sql
-- Limpia imagen_path cuando el objeto no existe en Supabase Storage.
-- Esto evita que el frontend intente renderizar imágenes inexistentes.

update public.preguntas p
set imagen_path = null
where p.imagen_path is not null
  and not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'question-images'
      and o.name = p.imagen_path
  );
