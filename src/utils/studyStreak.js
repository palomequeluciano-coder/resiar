const DIAS_KEY = 'sim_diasracha_v1';
const DIAS_TOAST_KEY = 'sim_diasracha_toast_v1';

let deps = {
  readText: () => null,
  writeText: () => {},
  readJson: (_key, fallback) => fallback,
  writeJson: () => {},
  getCurrentUser: () => null,
  hasActiveExam: () => false
};

export function configureStudyStreak(options = {}) {
  deps = { ...deps, ...options };
}

export function getDiasRacha() {
  return deps.readJson(DIAS_KEY, { ultimo: null, racha: 0 }) || { ultimo: null, racha: 0 };
}

export function getRachaTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getRachaUserKey() {
  try {
    const currentUser = typeof deps.getCurrentUser === 'function' ? deps.getCurrentUser() : null;
    return String(
      (currentUser && (currentUser.id || currentUser.email)) ||
      (window.currentUser && (window.currentUser.id || window.currentUser.email)) ||
      'anon'
    );
  } catch (_) {
    return 'anon';
  }
}

export function getRachaToastStorageKey() {
  return `${DIAS_TOAST_KEY}:${getRachaUserKey()}:${getRachaTodayKey()}`;
}

export function registrarDia() {
  const hoy = getRachaTodayKey();
  const d = getDiasRacha();
  if (d.ultimo === hoy) return d.racha;

  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const nueva = d.ultimo === ayer ? d.racha + 1 : 1;
  deps.writeJson(DIAS_KEY, { ultimo: hoy, racha: nueva });
  return nueva;
}

export function hayExamenActivoParaRacha() {
  try {
    return !!deps.hasActiveExam();
  } catch (_) {
    return false;
  }
}

export function yaMostroRachaDiasHoy() {
  return deps.readText(getRachaToastStorageKey(), null) === '1';
}

export function marcarRachaDiasMostradaHoy() {
  deps.writeText(getRachaToastStorageKey(), '1');
}

export function mostrarRachaDias(options = {}) {
  const toast = document.getElementById('streakToast');

  if (!hayExamenActivoParaRacha()) {
    try { toast?.classList.remove('show'); } catch (_) {}
    return;
  }

  if (!options.force && yaMostroRachaDiasHoy()) return;

  const racha = registrarDia();
  if (racha < 1) return;

  const val = document.getElementById('streakToastVal');
  const suf = document.getElementById('streakToastS');
  if (!toast || !val) return;

  marcarRachaDiasMostradaHoy();
  val.textContent = racha;
  if (suf) suf.textContent = racha > 1 ? 's' : '';

  setTimeout(() => {
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  }, 1000);
}
