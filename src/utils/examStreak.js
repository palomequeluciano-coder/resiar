function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function isAnswered(value) {
  return value != null && String(value).trim() !== '';
}

function clampIndex(index, length) {
  const n = Number(index);
  if (!Number.isFinite(n)) return Math.max(0, length - 1);
  return Math.max(0, Math.min(Math.floor(n), Math.max(0, length - 1)));
}

function findStreakAnchor(answers, preferredIndex) {
  const list = toArray(answers);
  if (!list.length) return -1;

  const start = clampIndex(preferredIndex, list.length);
  if (isAnswered(list[start])) return start;

  for (let i = start - 1; i >= 0; i--) {
    if (isAnswered(list[i])) return i;
  }

  for (let i = list.length - 1; i > start; i--) {
    if (isAnswered(list[i])) return i;
  }

  return -1;
}

export function calculateCorrectAnswerStreak(exam, answers, preferredIndex, isQuestionVoided) {
  const questions = toArray(exam);
  const values = toArray(answers);
  if (!questions.length || !values.length) return 0;

  const anchor = findStreakAnchor(values, preferredIndex);
  if (anchor < 0) return 0;

  let streak = 0;
  for (let i = anchor; i >= 0; i--) {
    const question = questions[i];
    if (typeof preferredIndex === 'number' && !question && i >= questions.length) continue;

    if (typeof isQuestionVoided === 'function' && isQuestionVoided(question)) continue;

    const answer = values[i];
    if (!isAnswered(answer)) break;

    const correct = question?.respuesta;
    if (!isAnswered(correct)) continue;

    if (String(answer) === String(correct)) streak++;
    else break;
  }

  return streak;
}
