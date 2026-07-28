-- ============================================================
-- RESIAR - Fase 63
-- Vista por pregunta para examen por errores.
-- No modifica ni borra datos existentes.
-- ============================================================

create or replace view public.user_question_performance
with (security_invoker = true)
as
with base as (
  select
    id,
    user_id,
    question_id,
    especialidad,
    tema,
    subtema,
    selected_answer,
    correct_answer,
    is_correct,
    is_answered,
    is_annulled,
    time_ms,
    created_at
  from public.exam_answers
  where question_id is not null
    and question_id <> ''
    and is_answered = true
    and is_annulled = false
), ranked as (
  select
    base.*,
    row_number() over (
      partition by user_id, question_id
      order by created_at desc, id desc
    ) as rn,
    count(*) over (
      partition by user_id, question_id
    ) as total_attempts,
    count(*) filter (where is_correct = true) over (
      partition by user_id, question_id
    ) as correct_attempts,
    count(*) filter (where is_correct = false) over (
      partition by user_id, question_id
    ) as wrong_attempts,
    avg(time_ms) filter (where time_ms is not null) over (
      partition by user_id, question_id
    ) as avg_time_ms
  from base
)
select
  user_id,
  question_id,
  especialidad,
  tema,
  subtema,
  total_attempts,
  wrong_attempts,
  correct_attempts,
  created_at as last_answer_at,
  is_correct as last_is_correct,
  selected_answer as last_selected_answer,
  correct_answer,
  avg_time_ms,
  case
    when wrong_attempts >= 2 and is_correct = false then 'error_recurrente'
    when wrong_attempts > 0 and is_correct = false then 'error_activo'
    when wrong_attempts > 0 and is_correct = true then 'error_corregido'
    else 'dominada'
  end as error_state
from ranked
where rn = 1;

grant select on public.user_question_performance to authenticated;
