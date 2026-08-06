-- Mueve pg_trgm, unaccent y vector fuera de public (hardening de seguridad,
-- advisor "Extension in Public" de Supabase). pg_net se queda en public
-- porque no es relocatable (ALTER EXTENSION ... SET SCHEMA falla para esa
-- extensión puntual).
--
-- Las funciones que dependían de estas extensiones tenían SET search_path
-- TO 'public' fijo (hardening previo contra search_path injection), así
-- que hay que agregarles 'extensions' al search_path o dejan de resolver
-- unaccent()/similarity()/el tipo vector y el operador <=>.
--
-- Aplicado y verificado en producción el 2026-08-06: buscar_bibliografia,
-- buscar_bibliografia_hybrid y search_questions_full_bank_v78 probadas
-- end-to-end post-migración con resultados idénticos al baseline.

ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

ALTER FUNCTION public.buscar_bibliografia(vector, double precision, integer)
  SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.buscar_bibliografia_hybrid(vector, text, double precision, integer)
  SET search_path TO 'public', 'extensions';
ALTER FUNCTION public.search_questions_full_bank_v78(text, integer)
  SET search_path TO 'public', 'extensions';
