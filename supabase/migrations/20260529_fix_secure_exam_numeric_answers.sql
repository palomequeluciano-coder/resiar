-- Corrige la corrección segura para exámenes cuyas opciones están guardadas como 0/1/2/3.
-- La UI trabaja con a/b/c/d, pero algunos bancos heredados (ECOE UNLaM) tienen keys numéricas.

create or replace function public.submit_secure_exam_answer_v69(
  p_session_id uuid,
  p_question_id text,
  p_selected_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.secure_exam_sessions%rowtype;
  v_correct_raw text;
  v_correct text;
  v_correct_display text;
  v_selected text := lower(trim(coalesce(p_selected_answer, '')));
  v_selected_display text;
  v_is_annulled boolean := false;
  v_is_correct boolean := false;
  v_anulada boolean := false;
  v_answered_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if p_session_id is null then
    raise exception 'Sesión inválida';
  end if;

  if nullif(trim(coalesce(p_question_id, '')), '') is null then
    raise exception 'Pregunta inválida';
  end if;

  if v_selected = '' then
    raise exception 'Respuesta inválida';
  end if;

  select *
    into v_session
  from public.secure_exam_sessions
  where id = p_session_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Sesión no encontrada';
  end if;

  if v_session.expires_at < now() then
    raise exception 'La sesión de examen expiró';
  end if;

  if not (p_question_id = any(v_session.question_ids)) then
    raise exception 'La pregunta no pertenece a esta sesión';
  end if;

  select respuesta, coalesce(anulada, false)
    into v_correct_raw, v_anulada
  from public.preguntas
  where id = p_question_id;

  if not found then
    raise exception 'Pregunta no encontrada';
  end if;

  v_correct := lower(trim(coalesce(v_correct_raw, '')));

  v_selected_display := case v_selected
    when '0' then 'a'
    when '1' then 'b'
    when '2' then 'c'
    when '3' then 'd'
    when '4' then 'e'
    when '5' then 'f'
    when '6' then 'g'
    when '7' then 'h'
    else v_selected
  end;

  v_correct_display := case v_correct
    when '0' then 'a'
    when '1' then 'b'
    when '2' then 'c'
    when '3' then 'd'
    when '4' then 'e'
    when '5' then 'f'
    when '6' then 'g'
    when '7' then 'h'
    else v_correct
  end;

  v_is_annulled := v_anulada or v_correct_display in ('', 'null', 'anulada', 'anulado');
  v_is_correct := (not v_is_annulled) and v_selected_display = v_correct_display;

  insert into public.secure_exam_session_answers (
    session_id,
    user_id,
    question_id,
    selected_answer,
    correct_answer,
    is_correct,
    is_annulled,
    answered_at
  ) values (
    p_session_id,
    v_user_id,
    p_question_id,
    v_selected_display,
    nullif(v_correct_display, ''),
    v_is_correct,
    v_is_annulled,
    v_answered_at
  )
  on conflict (session_id, question_id)
  do update set
    selected_answer = excluded.selected_answer,
    correct_answer = excluded.correct_answer,
    is_correct = excluded.is_correct,
    is_annulled = excluded.is_annulled,
    answered_at = excluded.answered_at;

  return jsonb_build_object(
    'session_id', p_session_id,
    'question_id', p_question_id,
    'selected_answer', v_selected_display,
    'submitted_answer', v_selected,
    'correct_answer', nullif(v_correct_display, ''),
    'raw_correct_answer', nullif(v_correct, ''),
    'is_correct', v_is_correct,
    'is_annulled', v_is_annulled,
    'answered_at', v_answered_at
  );
end;
$$;

revoke execute on function public.submit_secure_exam_answer_v69(uuid, text, text) from public;
revoke execute on function public.submit_secure_exam_answer_v69(uuid, text, text) from anon;
grant execute on function public.submit_secure_exam_answer_v69(uuid, text, text) to authenticated;
