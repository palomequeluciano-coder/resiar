/*
 * ResiAR — nombres canónicos de almacenamiento local.
 * Mantiene migraciones desde claves legacy sin seguir agregando `sim_*`.
 */

export const RESIAR_THEME_KEY = 'resiar_theme_v1';
export const LEGACY_THEME_KEYS = ['sim_theme'];

export const RESIAR_SIDEBAR_COLLAPSED_KEY = 'resiar_sidebar_collapsed_v1';
export const LEGACY_SIDEBAR_COLLAPSED_KEYS = ['sim_sidebar_collapsed'];

export const RESIAR_SESSION_ID_KEY = 'resiar_session_id_v1';
export const LEGACY_SESSION_ID_KEYS = ['sim_session_id'];

export const RESIAR_MIXED_EXAM_FILTER_PREFIX = 'resiar_mixed_exam_year_filter_v3';
export const LEGACY_MIXED_EXAM_FILTER_KEYS = [
  'resiar_mixed_exam_year_filter_v2',
  'resiar_mixed_exam_year_filter_v1'
];

export function storageUserPart(user, fallback = 'anon') {
  const raw = user?.id || user?.user_id || user?.email || fallback || 'anon';
  return String(raw || fallback || 'anon').trim().replace(/[^a-zA-Z0-9_.:-]/g, '_') || fallback || 'anon';
}

export function userScopedStorageKey(prefix, user, fallback = 'anon') {
  return `${prefix}:${storageUserPart(user, fallback)}`;
}
