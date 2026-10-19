import http from "node:http";
import https from "node:https";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = path.join(root, "dist/client");
const { handleRequest } = await import("../dist/server/entry-server.js");
const portIndex = process.argv.indexOf("--port");
const port = Number(
  process.env.PORT || (portIndex >= 0 ? process.argv[portIndex + 1] : 5174),
);
const host = process.env.HOST || "127.0.0.1";
const publicOrigin =
  process.env.SITE_URL ||
  (process.env.NODE_ENV === "production" ? "" : `http://127.0.0.1:${port}`);
if (!publicOrigin)
  throw new Error(
    "SITE_URL is required in production (e.g. https://shop.example.com)",
  );
const site = new URL(publicOrigin);
if (
  !["http:", "https:"].includes(site.protocol) ||
  site.username ||
  site.password ||
  site.pathname !== "/" ||
  site.search ||
  site.hash
)
  throw new Error(
    "SITE_URL must be an HTTP(S) origin without credentials, path or query",
  );
const api = (
  process.env.SERVER_API_URL ||
  `${process.env.API_PROXY_TARGET || "http://localhost:3000"}/api`
).replace(/\/$/, "");
const apiUrl = new URL(api);
if (!["http:", "https:"].includes(apiUrl.protocol))
  throw new Error("SERVER_API_URL must be HTTP(S)");
const template = await readFile(path.join(client, "index.html"), "utf8");
const mime = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url || "/", site.origin).pathname;
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      const target = new URL(request.url, apiUrl.origin);
      const transport = target.protocol === "https:" ? https : http;
      const proxy = transport.request(
        target,
        {
          method: request.method,
          headers: { ...request.headers, host: target.host },
        },
        (upstream) => {
          response.writeHead(upstream.statusCode || 502, upstream.headers);
          upstream.pipe(response);
        },
      );
      proxy.setTimeout(20_000, () => proxy.destroy(new Error("API timeout")));
      proxy.on("error", () => {
        if (!response.headersSent) response.writeHead(502);
        response.end();
      });
      request.on("aborted", () => proxy.destroy());
      request.pipe(proxy);
      return;
    }
    if (pathname.startsWith("/assets/")) {
      if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end();
        return;
      }
      const filename = path.resolve(client, "." + decodeURIComponent(pathname));
      if (!filename.startsWith(path.join(client, "assets") + path.sep)) {
        response.writeHead(404);
        response.end();
        return;
      }
      try {
        if (!(await stat(filename)).isFile()) throw new Error("Not a file");
        const body = await readFile(filename);
        response.writeHead(200, {
          "Content-Type":
            mime[path.extname(filename)] || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        });
        response.end(request.method === "HEAD" ? undefined : body);
      } catch {
        response.writeHead(404);
        response.end();
      }
      return;
    }
    await handleRequest(request, response, {
      template,
      origin: site.origin,
      api,
      publicApi: process.env.VITE_API_URL || "/api",
    });
  } catch (error) {
    console.error(
      "Storefront request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    if (!response.headersSent)
      response.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
    response.end("Storefront is temporarily unavailable");
  }
});
server.listen(port, host, () =>
  console.log(`Besik SSR: http://${host}:${port}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.close(() => process.exit(0)));
