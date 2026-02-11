import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Custom proxy in dev: forwards /api/llm-proxy to the URL in X-LLM-Target header (bypasses CORS)
function llmProxyPlugin() {
  return {
    name: "llm-proxy",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/llm-proxy/")) return next();
        const target = req.headers["x-llm-target"];
        if (!target || typeof target !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing X-LLM-Target header" }));
          return;
        }
        const targetBase = target.replace(/\/$/, "");
        const pathSuffix = req.url.replace(/^\/api\/llm-proxy/, "") || "/chat/completions";
        const proxyUrl = targetBase + pathSuffix;
        try {
          const isGet = req.method === "GET";
          const fetchOpts = isGet ? { method: "GET" } : {
            method: "POST",
            headers: { "Content-Type": req.headers["content-type"] || "application/json" },
            body: await new Promise((resolve, reject) => {
              const chunks = [];
              req.on("data", (c) => chunks.push(c));
              req.on("end", () => resolve(Buffer.concat(chunks)));
              req.on("error", reject);
            }),
          };
          const proxyRes = await fetch(proxyUrl, fetchOpts);
          res.writeHead(proxyRes.status, {
            "Content-Type": proxyRes.headers.get("content-type") || "application/json",
          });
          const reader = proxyRes.body?.getReader();
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          }
          res.end();
        } catch (err) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(err?.message || err) }));
        }
      });
    },
  };
}

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
    allowedHosts: [
      "centrally-augmented-doreatha.ngrok-free.dev",
      "localhost",
      "127.0.0.1"
    ],
  },
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Ensure only one React instance is used across the app
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    },
  },
  define: {
    // Ensure global is defined for React's scheduler (unstable_now)
    // This fixes "Cannot set properties of undefined (setting 'unstable_now')" error
    // Replace 'global' references with window (globalThis is available in modern browsers)
    global: "window",
  },
  plugins: [
    react(),
    llmProxyPlugin(),
    // Plugin to inject global polyfill at the start of vendor chunks
    {
      name: "inject-global-polyfill",
      generateBundle(options, bundle) {
        // Inject polyfill code at the beginning of vendor and react-vendor chunks
        Object.keys(bundle).forEach((fileName) => {
          const chunk = bundle[fileName];
          if (
            chunk.type === "chunk" &&
            (fileName.includes("vendor") || fileName.includes("react-vendor"))
          ) {
            // Create polyfill that ensures global exists
            const polyfill = `(function(){var g=typeof globalThis!=='undefined'?globalThis:typeof window!=='undefined'?window:typeof self!=='undefined'?self:{};if(typeof global==='undefined'){try{(new Function('g','global=g'))(g)}catch(e){if(typeof globalThis!=='undefined')globalThis.global=g;if(typeof window!=='undefined')window.global=g}}})();`;
            chunk.code = polyfill + "\n" + chunk.code;
          }
        });
      },
    },
  ],
  // No proxy needed - agent runs client-side now!
  // Temperature endpoints can be accessed directly or via external thermometer API
  build: {
    // Target modern browsers (ES2020) - legacy support removed
    target: "es2020",
    chunkSizeWarningLimit: 1500,
    // Enable minification for production
    // Using esbuild instead of terser - more reliable and faster, less prone to initialization errors
    // Disable minification for Playwright test builds to avoid "Cannot access 'Xo' before initialization" errors
    // Test builds still test the bundled code structure (chunking, code splitting) without minification issues
    minify:
      process.env.PLAYWRIGHT_TEST === "true" ||
      process.env.PLAYWRIGHT_TEST === "1"
        ? false
        : "esbuild",
    // Enable source maps for test builds to help debug production issues
    sourcemap:
      process.env.PLAYWRIGHT_TEST === "true" ||
      process.env.PLAYWRIGHT_TEST === "1"
        ? true
        : process.env.NODE_ENV === "production"
        ? false
        : true,
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
        // Ensure proper module initialization order
        // React must be available before libraries that depend on it (like recharts)
        preserveModules: false,
        // Ensure chunks are loaded in dependency order to prevent initialization errors
        // This helps prevent "Cannot access 'X' before initialization" errors
        // Increase min chunk size to reduce over-splitting that can cause circular deps
        experimentalMinChunkSize: 50000,
        // Use a more conservative chunking strategy to avoid circular dependencies
        // This ensures modules are grouped in a way that respects initialization order
        // For Playwright tests, use minimal chunking to avoid initialization order issues
        // The initialization errors ("Cannot access 'Xo' before initialization") are caused
        // by complex chunk dependencies. For tests, we use default chunking or minimal manual chunks.
        manualChunks:
          process.env.PLAYWRIGHT_TEST === "true" ||
          process.env.PLAYWRIGHT_TEST === "1"
            ? undefined // Use Vite's default chunking strategy for test builds - simpler and more reliable
            : (id) => {
                // Split large vendor libraries into separate chunks
                if (id.includes("node_modules")) {
                  // React and React DOM together (frequently used together)
                  // CRITICAL: Also include scheduler in react-vendor to avoid circular dependency
                  // The scheduler is used by React during initialization, so it must be in the same chunk
                  // Be specific: only match exact 'react' and 'react-dom', not 'react-router' or other react-* packages
                  // MUST come first to ensure React is available before other libraries that depend on it
                  if (
                    id.includes("/react/") ||
                    id.includes("/react-dom/") ||
                    id.includes("/scheduler/") ||
                    id.includes("\\react\\") ||
                    id.includes("\\react-dom\\") ||
                    id.includes("\\scheduler\\")
                  ) {
                    return "react-vendor";
                  }
                  // Router (must come after React check to avoid conflicts)
                  if (id.includes("react-router")) {
                    return "router";
                  }
                  // Large charting library (heavy dependency, load on demand)
                  // Note: recharts depends on React, so it must load after react-vendor
                  // The dynamic import in AnalysisGraphs ensures React is available first
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
                  // Dexie (IndexedDB wrapper) - used for CSV storage
                  if (id.includes("dexie")) {
                    return "dexie";
                  }
                  // AI SDK libraries
                  if (id.includes("@ai-sdk")) {
                    return "ai-sdk";
                  }
                  // Express and server-side libraries (shouldn't be in client bundle, but just in case)
                  if (id.includes("express") || id.includes("cors")) {
                    return "server";
                  }
                  // System information (server-side only)
                  if (id.includes("systeminformation")) {
                    return "server";
                  }
                  // Node fetch and other Node.js polyfills
                  if (id.includes("node-fetch")) {
                    return "polyfills";
                  }
                  // Split remaining vendor into smaller, more specific chunks
                  // This helps prevent initialization order issues by isolating libraries
                  if (id.includes("@")) {
                    // Scoped packages - be more conservative to avoid initialization order issues
                    // Note: @ai-sdk is already handled above, so we skip it here

                    // Testing libraries (not needed in production build, but handle gracefully)
                    if (
                      id.includes("@testing-library") ||
                      id.includes("@playwright") ||
                      id.includes("@types")
                    ) {
                      return "vendor-test";
                    }
                    // Vite/ESLint tooling (shouldn't be in client bundle, but handle gracefully)
                    if (id.includes("@vitejs") || id.includes("@eslint")) {
                      return "vendor-tools";
                    }
                    // Capacitor (mobile framework, can be separate)
                    if (id.includes("@capacitor")) {
                      return "capacitor";
                    }
                    // Picovoice (voice recognition - dynamically imported, keep separate)
                    if (id.includes("@picovoice")) {
                      return "picovoice";
                    }
                    // For other scoped packages, put in vendor chunk
                    // Keeping them together helps avoid circular dependency issues
                    return "vendor";
                  }
                  // Large utility libraries
                  if (
                    id.includes("lodash") ||
                    id.includes("ramda") ||
                    id.includes("underscore")
                  ) {
                    return "vendor-utils";
                  }
                  // All other node_modules go into vendor chunk
                  // This ensures they load together and Vite can handle circular deps properly
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
