import { defineConfig } from "vite";

export default defineConfig({
  base: "/examenes-medicos/",

  build: {
    // Anidado bajo "examenes-medicos" para que la estructura física de
    // archivos coincida exactamente con la ruta pública real del sitio
    // (https://resiarg.com.ar/examenes-medicos/), tal como se sirve hoy.
    // Esto es lo que permite que Cloudflare Workers (assets estáticos)
    // resuelva /examenes-medicos/assets/... contra el archivo correcto,
    // en vez de depender de un rewrite/hotfix de rutas en el Worker.
    outDir: "dist/examenes-medicos",
    emptyOutDir: true,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
  },

  preview: {
    host: "0.0.0.0",
    port: 4173,
  },

  test: {
    environment: "jsdom",
    globals: false,
  },
});
