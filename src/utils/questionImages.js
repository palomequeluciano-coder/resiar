const QUESTION_IMAGES_CACHE_VERSION_KEY = 'resiar_question_images_cache_version';

function browserWindow() {
  return typeof window !== 'undefined' ? window : null;
}

function safeLocalStorage() {
  try {
    return browserWindow()?.localStorage || null;
  } catch (_) {
    return null;
  }
}

function addUniquePath(paths, value) {
  const clean = normalizeQuestionImagePath(value);
  if (clean && !paths.includes(clean)) paths.push(clean);
}

function collectPathsFromValue(value, paths) {
  if (value === undefined || value === null) return;

  if (Array.isArray(value)) {
    value.forEach(item => collectPathsFromValue(item, paths));
    return;
  }

  if (typeof value === 'object') {
    const direct = value.path || value.url || value.src || value.file || value.name || '';
    if (direct) addUniquePath(paths, direct);
    collectPathsFromValue(value.paths || value.imagenes_paths || value.images || value.files, paths);
    return;
  }

  const raw = String(value || '').trim();
  if (!raw) return;

  if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
    try {
      collectPathsFromValue(JSON.parse(raw), paths);
      return;
    } catch (_) {
      // Si no es JSON válido, cae al tratamiento de texto simple.
    }
  }

  const splitCandidates = raw.includes('\n') || raw.includes('|') || raw.includes(';')
    ? raw.split(/[\n|;]+/g)
    : [];

  if (splitCandidates.length > 1) {
    splitCandidates.forEach(item => addUniquePath(paths, item));
    return;
  }

  addUniquePath(paths, raw);
}

export function normalizeQuestionImagePath(path) {
  const value = String(path || '').trim();
  return value || '';
}

export function getQuestionImagePaths(question) {
  const paths = [];
  collectPathsFromValue(question?.imagenes_paths, paths);

  const legacyPath = normalizeQuestionImagePath(question?.imagen_path);
  if (legacyPath && !paths.includes(legacyPath)) paths.unshift(legacyPath);

  return paths;
}

export function normalizeQuestionImageFields(question = {}) {
  const paths = getQuestionImagePaths(question);
  return {
    imagen_path: normalizeQuestionImagePath(question?.imagen_path || paths[0] || ''),
    imagenes_paths: paths.length ? paths : null,
    imagen_alt: String(question?.imagen_alt || '').trim(),
    imagen_caption: String(question?.imagen_caption || '').trim()
  };
}

export function getQuestionImagesBaseUrl() {
  try {
    const win = browserWindow();
    const url = win?.SUPA_URL || (typeof SUPA_URL !== 'undefined' ? SUPA_URL : '') || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');
    return String(url || '').replace(/\/$/, '');
  } catch (_) {
    return '';
  }
}

export function resiarGetStoredQuestionImagesCacheVersion() {
  try {
    return String(safeLocalStorage()?.getItem(QUESTION_IMAGES_CACHE_VERSION_KEY) || '').trim();
  } catch (_) {
    return '';
  }
}

export function resiarSetQuestionImagesCacheVersion(version) {
  const clean = String(version || Date.now()).trim() || String(Date.now());
  try { safeLocalStorage()?.setItem(QUESTION_IMAGES_CACHE_VERSION_KEY, clean); } catch (_) {}
  try {
    const win = browserWindow();
    if (win) win.__resiarQuestionImagesCacheVersion = clean;
  } catch (_) {}
  return clean;
}

export function resiarGetQuestionImagesCacheVersion(options = {}) {
  const win = browserWindow();
  const bankVersion = String(
    options.questionBankVersion
    || win?.__resiarQuestionBankVersion
    || options.fallbackVersion
    || ''
  ).trim();
  const imageVersion = resiarGetStoredQuestionImagesCacheVersion();
  if (bankVersion && imageVersion) return `${bankVersion}-${imageVersion}`;
  return bankVersion || imageVersion || 'v1';
}

export function resiarRefreshQuestionImagesCache(version) {
  return resiarSetQuestionImagesCacheVersion(version || `${Date.now()}`);
}

export function resiarAppendQuestionImageCacheParam(url, options = {}) {
  const value = resiarGetQuestionImagesCacheVersion(options);
  if (!url || !value) return url;
  const separator = String(url).includes('?') ? '&' : '?';
  return `${url}${separator}rv=${encodeURIComponent(value)}`;
}

export function getQuestionImageUrlFromPath(path, options = {}) {
  const clean = normalizeQuestionImagePath(path);
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean)) return resiarAppendQuestionImageCacheParam(clean, options);
  const baseUrl = getQuestionImagesBaseUrl();
  if (!baseUrl) return '';
  return resiarAppendQuestionImageCacheParam(`${baseUrl}/storage/v1/object/public/question-images/${clean}`, options);
}

export function getQuestionImageLabel(path, index, total) {
  const clean = String(path || '').split('/').pop() || '';
  const withoutExt = clean.replace(/\.[^.]+$/, '');
  const match = withoutExt.match(/_([0-9]+[a-zA-Z]?)$/);
  if (match?.[1]) return `Imagen ${match[1]}`;
  return total > 1 ? `Imagen ${index + 1}` : 'Imagen';
}

export function getQuestionImageDomId(question) {
  return String(question?.id || 'actual').replace(/[^a-zA-Z0-9_-]/g, '_');
}
