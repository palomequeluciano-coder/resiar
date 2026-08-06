# Continuar con ResiAR

Para arrancar un chat nuevo con Claude: pegar el link a este archivo
(`github.com/palomequeluciano-coder/resiar/blob/main/NEXT_SESSION.md`) o pedirle
que lo lea del repo, más el token de acceso.

## Cómo trabajamos
- Bash directo: `git clone https://<TOKEN>@github.com/palomequeluciano-coder/resiar.git`, editar en `src/`, correr tests + build (+ smoke jsdom si es runtime), commit y push directo a `main`. Sin zips.
- Nunca hotfixes: se corrige la estructura en `src/`, se buildea (`npm run build`), recién ahí está resuelto.
- MCP de Supabase conectado (proyecto `eqnkpgremqjucwswptni`, plan Free, ~231/500 MB).
- **Al cerrar cada sesión: actualizar este archivo (hecho/pendiente), commitear y pushear.** No repetir el prompt en el chat.

## Deploy
Cloudflare Workers (`resiarg`), auto-deploy en push a `main`. App vive en `resiarg.com.ar/examenes-medicos/` (root redirige ahí vía `worker/index.js`). Confirmado funcionando.

## Hecho (no repetir)
1. Code-splitting de `quickReference`, `adminQuestionEditor`, `bibliografia2026`, `challenges` → wrappers con `import()` dinámico. Bundle 753→584 KB. `clinicalScores.js` borrado (muerto).
2. DB hardening: extensiones movidas de `public` a `extensions`, `search_path` fijado en 3 RPCs.
3. Tests nuevos: `access.js`, `secureExamSession.js`, `authSession.js` → suite en 86 tests, verde.
4. Limpieza `main.js` pasada 1: borrado `ui/examNavigation.js` (144 líneas, muerto, divergido). Borrados 12 wrappers redundantes de `ui/stats.js` en `main.js`. 6.201→6.188 líneas.
5. Limpieza `main.js` pasada 2: extraída la nav de examen (`getQuestionNavClass`, `getOptimizedNavRanges`, `renderNavDotsOptimized`, `getNavRenderKey`, `syncNavDotState`, `renderNavGridInto`) a `ui/examNav.js` con patrón `configure()`. `esRespuestaAnulada` extraída (pura) a `utils/examAnswers.js`. 13 tests nuevos (`examNav.test.js`). Suite en 99 tests. `main.js` 6.188→6.107 líneas.

## Pendiente / próximo paso
- Seguir limpieza de `main.js`. Candidato mapeado para la próxima pasada: funciones de racha/streak (`resiarEvaluationCountsForStreak`, `resiarFindRachaAnchorIndex`, `resiarCalcularRachaCorrectas`, `actualizarRachaPill`, `renderRacha`, `boom`, ~líneas 2379-2570) a un módulo nuevo `ui/racha.js` con el mismo patrón `configure()` (inyectando `getExamen`, `getRespuestas`, `getActual`, deps de DOM). Verificar primero cuánto dependen de `resiarEvaluateQuestionAnswer` antes de tocarlas.
- Wrappers de `authSession` en `main.js` (~4020-4030, línea shifteada por los cambios recientes — re-grep antes de tocar) son indirección similar a stats pero con ~15 call sites dispersos por hoisting — más riesgo, dejar para sesión con margen de verificación manual.
- No tocar `resiarEvaluateQuestionAnswer` (corrección de examen) sin tests con datos reales.
- Leaked Password Protection de Supabase: bloqueada por plan Free.

## Formato respuestas de exámenes médicos
Correcta (justificación) → Incorrectas (una por opción, motivo) → Concepto clave. Repaso/Referencias solo si se piden. Incluir año de examen si es relevante.
