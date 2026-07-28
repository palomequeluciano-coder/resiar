// FIX: convertir guiones bajos a espacios y capitalizar cada palabra
// ── Mapa canónico de especialidades ──────────────────────────────────────────
// Clave: valor tal como aparece en la BD  →  Valor: etiqueta visual final
// Esto NO modifica la BD; es solo para mostrar y agrupar en el front.
export const ESP_CANONICAL = {
  // Canónicas nuevas (v2)
  'Anatomía Patológica': 'Anatomía Patológica',
  'Anestesia': 'Anestesia',
  'Bioética': 'Bioética',
  'Bioquímica': 'Bioquímica',
  'Cardiología': 'Cardiología',
  'Cirugía': 'Cirugía',
  'Cirugía Cardiovascular': 'Cirugía Cardiovascular',
  'Cirugía Maxilofacial': 'Cirugía Maxilofacial',
  'Cirugía Plástica': 'Cirugía Plástica',
  'Cirugía Torácica': 'Cirugía Torácica',
  'Cirugía Vascular': 'Cirugía Vascular',
  'Cuidados Paliativos': 'Cuidados Paliativos',
  'Dermatología': 'Dermatología',
  'Emergentología': 'Emergentología',
  'Endocrinología': 'Endocrinología',
  'Farmacología': 'Farmacología',
  'Gastroenterología': 'Gastroenterología',
  'Genética': 'Genética',
  'Geriatría': 'Geriatría',
  'Ginecología': 'Ginecología',
  'Gestión Clínica': 'Gestión Clínica',
  'Hematología': 'Hematología',
  'Infectología': 'Infectología',
  'Inmunología': 'Inmunología',
  'Medicina familiar': 'Medicina familiar',
  'Medicina legal': 'Medicina legal',
  'Nefrología': 'Nefrología',
  'Neumología': 'Neumología',
  'Neurocirugía': 'Neurocirugía',
  'Neurología': 'Neurología',
  'Nutrición': 'Nutrición',
  'Obstetricia': 'Obstetricia',
  'Oftalmología': 'Oftalmología',
  'Oncología': 'Oncología',
  'Otorrinolaringología': 'Otorrinolaringología',
  'Pediatría': 'Pediatría',
  'Psiquiatría': 'Psiquiatría',
  'Radiología': 'Radiología',
  'Reumatología': 'Reumatología',
  'Salud pública': 'Salud pública',
  'Toxicología': 'Toxicología',
  'Traumatología': 'Traumatología',
  'Urología': 'Urología',

  // Legacy sin acento / con guiones bajos
  'Cardiologia': 'Cardiología',
  'Cirugia': 'Cirugía',
  'Cirugia_cardiovascular': 'Cirugía Cardiovascular',
  'Cirugia_toracica': 'Cirugía Torácica',
  'Dermatologia': 'Dermatología',
  'Emergentologia': 'Emergentología',
  'Endocrinologia': 'Endocrinología',
  'Farmacologia': 'Farmacología',
  'Gastroenterologia': 'Gastroenterología',
  'Genetica': 'Genética',
  'Ginecologia': 'Ginecología',
  'Hematologia': 'Hematología',
  'Infectologia': 'Infectología',
  'Inmunologia': 'Inmunología',
  'Medicina_familiar': 'Medicina familiar',
  'Medicina_legal': 'Medicina legal',
  'Medicina Legal': 'Medicina legal',
  'MedicinaGeneral': 'Medicina familiar',
  'Nefrologia': 'Nefrología',
  'Neumonologia': 'Neumología',
  'Neumologia': 'Neumología',
  'Neurocirugia': 'Neurocirugía',
  'Neurologia': 'Neurología',
  'Nutricion': 'Nutrición',
  'Oftalmologia': 'Oftalmología',
  'Oncologia': 'Oncología',
  'Otorrinolaringologia': 'Otorrinolaringología',
  'Pediatria': 'Pediatría',
  'Psiquiatria': 'Psiquiatría',
  'Reumatologia': 'Reumatología',
  'Salud_publica': 'Salud pública',
  'Salud Pública': 'Salud pública',
  'Toxicologia': 'Toxicología',
  'Traumatologia': 'Traumatología',
  'Urologia': 'Urología',
  'Bioetica': 'Bioética',
  'Bioquimica': 'Bioquímica',
  'Radiologia': 'Radiología',
  'Geriatria': 'Geriatría',

  // Fusiones del sistema nuevo
  'Medicina Preventiva': 'Salud pública',
  'Preventiva': 'Salud pública',
  'Urgencias': 'Emergentología',
  'Emergencias': 'Emergentología',
  'Plástica': 'Cirugía Plástica',
  'Plastica': 'Cirugía Plástica',
  'Habilidades comunicativas': 'Medicina familiar',
  'Comunicación': 'Medicina familiar',
  'Comunicacion': 'Medicina familiar',
  'Alergología': 'Inmunología',
  'Alergologia': 'Inmunología',
  'Hepatología': 'Gastroenterología',
  'Hepatologia': 'Gastroenterología',

  // Abreviaturas
  'C. Paliativos': 'Cuidados Paliativos',
  'C. Maxilofacial': 'Cirugía Maxilofacial',
  'C. Vascular': 'Cirugía Vascular',
  'C. General': 'Cirugía',
  'C. Toracica': 'Cirugía Torácica',
  'C. Torácica': 'Cirugía Torácica',
  'C. Cardiovascular': 'Cirugía Cardiovascular',
  'C. Plastica': 'Cirugía Plástica',
  'C. Plástica': 'Cirugía Plástica',
};

// Devuelve la etiqueta visual para una especialidad (lookup case-sensitive primero,
// luego case-insensitive, luego capitaliza automáticamente).
export function formatEsp(nombre) {
  if (!nombre) return '';
  // 1. Lookup exacto
  if (ESP_CANONICAL[nombre]) return ESP_CANONICAL[nombre];
  // 2. Lookup case-insensitive
  const lower = nombre.toLowerCase();
  for (const [k, v] of Object.entries(ESP_CANONICAL)) {
    if (k.toLowerCase() === lower) return v;
  }
  // 3. Fallback: reemplazar _ por espacio y capitalizar
  return nombre
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)([a-záéíóúüñ])/gi, (_, sep, c) => sep + c.toUpperCase());
}

// Devuelve la clave canónica normalizada para agrupar especialidades
// (sin tildes, sin guiones bajos, minúsculas). MedicinaGeneral y General
// quedan bajo la misma clave que 'medicina familiar'.
export function normEspecialidadKey(s) {
  if (!s) return '';
  const exact = ESP_CANONICAL[s] || s;
  let canonical = exact;
  const lower = String(s).toLowerCase();
  for (const [k, v] of Object.entries(ESP_CANONICAL)) {
    if (k.toLowerCase() === lower) { canonical = v; break; }
  }
  return String(canonical)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ');
}

// Fuente única de verdad para clasificación en el frontend.
// Usa v2 cuando existe, con fallback a legacy para preguntas aún no reclasificadas.
export function espRaw(p) {
  return (p && (p.especialidad_v2 || p.especialidad)) || 'General';
}
export function temaRaw(p) {
  return (p && (p.tema_v2 || p.tema)) || '';
}
export function espLabel(p) {
  return formatEsp(espRaw(p));
}
export function normalizarEspValor(v) {
  return formatEsp(v || 'General') || 'General';
}
export function splitEspecialidades(str) {
  return String(str || 'General')
    .split(',')
    .map(e => normalizarEspValor(e.trim()))
    .filter(Boolean);
}

export function normalizeSearchText(v) {
  return String(v == null ? '' : v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
