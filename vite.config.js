import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function localApiPlugin() {
  return {
    name: "local-api-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlStr = req.url || "/";
        const pathname = urlStr.split("?")[0];
        if (pathname.startsWith("/api/")) {
          try {
            const { dispatch, findHandler } = await import("./server/router.js");
            if (findHandler(pathname)) {
              const chunks = [];
              req.on("data", (chunk) => {
                chunks.push(chunk);
              });
              req.on("end", async () => {
                const rawBody = Buffer.concat(chunks).toString("utf-8");
                let body = {};
                if (rawBody) {
                  try {
                    body = JSON.parse(rawBody);
                  } catch {
                    body = {};
                  }
                }
                const parsedUrl = new URL(urlStr, "http://localhost");
                const query = {};
                for (const [k, v] of parsedUrl.searchParams.entries()) {
                  query[k] = v;
                }
                const reqWrapper = {
                  method: req.method,
                  url: req.url,
                  headers: req.headers,
                  query,
                  body,
                  socket: { remoteAddress: req.socket?.remoteAddress || "127.0.0.1" },
                };
                let headersSent = false;
                const resHeaders = { "access-control-allow-origin": "*" };
                const resWrapper = {
                  _statusCode: 200,
                  get headersSent() {
                    return headersSent;
                  },
                  status(code) {
                    this._statusCode = code;
                    return this;
                  },
                  setHeader(k, v) {
                    resHeaders[k.toLowerCase()] = v;
                    return this;
                  },
                  json(payload) {
                    const str = JSON.stringify(payload);
                    if (!headersSent) {
                      headersSent = true;
                      resHeaders["content-type"] = "application/json";
                      resHeaders["content-length"] = Buffer.byteLength(str);
                      res.writeHead(this._statusCode, resHeaders);
                    }
                    res.end(str);
                  },
                  send(payload) {
                    const str = typeof payload === "string" ? payload : JSON.stringify(payload);
                    if (!headersSent) {
                      headersSent = true;
                      resHeaders["content-length"] = Buffer.byteLength(str);
                      res.writeHead(this._statusCode, resHeaders);
                    }
                    res.end(str);
                  },
                  end(payload) {
                    if (!headersSent) {
                      headersSent = true;
                      res.writeHead(this._statusCode, resHeaders);
                    }
                    res.end(payload);
                  },
                };
                await dispatch(reqWrapper, resWrapper, pathname);
              });
              return;
            }
          } catch (err) {
            console.error("Local API middleware error:", err);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
    localApiPlugin(),
  ],

  // ── Local development proxy ────────────────────────────────────
  // In production, Vercel routes /api/* to serverless functions automatically.
  // Locally, we proxy /api requests to server.local.js (port 3001) so that
  // the frontend can reach the same handler code without modification.
  server: {
    fs: {
      deny: [
        "**/firebase-service-account.json",
        "**/.env*",
        "**/*.pem",
        "**/*.key",
      ],
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    manifest: true,
    // Target modern browsers — removes unnecessary polyfill bloat
    target: ["es2020", "edge88", "firefox78", "chrome87", "safari14"],
    cssCodeSplit: true,
    // Enable minification of CSS
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React runtime
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/") || id.includes("node_modules/react-router-dom/")) {
            return "vendor-react";
          }
          // Firebase — split per service so unused ones are treeshaken
          if (id.includes("node_modules/firebase/")) {
            return "vendor-firebase";
          }
          // Rich text editor (heavy — only loaded in admin)
          if (id.includes("node_modules/@tiptap/")) {
            return "vendor-tiptap";
          }
          // Animations — large, loaded lazily with pages that use it
          if (id.includes("node_modules/framer-motion/")) {
            return "vendor-motion";
          }
          // PDF / ZIP / QR certificate stack — admin-only, isolated chunk
          if (
            id.includes("node_modules/pdf-lib/") ||
            id.includes("node_modules/jszip/") ||
            id.includes("node_modules/qrcode/")
          ) {
            return "vendor-certificates";
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
