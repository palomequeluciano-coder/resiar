// RESIAR — Worker de Cloudflare para el Custom Domain resiarg.com.ar.
//
// El Custom Domain está atado a la RAÍZ del dominio (no a una ruta
// específica), así que este Worker recibe todas las requests del sitio.
// El build del frontend (ver vite.config.js) vive físicamente bajo
// examenes-medicos/ dentro de dist/, reflejando la única URL pública real
// de la app: https://resiarg.com.ar/examenes-medicos/.
//
// Reglas:
// 1) Cualquier request fuera de /examenes-medicos (incluida la raíz "/")
//    redirige ahí.
// 2) Dentro de /examenes-medicos, los archivos estáticos que existen se
//    sirven directos (Cloudflare ya lo hace antes de llegar acá, esto
//    solo corre para los que NO matchean ningún archivo real).
// 3) Cualquier ruta bajo /examenes-medicos que no matchea un archivo real
//    (ej. una ruta profunda del router del lado del cliente) cae al
//    index.html de la app, para que el enrutado de main.js se haga cargo.

const APP_PREFIX = '/examenes-medicos';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith(APP_PREFIX)) {
      const target = new URL(`${APP_PREFIX}/`, url);
      return Response.redirect(target, 302);
    }

    // Llegamos acá solo si el asset no matcheó un archivo físico
    // (run_worker_first está en false por defecto), así que servimos el
    // index.html de la app como fallback tipo SPA.
    const fallbackUrl = new URL(`${APP_PREFIX}/index.html`, url);
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};
