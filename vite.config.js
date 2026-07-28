import { defineConfig } from "vite";

export default defineConfig({
  base: "/examenes-medicos/",

  build: {
    outDir: "dist",
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
});
