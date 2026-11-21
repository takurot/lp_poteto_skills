// Dependency-free static server for the E2E suite. It mirrors the parts of Cloudflare Workers Static
// Assets the site relies on (SPEC §5.4): directory index with html_handling "auto-trailing-slash" and
// not_found_handling "404-page". Dotfiles such as the .build-output marker are never served.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "build");
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const isFile = (file) => fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;

// Returns { file } to serve, { redirect } for a canonical URL, or {} for not found.
function resolve(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith(".") || segment.includes("\\"))) return {};
  const target = path.join(root, ...segments);
  if (!target.startsWith(root)) return {};
  if (pathname.endsWith("/index.html")) return { redirect: pathname.slice(0, -"index.html".length) };
  if (pathname.endsWith("/")) return isFile(path.join(target, "index.html")) ? { file: path.join(target, "index.html") } : {};
  if (isFile(target)) return { file: target };
  if (isFile(path.join(target, "index.html"))) return { redirect: `${pathname}/` };
  return {};
}

function send(response, status, file, method) {
  const body = fs.readFileSync(file);
  response.writeHead(status, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "content-length": body.length });
  response.end(method === "HEAD" ? undefined : body);
}

function handle(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" }).end();
    return;
  }
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (/[\0\r\n]/.test(pathname)) throw new Error(`unsafe path ${JSON.stringify(pathname)}`);
  const { file, redirect } = resolve(pathname);
  if (redirect) {
    response.writeHead(307, { location: redirect }).end();
  } else if (file) {
    send(response, 200, file, request.method);
  } else {
    send(response, 404, path.join(root, "404.html"), request.method);
  }
}

// A malformed URL or a missing 404.html answers 400 for that request instead of stopping the server.
http
  .createServer((request, response) => {
    try {
      handle(request, response);
    } catch (error) {
      console.error(`serve: ${request.url}: ${error.message}`);
      if (!response.headersSent) response.writeHead(400);
      response.end();
    }
  })
  .listen(port, "127.0.0.1", () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
