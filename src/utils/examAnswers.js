import { hasAnswerValue } from './answerOptions.js';

// Detecta preguntas sin respuesta válida.
// Cubre: null JS, string "null", string vacío, "anulada", "anulado", "ANULADA" (MIR)
export function esRespuestaAnulada(p) {
  if (!p || typeof p !== 'object') return false;
  if (p._resiarAnswerHidden === true) return p.anulada === true;
  if (p?.anulada === true) return true;
  return !hasAnswerValue(p.respuesta);
}
