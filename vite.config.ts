import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";

function storefrontSsr(env: Record<string, string>): Plugin {
  return {
    name: "besik-storefront-ssr",
    configureServer(server) {
      return () => {
        server.middlewares.use(async (request, response, next) => {
          try {
            const template = await server.transformIndexHtml(
              request.url || "/",
              await readFile(new URL("./index.html", import.meta.url), "utf8"),
            );
            const { handleRequest } = await server.ssrLoadModule(
              "/src/entry-server.tsx",
            );
            const host = request.headers.host || "127.0.0.1:5174";
            await handleRequest(request, response, {
              template,
              origin: env.SITE_URL || `http://${host}`,
              api: (
                env.SERVER_API_URL ||
                `${env.API_PROXY_TARGET || "http://localhost:3000"}/api`
              ).replace(/\/$/, ""),
              publicApi: env.VITE_API_URL || "/api",
            });
          } catch (error) {
            if (error instanceof Error) server.ssrFixStacktrace(error);
            next(error);
          }
        });
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = {
    "/api": {
      target: env.API_PROXY_TARGET || "http://localhost:3000",
      changeOrigin: true,
    },
  };
  return {
    plugins: [react(), storefrontSsr(env)],
    appType: "custom",
    server: { port: 5174, strictPort: true, proxy },
    preview: { proxy },
  };
});
