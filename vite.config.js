import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

// https://vite.dev/config/
export default defineConfig({
  // Environment-dependent base path:
  // - GitHub Pages: set VITE_BASE_PATH=/engineering-tools/ (or your repo name)
  // - Netlify/Vercel: set VITE_BASE_PATH=/ or leave unset (defaults to /)
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [
    react(),
    legacy({
      // Ensure compatibility with older WebView used by Android 9 (Chromium 69-ish)
      targets: ["defaults", "Android >= 9"],
      // Include runtime polyfills where needed
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
      // Render legacy chunks alongside modern chunks to improve loading on older platforms
      renderLegacyChunks: true,
    }),
  ],
  // No proxy needed - agent runs client-side now!
  // Temperature endpoints can be accessed directly or via external thermometer API
  build: {
    // Target older JS for better Android 9 WebView compatibility
    target: "es2017",
    chunkSizeWarningLimit: 1500,
    // Let Vite handle chunking automatically to avoid React dependency issues
    // Vite will automatically split chunks optimally and maintain correct load order
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.js",
    include: [
      "./src/**/*.test.{js,jsx}",
      "./src/pages/__tests__/**/*.test.{js,jsx}",
    ],
    threads: false,
  },
});
