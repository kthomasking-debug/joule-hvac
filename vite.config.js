import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  // Environment-dependent base path:
  // - GitHub Pages: set VITE_BASE_PATH=/engineering-tools/ (or your repo name)
  // - Netlify/Vercel: set VITE_BASE_PATH=/ or leave unset (defaults to /)
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    // Force port 5173 - don't let Vite move to 5174, 5175, etc.
    // This prevents "zombie process" port conflicts
    port: 5173,
    strictPort: true, // Fail if port is busy instead of trying next port
    host: true, // Listen on all addresses
  },
  resolve: {
    alias: {
      // Ensure only one React instance is used across the app
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    },
  },
  plugins: [
    react(),
    legacy({
      // Target Android 4.4 KitKat / 5.0 Lollipop (Chrome 30-40)
      targets: ["android >= 4.4", "chrome >= 30"],
      // Include runtime polyfills where needed
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
      // Render legacy chunks alongside modern chunks to improve loading on older platforms
      renderLegacyChunks: true,
      // Modern polyfills for fetch, Promise, etc.
      modernPolyfills: false,
    }),
  ],
  // No proxy needed - agent runs client-side now!
  // Temperature endpoints can be accessed directly or via external thermometer API
  build: {
    // Target ES5 for maximum compatibility with Android 4.4 KitKat
    target: "es5",
    chunkSizeWarningLimit: 1500,
    // Enable minification for production
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: false, // Keep console in dev, but can be true for production
        drop_debugger: true,
      },
    },
    // Enable source maps for better debugging (disabled in production for smaller bundles)
    sourcemap: process.env.NODE_ENV === "production" ? false : true,
    commonjsOptions: {
      // Ensure React is treated as a CommonJS module correctly
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        // Ensure React chunks are loaded in the correct order
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        // Manual chunk splitting for better caching and parallel loading
        manualChunks: (id) => {
          // Split large vendor libraries into separate chunks
          if (id.includes("node_modules")) {
            // React and React DOM together (frequently used together)
            // Be specific: only match exact 'react' and 'react-dom', not 'react-router' or other react-* packages
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("\\react\\") ||
              id.includes("\\react-dom\\")
            ) {
              return "react-vendor";
            }
            // Router (must come after React check to avoid conflicts)
            if (id.includes("react-router")) {
              return "router";
            }
            // Large charting library (heavy dependency, load on demand)
            if (id.includes("recharts")) {
              return "charts";
            }
            // 3D library (only used in specific pages, very heavy)
            if (id.includes("three")) {
              return "three";
            }
            // Animation library (only used in specific components)
            if (id.includes("framer-motion")) {
              return "animations";
            }
            // AI/LLM libraries (large, can be lazy loaded)
            if (id.includes("@ai-sdk") || id.includes("ai/")) {
              return "ai";
            }
            // Markdown rendering (only used in docs/markdown pages)
            if (
              id.includes("react-markdown") ||
              id.includes("remark") ||
              id.includes("rehype")
            ) {
              return "markdown";
            }
            // Syntax highlighting (only used in docs)
            if (id.includes("react-syntax-highlighter")) {
              return "syntax";
            }
            // PDF generation (lazy loaded, should never be in main bundle)
            if (id.includes("jspdf") || id.includes("html2canvas")) {
              return "pdf";
            }
            // Icon library (lucide-react) - large but tree-shakeable
            if (id.includes("lucide-react")) {
              return "icons";
            }
            // Zod validation library
            if (id.includes("zod")) {
              return "validation";
            }
            // Other large node_modules
            return "vendor";
          }
        },
      },
    },
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
