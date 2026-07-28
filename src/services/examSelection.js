/*
 * ResiAR — selección pura de preguntas para examen.
 *
 * Este módulo centraliza banco/año, selector mixto, especialidad y tema sin
 * mutar el banco global `preguntas`. El cliente solo filtra lo que Supabase ya
 * devolvió; la seguridad por plan sigue dependiendo de RLS/servidor.
 */

export function getQuestionYear(question) {
  const explicit = question && (question.anio ?? question.año ?? question.year);
  if (explicit !== undefined && explicit !== null && explicit !== '') return String(explicit);

  const match = String((question && question.examen) || '').match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : 's/año';
}

export function getQuestionBankKey(question, options = {}) {
  const exam = (question && question.examen) || '';
  const provinceValue = options.provinceValue || '__PROVINCIA_BA__';
  const unifiedValue = options.unifiedValue || '__EU__';

  try {
    if (typeof options.isProvinceExam === 'function' && options.isProvinceExam(exam)) return provinceValue;
  } catch (_) {}

  try {
    if (typeof options.isUnifiedExam === 'function' && options.isUnifiedExam(exam)) return unifiedValue;
  } catch (_) {}

  return String(exam || 'Sin examen');
}

export function getMixedPairKey(question, options = {}) {
  return `${getQuestionBankKey(question, options)}::${getQuestionYear(question)}`;
}

export function normalizeSelectionList(value) {
  if (value instanceof Set) return [...value].map(String).filter(Boolean);
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [];
}

function normalizeTopicFilterList(options = {}) {
  const fromList = normalizeSelectionList(options.topicTexts);
  if (fromList.length) return fromList;

  const single = String(options.topicText || '').trim();
  return single ? [single] : [];
}


function normalizeTopicProximityToken(value) {
  let token = String(value || '').trim().toLowerCase();
  if (!token) return '';
  if (token.length > 6 && token.endsWith('ciones')) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith('iones')) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

function topicProximityTokens(value, normalizeText) {
  const normalized = typeof normalizeText === 'function'
    ? normalizeText(value)
    : String(value || '').trim().toLowerCase();
  return String(normalized || '')
    .split(/\s+/)
    .map(normalizeTopicProximityToken)
    .filter(token => token && token.length >= 3);
}

export function topicMatchesFilter(questionTopic, selectedTopic, normalizeText) {
  const q = typeof normalizeText === 'function'
    ? normalizeText(questionTopic)
    : String(questionTopic || '').trim().toLowerCase();
  const selected = typeof normalizeText === 'function'
    ? normalizeText(selectedTopic)
    : String(selectedTopic || '').trim().toLowerCase();

  if (!q || !selected) return false;
  if (q.includes(selected) || selected.includes(q)) return true;

  const selectedTokens = topicProximityTokens(selected, (v) => String(v || ''));
  if (!selectedTokens.length) return false;

  const questionTokenSet = new Set(topicProximityTokens(q, (v) => String(v || '')));
  if (!questionTokenSet.size) return false;

  return selectedTokens.every(token => questionTokenSet.has(token));
}

export function topicMatchesExact(questionTopic, selectedTopic, normalizeText) {
  const q = typeof normalizeText === 'function'
    ? normalizeText(questionTopic)
    : String(questionTopic || '').trim().toLowerCase();
  const selected = typeof normalizeText === 'function'
    ? normalizeText(selectedTopic)
    : String(selectedTopic || '').trim().toLowerCase();

  return !!q && !!selected && q === selected;
}

export function questionMatchesAnyTopic(question, selectedTopics, options = {}) {
  const topics = normalizeSelectionList(selectedTopics);
  if (!topics.length) return true;
  const getTopic = typeof options.getTopic === 'function'
    ? options.getTopic
    : (item) => item && (item.tema_v2 || item.tema || '');
  const normalizeText = typeof options.normalizeText === 'function'
    ? options.normalizeText
    : (value) => String(value || '').trim().toLowerCase();
  const matchMode = String(options.matchMode || 'exact').toLowerCase();
  const questionTopic = getTopic(question);
  return topics.some(topic => (matchMode === 'proximity' || matchMode === 'wide')
    ? topicMatchesFilter(questionTopic, topic, normalizeText)
    : topicMatchesExact(questionTopic, topic, normalizeText)
  );
}

export function shuffleCopy(items, random = Math.random) {
  const out = (Array.isArray(items) ? items : []).slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function originalPaperKey(question) {
  const exam = String((question && question.examen) || 'Sin examen').trim();
  const year = getQuestionYear(question);
  return `${exam}::${year}`;
}

function isSingleConcreteOriginalPaper(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return false;
  const keys = new Set();
  for (const q of list) {
    const year = getQuestionYear(q);
    if (!year || year === 's/año') return false;
    keys.add(originalPaperKey(q));
    if (keys.size > 1) return false;
  }
  return keys.size === 1;
}

export function buildExamQuestionPool(options = {}) {
  const questions = Array.isArray(options.questions) ? options.questions : [];
  const examValue = options.examValue || 'todos';
  const yearValue = options.yearValue || 'todos';
  const provinceValue = options.provinceValue || '__PROVINCIA_BA__';
  const unifiedValue = options.unifiedValue || '__EU__';
  const includeSpecialty = options.includeSpecialty !== false;
  const includeTopic = options.includeTopic !== false;
  const shuffleWhenUnfiltered = options.shuffleWhenUnfiltered !== false;

  const pairOptions = {
    provinceValue,
    unifiedValue,
    isProvinceExam: options.isProvinceExam,
    isUnifiedExam: options.isUnifiedExam
  };

  const diagnostics = {
    totalInitial: questions.length,
    totalAfterBankYear: questions.length,
    totalAfterSpecialty: questions.length,
    totalAfterTopic: questions.length,
    mixedSelected: normalizeSelectionList(options.mixedSelectedKeys),
    examValue,
    yearValue,
    isSpecificExam: false,
    preservesOriginalOrder: false,
    shouldShuffleOrder: false,
    originalPaperCount: 0,
    applied: []
  };

  let pool = questions.slice();
  const selectedMixed = new Set(diagnostics.mixedSelected);

  if (selectedMixed.size) {
    pool = pool.filter(question => selectedMixed.has(getMixedPairKey(question, pairOptions)));
    diagnostics.isSpecificExam = true;
    diagnostics.applied.push('mixed_bank_year');
  } else {
    if (examValue === provinceValue) {
      pool = pool.filter(question => {
        try { return typeof options.isProvinceExam === 'function' && options.isProvinceExam(question.examen); }
        catch (_) { return false; }
      });
      diagnostics.isSpecificExam = true;
      diagnostics.applied.push('province_bank');
    } else if (examValue === unifiedValue) {
      pool = pool.filter(question => {
        try { return typeof options.isUnifiedExam === 'function' && options.isUnifiedExam(question.examen); }
        catch (_) { return false; }
      });
      diagnostics.isSpecificExam = true;
      diagnostics.applied.push('unified_bank');
    } else if (examValue && examValue !== 'todos') {
      pool = pool.filter(question => question.examen == examValue);
      diagnostics.isSpecificExam = true;
      diagnostics.applied.push('exact_bank');
    }

    if (yearValue && yearValue !== 'todos') {
      pool = pool.filter(question => getQuestionYear(question) === String(yearValue));
      diagnostics.isSpecificExam = true;
      diagnostics.applied.push('year');
    }
  }

  diagnostics.totalAfterBankYear = pool.length;

  const sortByOriginalOrder = typeof options.sortByOriginalOrder === 'function'
    ? options.sortByOriginalOrder
    : (items) => (Array.isArray(items) ? items : []).slice();

  const bankYearPool = pool.slice();
  diagnostics.originalPaperCount = new Set(bankYearPool.map(originalPaperKey)).size;
  diagnostics.preservesOriginalOrder = diagnostics.isSpecificExam && isSingleConcreteOriginalPaper(bankYearPool);
  diagnostics.shouldShuffleOrder = !diagnostics.preservesOriginalOrder && shuffleWhenUnfiltered;

  if (!diagnostics.isSpecificExam && shuffleWhenUnfiltered) {
    pool = shuffleCopy(pool, typeof options.random === 'function' ? options.random : Math.random);
    diagnostics.applied.push('shuffle_unfiltered');
  }

  if (includeSpecialty) {
    const selectedSpecialties = new Set(normalizeSelectionList(options.selectedSpecialtyRaws));
    if (selectedSpecialties.size) {
      const getSpecialty = typeof options.getSpecialty === 'function'
        ? options.getSpecialty
        : (question) => question && (question.especialidad_v2 || question.especialidad || 'General');
      pool = pool.filter(question => selectedSpecialties.has(getSpecialty(question)));
      diagnostics.applied.push('specialty');
    }
  }

  diagnostics.totalAfterSpecialty = pool.length;

  if (includeTopic) {
    const normalizeText = typeof options.normalizeText === 'function'
      ? options.normalizeText
      : (value) => String(value || '').trim().toLowerCase();

    const rawTopics = normalizeTopicFilterList(options);
    const normalizedTopics = [
      ...new Set(
        rawTopics
          .map(topic => normalizeText(topic))
          .filter(Boolean)
      )
    ];

    diagnostics.topicTexts = rawTopics;
    diagnostics.topicCount = normalizedTopics.length;

    if (normalizedTopics.length) {
      const getTopic = typeof options.getTopic === 'function'
        ? options.getTopic
        : (question) => question && (question.tema_v2 || question.tema || '');

      pool = pool.filter(question =>
        questionMatchesAnyTopic(question, rawTopics, {
          getTopic,
          normalizeText
        })
      );

      diagnostics.applied.push(normalizedTopics.length > 1 ? 'topic_multi' : 'topic');
    }
  }

  diagnostics.totalAfterTopic = pool.length;

  if (diagnostics.preservesOriginalOrder) {
    pool = sortByOriginalOrder(pool);
    diagnostics.applied.push('original_order_single_paper');
  } else if (diagnostics.isSpecificExam && shuffleWhenUnfiltered) {
    pool = shuffleCopy(pool, typeof options.random === 'function' ? options.random : Math.random);
    diagnostics.applied.push('shuffle_mixed_papers');
  }

  diagnostics.totalFinal = pool.length;

  return {
    questions: pool,
    isSpecificExam: diagnostics.isSpecificExam,
    diagnostics
  };
}
