# Arquitectura de Resiar

Este documento explica cómo está organizado el proyecto y qué patrón seguir
al agregar código nuevo, para que `main.js` no vuelva a crecer sin control.

## Visión general

```
Frontend (Vite + JS vanilla)  →  Supabase (Postgres + RLS + Edge Functions)
                               →  Cloudflare Worker (modo Arena en tiempo real)
```

- **Frontend**: sin framework (no React/Vue). Vite compila todo a un bundle.
- **Backend de datos**: Supabase. La corrección de exámenes se hace del lado
  del servidor vía RPC — el cliente nunca recibe la respuesta correcta hasta
  que la envía (ver `src/services/secureExamSession.js`).
- **Pagos**: Mercado Pago, orquestado desde `src/ui/billing.js` (creación de
  pago vía Edge Function `create-payment`, detección de vuelta por `?pago=`
  en la URL, confirmación contra la tabla `profiles`).
- **Tiempo real**: `cloudflare/arena-live-worker` (Durable Objects), para el
  modo de duelo/arena en vivo. Se deploya aparte con `wrangler`, no está
  atado al deploy del frontend.
- **Deploy del frontend**: Cloudflare Workers (Workers Builds), auto-triggered
  en cada push a `main` (build: `npm run build`, deploy: `npx wrangler
  deploy`). La app vive en `resiarg.com.ar/examenes-medicos/`; un worker
  chico (`worker/index.js`) redirige el root ahí y hace SPA fallback.

## Estructura de carpetas

```
src/
├── main.js       ← orquestador principal (bootstrap, wiring de UI, estado
│                    mutable del examen en curso: currentUser, examen,
│                    respuestas, preguntas, filtros, timers, etc.)
├── state/        ← estado compartido de la app (viewState.js: máquina de
│                    estados de la vista actual + puente getFunction/
│                    setFunction para bindings reasignables de main.js)
├── services/     ← lógica de negocio y llamadas a Supabase
├── ui/           ← renderizado y manejo del DOM por feature
└── utils/        ← funciones puras, sin dependencias de DOM/red
```

No hay carpeta `config/`: el cliente de Supabase (`window.sb`) se inicializa
como script global (`/supabase-global.js`, fuera de `src/`), no vía import de
módulo — así lo consume `main.js` y todo lo que necesita `window.sb`.

**Regla simple para decidir dónde va algo nuevo:**

| Si la función... | Va en... |
|---|---|
| No toca el DOM ni hace llamadas de red, solo transforma datos | `utils/` |
| Llama a Supabase, hace fetch, o coordina lógica de negocio | `services/` |
| Renderiza HTML o maneja eventos del DOM | `ui/` |
| Es parte del arranque/orquestación general de la app | `main.js` (tratar de que sea lo mínimo posible) |

## El patrón `configure()`

La gran mayoría de `services/` y `ui/` usan el mismo patrón para evitar
dependencias circulares con `main.js`, ya que `main.js` tiene variables de
estado (`currentUser`, `examen`, `preguntas`, `sb`, etc.) que estos módulos
necesitan leer — y a veces escribir —, pero que no pueden importar
directamente:

```js
// services/miModulo.js
const deps = {
  getCurrentUser: () => null,
  // ...valores por defecto
};

export function configureMiModulo(overrides = {}) {
  Object.assign(deps, overrides || {});
  return { funcionA, funcionB }; // funciones que usan `deps` internamente
}

function funcionA() {
  const user = deps.getCurrentUser();
  // ...
}
```

```js
// main.js
const { funcionA, funcionB } = configureMiModulo({
  getCurrentUser: () => currentUser, // closure sobre la variable de main.js
});
```

**Por qué closures (`() => currentUser`) y no el valor directo:** `currentUser`
cambia con el tiempo (login/logout). Pasar `currentUser` directamente
capturaría el valor en ese instante; pasar `() => currentUser` siempre lee
el valor actual cuando se invoca.

**Cuando el módulo extraído necesita además** ***escribir*** **estado de
`main.js`** (no solo leerlo), se inyecta también un setter, y en `main.js`
la variable correspondiente tiene que declararse `let` (no `const`) para
poder ser reasignada desde el closure:

```js
// main.js
let cargarFiltros = ...; // let, no const: el módulo la reasigna

const { ... } = configureMiModulo({
  getCargarFiltros: () => cargarFiltros,
  setCargarFiltros: (fn) => { cargarFiltros = fn; },
});
```

Este caso aparece cuando un módulo extraído necesita **envolver una función
de `main.js` en runtime** (agregarle comportamiento sin reemplazarla del
todo) — ver `ui/examBankFilter.js` (envuelve `cargarFiltros`),
`ui/homeSearchBindings.js` y `ui/mixedExamFilter.js` para ejemplos reales.
Si te encontrás necesitando este patrón para una función nueva de
`main.js`, primero verificá si esa función ya es reasignable (`function`/
`let`, no `const`) — si no lo es, cambiarla a `let` es seguro y necesario.

**Un matiz encontrado en la práctica:** no todo lo que un módulo extraído
"actúa como si existiera" en `main.js` (con un `try/catch` alrededor de la
reasignación) es realmente un binding de `main.js` — a veces solo vive en
`window`, expuesto por el propio módulo que se está extrayendo. En ese caso
no hace falta getter/setter, alcanza con seguir leyendo/escribiendo
`window[name]`. Antes de armar un getter/setter para algo, confirmá con
`grep` dónde se declara de verdad.

## Qué ya no hay que tratar con cuidado especial

- **`resiarEvaluateQuestionAnswer`** (corrección de examen): ya no vive en
  `main.js`. Se extrajo como función pura a `utils/answerEvaluation.js`
  (recibe `question`/`rawAnswer`/`rawResult`/`index` explícitos, no lee
  estado de `main.js`) y tiene 25 tests con datos reales
  (`answerEvaluation.test.js`), incluido el caso de una anulación local
  del admin pisando un resultado guardado viejo. `main.js` solo tiene un
  wrapper de 6 líneas que arma esos parámetros desde su propio estado.

## Tests

```bash
npm run test           # corre los tests una vez
npm run test:watch     # modo watch, útil mientras desarrollás
npm run test:coverage  # suite + reporte de cobertura de líneas/branches
```

Los tests viven en `src/__tests__/` y usan [Vitest](https://vitest.dev) con
entorno `jsdom` (para simular `window`/`localStorage`). La cobertura se mide
con `@vitest/coverage-v8`, configurada con `coverage.all=true` en
`vite.config.js` — el reporte siempre incluye TODOS los archivos de `src/`
que matchean el patrón, incluidos los que ningún test toca todavía (se
muestran en 0%), no solo lo que los tests importan. Sin esto, un archivo sin
tests simplemente no aparecería en el reporte en vez de mostrar el hueco
real.

**Al extraer una función más de `main.js` a `services/`, `ui/` o `utils/`,
agregale tests.** Es lo que hace que la próxima extracción sea rápida de
verificar (correr `npm run test`) en vez de depender de probar todo a mano
en el navegador.

**Estado de la cobertura (última medición):** ~14% de líneas en todo `src/`.
`main.js` está en 0% (nunca se importa desde un test — es el punto de
entrada con efectos secundarios). Los módulos con más riesgo real ya están
bien cubiertos: `utils/answerEvaluation.js` (corrección de examen),
`ui/billing.js` (precios y pagos, ~90%), `services/mistakesExam.js` +
`services/weaknessExam.js` + `services/performanceEngine.js` (qué preguntas
ve cada usuario en repaso/puntos débiles, 94-98%). Quedan sin cobertura
módulos grandes de alto tráfico: `ui/questionChat.js`, `ui/profile.js`,
`ui/mobileExamUi.js`, `ui/vacunasPractice.js`, entre otros — priorizar por
riesgo real (plata > corrección de examen > contenido que ve el usuario >
alto tráfico > secundario) antes que por lo fácil que sea testear cada uno.

**Dos gotchas de testing encontrados en la práctica** (no bugs de
producción, pero rompen tests si no se los tiene en cuenta):
- Reemplazar `window.location` con un objeto plano parcial en jsdom
  corrompe el resto de los tests del **archivo entero** (jsdom comparte un
  solo `window` por archivo de test, no por `it()`). Usar
  `vi.stubGlobal('location', {...})` + `vi.unstubAllGlobals()` en el
  `afterEach`, o `window.history.pushState(...)` cuando alcanza con cambiar
  la URL real.
- Un módulo con estado propio a nivel de módulo (un guard tipo
  `let installed = false`) solo se "instala" una vez por carga — si un test
  necesita probar varios escenarios de esa instalación por separado, hay
  que resetear el módulo con `vi.resetModules()` + `import()` dinámico en
  cada test, no alcanza con `beforeEach`.

## Historial de refactor de `main.js`

`main.js` empezó en **6.761 líneas**. Bajó a **4.145 líneas** (−39%)
extrayendo módulos autocontenidos, verificando en cada paso que:
1. La suite de tests (`npm run test`) pase completa.
2. El build (`npm run build` / `npm run predeploy`) compile sin errores.
3. No haya funciones duplicadas (misma función definida en dos lugares).
4. El tamaño del bundle final no cambie de forma significativa.

Lo extraído cubre prácticamente toda la UI y lógica de negocio que antes
vivía inline en `main.js`: navegación de examen, timer, filtros de banco de
examen (incluido el banco combinado/"exámenes mixtos"), checklist de
especialidades, configurador de la home, bindings de búsqueda, precios y
pago, corrección de examen, y varios más — son 46 módulos en `ui/`, 18 en
`services/`, y 16 en `utils/` a esta altura. Lo que queda en `main.js` es
lo que es genuinamente inherente a la orquestación: declaración del estado
mutable del examen en curso, wiring inicial de todos los módulos vía
`configure()`, y algunas funciones de flujo de examen (navegación,
guardado de borrador, edición admin en vivo) que están entrelazadas con
ese estado de forma difícil de separar sin más riesgo del que vale la pena
por ahora.

Se eliminó código muerto real en el camino: archivos completos sin ninguna
referencia (`state/appState.js`, `ui/welcomeView.js`,
`ui/examQuestionRenderer.js`, `ui/labValues.js`, un cliente de Supabase
alternativo en `config/supabase.js` — por eso ya no existe esa carpeta),
funciones nunca llamadas, imports huérfanos, y una dependencia npm que solo
usaba el archivo eliminado (`@supabase/supabase-js`, ya que el cliente real
se inicializa vía `/supabase-global.js`). También se unificó una
duplicación de lógica genuina entre `main.js` y `utils/questionImages.js`
para el cacheo de imágenes de pregunta.
