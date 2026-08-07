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
6. Limpieza `main.js` pasada 3: extraídas las funciones de racha/streak (`resiarEvaluationCountsForStreak`, `resiarFindRachaAnchorIndex`, `resiarCalcularRachaCorrectas`, `actualizarRachaPill`, `renderRacha`, `boom`) a `ui/racha.js` con patrón `configure()` (deps: `getExamen`, `getRespuestas`, `getActual`, `getLastAnsweredIndex`, `evaluateQuestionAnswer`, `getCorrectas`). 8 tests nuevos (`racha.test.js`). Suite en 107 tests. `main.js` 6.107→6.038 líneas.

## Pendiente / próximo paso
- **Hallazgo importante (2026-08-06), no resuelto todavía**: en `main.js`
  hay un IIFE al final del archivo (`resiar-question-order-stability-script`,
  ~línea 5838) que pisa en runtime `resiarParseOrderNumber`,
  `resiarSortByOriginalExamOrder` y `getNPregunta` — las mismas funciones
  que el archivo ya importa limpiamente de `utils/questionOrder.js` más
  arriba. Es la definición del patrón "hotfix" que hay que evitar: la
  versión del IIFE es la que REALMENTE corre en prod (pisa a la otra al
  cargar), y no es un duplicado idéntico:
  - `resiarParseOrderNumber` sí es 100% idéntica en ambos lados → fusionar
    es trivial y sin riesgo.
  - `resiarSortByOriginalExamOrder`: la versión de `utils/questionOrder.js`
    hace un sort plano por número de orden. La versión del IIFE agrupa
    primero por `examen + año` (bankOf/yearOf, con lógica especial para
    Provincia BA y Examen Único) y recién ordena por número DENTRO de cada
    grupo — esto es lo que hace que la numeración reinicie en 1 por
    examen/año (ver comentario de `buildNumeroMap`). Son comportamientos
    distintos, no solo refactors.
  - `getNPregunta`: la versión del IIFE chequea más campos candidatos
    (`nro_pregunta`, `pregunta_numero`, `numero_pregunta`, `question_no`) y
    cae en `p._resiarOriginalGroupRank` en vez de `_numeroMap[p.id]` — en
    la práctica deberían dar el mismo resultado porque `buildNumeroMap` fija
    ambos valores, pero no está probado.
  - **Antes de tocarlo**: escribir tests que comparen el resultado de
    ambas implementaciones sobre un dataset sintético con varios
    examen+año mezclados, confirmar que son equivalentes (o entender bien
    la diferencia), migrar la lógica real (la del IIFE, agrupada) a
    `utils/questionOrder.js` como implementación canónica con tests, y
    recién ahí borrar el IIFE completo de `main.js`. No asumir que la
    versión "limpia" del módulo es la correcta solo porque está mejor
    ubicada — hoy NO es la que corre en producción.
- Después de resolver eso, seguir buscando más bloques cohesivos en
  `main.js` (candidato: `cargarChecklist`/`buildNumeroMap`/`getNPregunta`
  como unidad de "numeración y checklist de especialidades", pero
  depende del punto anterior).
- No tocar `resiarEvaluateQuestionAnswer` (corrección de examen) sin tests
  con datos reales.
- Leaked Password Protection de Supabase: bloqueada por plan Free.

## Revisado y decidido NO tocar (no volver a levantar como pendiente)
- **Wrappers de `authSession` en `main.js`** (~3942-3951): no es deuda técnica accidental — resuelven a propósito un problema real de orden de carga. `authSession` se crea recién en la línea ~3826, pero `abrirAuth`/`renderUserUI`/etc. se usan como deps en `configure()` que corren antes (leaderboard ~2998, billing ~3005, questionChat ~3562, social ~3804). Los wrappers son `function` declarations (hoisteadas con cuerpo completo), por eso se pueden referenciar antes de esa línea sin romper nada. Reemplazarlos por `const { abrirAuth, ... } = authSession` rompe en 2 puntos concretos donde se pasan sin envolver en arrow function (línea ~3575 en `configureQuestionChat`, línea ~3808 en `configureSocial`): ahí la const todavía no existe (TDZ) en ese momento → explota login/chat al cargar. Beneficio de sacarlos: ~10 líneas. Riesgo: romper auth en producción. Dejar como está.
- **Advisors de seguridad de Supabase** (2026-08-06): ~60 warnings de "SECURITY DEFINER ejecutable por anon/authenticated" — son las RPCs de la app funcionando como están diseñadas (login, exámenes, ranking, social). Auditarlas una por una para decidir DEFINER vs INVOKER es trabajo grande y riesgoso (puede romper accesos reales), no para una sesión suelta. `pg_net` en `public`: ya resuelto a propósito, no es relocatable (ver comentario en `supabase/migrations/20260806_move_extensions_out_of_public.sql`). Tabla `resiar_security_hardening_log` con RLS sin política: correcto (deny-all por defecto), no es un bug.
- **Advisors de performance de Supabase** (2026-08-06): ~30 "índices sin uso" (nivel INFO). Proyecto de bajo tráfico (231/500 MB) — borrarlos no ahorra nada real y el riesgo es tener que recrearlos si el tráfico crece. Reconsiderar solo si hay más señal de uso real en el futuro.


## Formato respuestas de exámenes médicos
Correcta (justificación) → Incorrectas (una por opción, motivo) → Concepto clave. Repaso/Referencias solo si se piden. Incluir año de examen si es relevante.
