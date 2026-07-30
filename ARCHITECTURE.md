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
- **Tiempo real**: `cloudflare/arena-live-worker` (Durable Objects), para el
  modo de duelo/arena en vivo. Se deploya aparte con `wrangler`, no está
  atado al deploy del frontend.

## Estructura de carpetas

```
src/
├── main.js              ← orquestador principal (bootstrap, wiring de UI)
├── config/              ← configuración (cliente de Supabase, etc.)
├── state/                ← estado compartido de la app (appState, viewState)
├── services/             ← lógica de negocio y llamadas a Supabase
├── ui/                    ← renderizado y manejo del DOM por feature
└── utils/                 ← funciones puras, sin dependencias de DOM/red
```

**Regla simple para decidir dónde va algo nuevo:**

| Si la función... | Va en... |
|---|---|
| No toca el DOM ni hace llamadas de red, solo transforma datos | `utils/` |
| Llama a Supabase, hace fetch, o coordina lógica de negocio | `services/` |
| Renderiza HTML o maneja eventos del DOM | `ui/` |
| Es parte del arranque/orquestación general de la app | `main.js` (tratar de que sea lo mínimo posible) |

## El patrón `configure()`

Varios módulos de `services/` y `ui/` (por ejemplo `access.js`,
`markedQuestions.js`, `questionSearchPreview.js`, `stats.js`) usan el mismo
patrón para evitar dependencias circulares con `main.js`, ya que `main.js`
tiene variables de estado (`currentUser`, `examen`, `sb`, etc.) que estos
módulos necesitan leer, pero que no pueden importar directamente:

```js
// services/miModulo.js
let deps = {
  getCurrentUser: () => null,
  // ...valores por defecto
};

export function configureMiModulo(overrides = {}) {
  deps = { ...deps, ...overrides };
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

Al agregar una función nueva que necesita estado de `main.js`, seguí este
patrón en vez de agregarla directamente a `main.js`.

## Qué NO tocar sin pruebas extensas

- **`resiarEvaluateQuestionAnswer` y funciones de corrección de examen**
  (en `main.js`, cerca de la lógica de `respuestas`/`examen`): decide si una
  respuesta está bien o mal. Un bug acá corrige mal exámenes reales sin que
  se note. Cualquier refactor de esto necesita tests con datos reales antes
  de tocarlo, no solo verificar que compile.

## Tests

```bash
npm run test        # corre los tests una vez
npm run test:watch  # modo watch, útil mientras desarrollás
```

Los tests viven en `src/__tests__/` y usan [Vitest](https://vitest.dev) con
entorno `jsdom` (para simular `window`/`localStorage`). Cubren por ahora los
módulos ya extraídos de `main.js`:

- `utils/questionImages.js`
- `utils/questionSearchText.js`
- `services/markedQuestions.js`

**Al extraer una función más de `main.js` a `services/` o `utils/`, agregale
tests.** Es lo que hace que la próxima extracción sea rápida de verificar
(correr `npm run test`) en vez de depender de probar todo a mano en el
navegador.

## Historial de refactor de `main.js`

`main.js` empezó en **6.761 líneas**. Se fue reduciendo extrayendo módulos
autocontenidos, verificando en cada paso que:
1. El build (`npm run build`) compile sin errores.
2. No haya funciones duplicadas (misma función definida en dos lugares).
3. El tamaño del bundle final no cambie de forma significativa.

Extraído hasta ahora:
- `ui/questionImages.js` — renderizado de imágenes en preguntas
- `services/markedQuestions.js` — preguntas marcadas/favoritas
- `utils/questionSearchText.js` — matching de texto para el buscador
- `services/questionSearchPreview.js` — preview del buscador (DOM + RPC)

Se eliminó código muerto que no se usaba en ningún lado: `authService.js`,
`examService.js`, `questionExposure.js`, `dom.js`, `examStreak.js`.

Quedan ~6.200 líneas en `main.js`. Lo que resta está más entrelazado con
el estado global de la app (navegación de examen, timer, estadísticas en
vivo) — extraerlo requiere más cuidado y, en varios casos, probar a mano en
el navegador además de verificar el build.
