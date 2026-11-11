import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { quasar, transformAssetUrls } from "@quasar/vite-plugin";

// Raiz del proyecto (donde vive este archivo).
const raizProyecto = fileURLToPath(new URL(".", import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Permite que componentes de Quasar (q-img, q-avatar, etc.) resuelvan
    // rutas de /src/assets igual que las etiquetas <img>.
    vue({ template: { transformAssetUrls } }),

    // Sobre escribe los colores de marca de Quasar desde variables.scss.
    quasar({ sassVariables: "src/styles/variables.scss" }),
  ],

  resolve: {
    alias: {
      // "@" siempre apunta a /src.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  css: {
    preprocessorOptions: {
      // El plugin de Quasar inyecta @import de variables.scss usando una ruta
      // relativa a la raiz; agregamos la raiz a las rutas de busqueda de Sass.
      scss: { loadPaths: [raizProyecto] },
      sass: { loadPaths: [raizProyecto] },
    },
  },

  server: {
    port: 5173, // mismo puerto permitido por CORS_ORIGIN del backend
    strictPort: true,
  },

  build: {
    // El backend Express no sirve archivos estaticos; el frontend se publica
    // por separado. Si mas adelante se agrega express.static, cambiar a
    // ../Backend/public.
    outDir: "dist",
    emptyOutDir: true,
  },
});
