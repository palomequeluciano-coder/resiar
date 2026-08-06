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

## Pendiente / próximo paso
- Seguir limpieza de `main.js`. Candidato mapeado: extraer nav de examen (`getQuestionNavClass`, `getOptimizedNavRanges`, `renderNavDotsOptimized`, `getNavRenderKey`, `syncNavDotState`, `renderNavGridInto`, ~líneas 2045-2142) a `ui/examNav.js` con patrón `configure()` (ver `ARCHITECTURE.md`). `esRespuestaAnulada` es candidata a `utils/` (pura). Agregar tests para `getOptimizedNavRanges` al extraer.
- Wrappers de `authSession` en `main.js` (~4105-4114) son indirección similar a stats pero con ~15 call sites dispersos — más riesgo, dejar para sesión con margen de verificación manual.
- No tocar `resiarEvaluateQuestionAnswer` (corrección de examen) sin tests con datos reales.
- Leaked Password Protection de Supabase: bloqueada por plan Free.

## Formato respuestas de exámenes médicos
Correcta (justificación) → Incorrectas (una por opción, motivo) → Concepto clave. Repaso/Referencias solo si se piden. Incluir año de examen si es relevante.
