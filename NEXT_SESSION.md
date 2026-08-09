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
7. Limpieza `main.js` pasada 4: resuelto el hotfix en vivo de orden de preguntas. Había un IIFE (`resiar-question-order-stability-script`) que pisaba en runtime `resiarParseOrderNumber`/`resiarSortByOriginalExamOrder`/`getNPregunta` con una implementación DISTINTA a la que el archivo importaba "limpiamente" de `utils/questionOrder.js` (el IIFE agrupaba por examen+año antes de ordenar; era la versión que realmente corría en producción). Se consolidó la lógica del IIFE como implementación canónica en `utils/questionOrder.js` (usa `esProvinciaBsAs`/`esExamenUnico` de `utils/examFilters.js`), con 6 tests de paridad que reimplementan la lógica legacy tal cual y comparan contra la nueva sobre un dataset sintético mixto (CABA, ENARM, Provincia BA con variantes, Examen Único). Se borró el IIFE (65 líneas) y `_numeroMap` (había quedado de solo-escritura). El patch de `resiarIsSpecificFilterActive`, que vivía en el mismo IIFE pero es un tema no relacionado, se dejó intacto en su propio bloque. Suite en 113 tests. `main.js` 6.038→5.963 líneas.
8. Limpieza `main.js` pasada 5: extraídas `cargarChecklist`/`buildNumeroMap` a `ui/checklistEspecialidades.js` con patrón `configure()` (dep: `getUnfilteredPool`, que main.js resuelve vía `resiarBuildExamSelection`). `getNPregunta` se dejó donde estaba (ya es un delegador trivial de 3 líneas a `utils/questionOrder.js`, no valía la pena moverlo). Se borró `checklistEl` y `const _normEsp` de `main.js` (dead code tras la extracción). 9 tests nuevos (`checklistEspecialidades.test.js`, incluye casos DOM vía jsdom). Suite en 122 tests. `main.js` 5.963→5.913 líneas.
9. Limpieza `main.js` pasada 6: extraídas `cargarFiltros`/`cargarAniosMir`/`selectAnioMir`/`toggleAnioMirSelect`/`selectExamen`/`toggleCustomSelect` (filtro de banco de examen + año MIR, dropdowns custom) a `ui/examBankFilter.js` con patrón `configure()` (deps: `getPreguntas`, `getFiltroExamenValue`/`setFiltroExamenValue`, `getFiltroAnioMirValue`/`setFiltroAnioMirValue`; `main.js` sigue siendo dueño de `_filtroExamenValue`/`_filtroAnioMirValue`/`preguntas`). Nota: `cargarFiltros` quedó como `let` (no `const`) en `main.js` porque `installFilterHooks()` (~línea 4620, integración de "exámenes mixtos") la envuelve en runtime — es un wrapper deliberado que agrega comportamiento, no un duplicado divergente como el caso de la pasada 4; se documentó con un comentario en el punto de la reasignación. 8 tests nuevos (`examBankFilter.test.js`, con DOM real vía jsdom, incluye el caso de los listeners de "click afuera cierra el dropdown"). Suite en 130 tests. `main.js` 5.913→5.806 líneas.
10. Limpieza `main.js` pasada 7: extraídas `resiarFormatElapsedTimer`/`iniciarTimer` (timer principal de examen) a `ui/examTimer.js` con patrón `configure()` (deps: `getTiempo`/`setTiempo`, `getTiempoTotal`/`setTiempoTotal`, `getTimer`/`setTimer` — el id del `setInterval`, reusado en varios `clearInterval(timer)` de `main.js` —, `saveDraft`, `playTimerSound`, `onTimeUp`). 10 tests nuevos (`examTimer.test.js`, con `vi.useFakeTimers()`: formato puro, tiempo transcurrido en pantalla, guardado de borrador cada 15s, sonido en 60/30/10..1, `onTimeUp` exacto al llegar a 0, reinicio sin timers duplicados). Suite en 140 tests. `main.js` 5.806→5.778 líneas.
11. Barrida de código muerto (a pedido explícito, no parte de la limpieza incremental de `main.js`): borrados 5 archivos completos sin ninguna referencia en el repo — `state/appState.js`, `ui/welcomeView.js` (scaffold viejo de la migración a Vite), `ui/labValues.js` (607 líneas, superado por `ui/quickReferenceData.js`), `ui/examQuestionRenderer.js` (257 líneas, implementación de renderizado de preguntas nunca cableada), `config/supabase.js` (cliente Supabase alternativo vía npm, superado por `/supabase-global.js` que inicializa `window.sb` como script global). Se quitó la dependencia npm `@supabase/supabase-js` de `package.json` (había quedado huérfana, solo la usaba el archivo borrado) y se regeneró `package-lock.json`. Dentro de `main.js`: borradas `resiarVisibleQuestionType()` y `getQuestionImageUrl()` local (ninguna se llamaba nunca), más los imports huérfanos `getQuestionImagePaths`/`getQuestionImageLabel` que solo usaba esa función ya borrada. En `utils/questionImages.js`: borrado el export `getQuestionImageUrl` (nunca importado por nadie). Suite se mantuvo en 140 tests (sin tests nuevos, solo remoción). `main.js` 5.778→5.763 líneas. -1.031 líneas netas en el repo.
12. Unificación de lógica duplicada (a pedido explícito, siguiendo directo de la pasada 11): `main.js` tenía su propia reimplementación completa de `resiarGetQuestionImagesCacheVersion`/`resiarAppendQuestionImageCacheParam`/`getQuestionImageUrlFromPath`/`resiarRefreshQuestionImagesCache`, casi idéntica a las versiones exportadas y testeadas de `utils/questionImages.js` (que ya usa `ui/explanation.js`), solo diferían en que la versión del banco de preguntas se leía de una variable de módulo (`_resiarQuestionBankVersion`) en vez de recibirse por parámetro. Ahora `main.js` importa directo `resiarRefreshQuestionImagesCache` (sin wrapper, es idéntica) y `getQuestionImageUrlFromPath` queda como un wrapper de una sola función que le pasa `{questionBankVersion: _resiarQuestionBankVersion, fallbackVersion: RESIAR_QB_VERSION_FALLBACK}` como opciones a la versión de `utils/` — mismo orden de prioridad que antes (variable de módulo → `window.__resiarQuestionBankVersion` → constante de fallback), comportamiento idéntico verificado contra `questionImages.test.js`. Se eliminaron las reimplementaciones ya sin uso y los 4 imports huérfanos que solo ellas consumían. Suite en 140 tests (sin nuevos, la cobertura ya existía en `questionImages.test.js`). `main.js` 5.763→5.745 líneas.
13. Limpieza `main.js` pasada 8: mapeé los IIFEs sueltos que quedan al final del archivo (después de la última sección con comentario `// ── ... ──`, línea ~3927 en adelante) — son 5, tamaños muy dispares:
    - **`resiar-mixed-exam-filter-script`** (~774 líneas, línea ~3981): banco combinado / filtro de exámenes mixtos. Fuertemente acoplado al estado de `main.js` (preguntas, currentUser, currentProfile, _serverAcceso, _resiarQuestionBankVersion, PROVINCIA_VALUE, EU_VALUE, esProvinciaBsAs, esExamenUnico, labelExamen, planUsesTrialQuestionCache), todo vía `typeof x !== 'undefined' ? x : ...` defensivo. Es el que contiene `installFilterHooks()` (el wrapper de `cargarFiltros` que forzó dejarla como `let` en la pasada 6). Candidato grande para una sesión dedicada — no intentar en una pasada corta.
    - **home render wrapper** (~726 líneas, línea ~4759): envuelve el render de la home (`resiarHomeConfiguratorScript`). Depende del `resiar-mixed-exam-filter-script` de arriba (llama a `window.mixedExamFilterDebug()`). Sin explorar en detalle todavía.
    - **`resiar-whatsapp-viewstate-helpers`** (~34 líneas, línea ~5489): **ya extraída** a `ui/whatsappViewState.js` (pasada 8) — cero dependencias del estado de `main.js` (solo document/window), se movió tal cual como módulo de efecto (`import './ui/whatsappViewState.js'`, sin bindings). +12 tests.
    - **override de `resiarIsSpecificFilterActive`** (~11 líneas, línea ~5612): ya marcado como "no reabrir" en la pasada 4 — dejar así.
    - **`resiar-home-search-bindings`** (~45 líneas, línea ~5627): **ya extraída** a `ui/homeSearchBindings.js` (pasada 9) — reasignaba `resiarRenderHome`/`mostrarPantallaBienvenida`/`irAConfigurarNuevoExamen` (bindings de `main.js`, mismo patrón de wrapper-en-runtime que `cargarFiltros`). Se resolvió con un puente `setFunction(name, fn)` inyectado desde `main.js`, el mismo tipo de get/set que ya usaba `configureViewStateController` más abajo en el archivo (se reutilizó la idea, no el código). +7 tests.
    Suite: 140 → 152 tests (whatsappViewState). `main.js` 5.745→5.711 líneas.
14. Limpieza `main.js` pasada 9: extraída `resiar-home-search-bindings` (ver punto 13). Suite: 152 → 159 tests. `main.js` 5.711→5.680 líneas.

## Pendiente / próximo paso
- Quedan 2 IIFEs grandes sin tocar: **mixed-exam-filter** (~774 líneas,
  línea ~3981) y **home render wrapper** (~726 líneas, línea ~4759,
  depende del anterior vía `window.mixedExamFilterDebug()`). Juntos son
  ~1500 líneas de lógica muy acoplada al estado de `main.js` (docenas de
  referencias `typeof x !== 'undefined' ? x : ...` a `preguntas`,
  `currentUser`, `currentProfile`, `_serverAcceso`,
  `_resiarQuestionBankVersion`, `PROVINCIA_VALUE`, `EU_VALUE`,
  `esProvinciaBsAs`, `esExamenUnico`, `labelExamen`,
  `planUsesTrialQuestionCache`, y más) más el wrapper en runtime de
  `cargarFiltros` (`installFilterHooks()`, dentro del primero). Esto
  necesita una sesión dedicada con tiempo para mapear cada dependencia
  antes de tocar nada — no es una pasada corta como las anteriores.
- Ojo con posibles wrappers en runtime antes de convertir una
  destructuración a `const`: si algo reasigna la función más abajo en
  el archivo, el build de Vite/Rolldown falla explícitamente con el
  error de reasignación — no es un fallo silencioso, así que
  `npm run build` lo va a marcar solo. Cuando el wrapper reasigna un
  binding de `main.js` desde un módulo separado, el patrón que ya
  funcionó dos veces (`examBankFilter.js` con `cargarFiltros`,
  `homeSearchBindings.js` con `resiarRenderHome`/etc.) es inyectar un
  getter/setter — no intentar acceso directo al scope de `main.js`.
- No tocar `resiarEvaluateQuestionAnswer` (corrección de examen) sin tests
  con datos reales.
- Leaked Password Protection de Supabase: bloqueada por plan Free.

## Revisado y decidido NO tocar (no volver a levantar como pendiente)
- **Wrappers de `authSession` en `main.js`** (~3942-3951): no es deuda técnica accidental — resuelven a propósito un problema real de orden de carga. `authSession` se crea recién en la línea ~3826, pero `abrirAuth`/`renderUserUI`/etc. se usan como deps en `configure()` que corren antes (leaderboard ~2998, billing ~3005, questionChat ~3562, social ~3804). Los wrappers son `function` declarations (hoisteadas con cuerpo completo), por eso se pueden referenciar antes de esa línea sin romper nada. Reemplazarlos por `const { abrirAuth, ... } = authSession` rompe en 2 puntos concretos donde se pasan sin envolver en arrow function (línea ~3575 en `configureQuestionChat`, línea ~3808 en `configureSocial`): ahí la const todavía no existe (TDZ) en ese momento → explota login/chat al cargar. Beneficio de sacarlos: ~10 líneas. Riesgo: romper auth en producción. Dejar como está.
- **Advisors de seguridad de Supabase** (2026-08-06): ~60 warnings de "SECURITY DEFINER ejecutable por anon/authenticated" — son las RPCs de la app funcionando como están diseñadas (login, exámenes, ranking, social). Auditarlas una por una para decidir DEFINER vs INVOKER es trabajo grande y riesgoso (puede romper accesos reales), no para una sesión suelta. `pg_net` en `public`: ya resuelto a propósito, no es relocatable (ver comentario en `supabase/migrations/20260806_move_extensions_out_of_public.sql`). Tabla `resiar_security_hardening_log` con RLS sin política: correcto (deny-all por defecto), no es un bug.
- **Advisors de performance de Supabase** (2026-08-06): ~30 "índices sin uso" (nivel INFO). Proyecto de bajo tráfico (231/500 MB) — borrarlos no ahorra nada real y el riesgo es tener que recrearlos si el tráfico crece. Reconsiderar solo si hay más señal de uso real en el futuro.


## Formato respuestas de exámenes médicos
Correcta (justificación) → Incorrectas (una por opción, motivo) → Concepto clave. Repaso/Referencias solo si se piden. Incluir año de examen si es relevante.
