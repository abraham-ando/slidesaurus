import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { isInside } from "../fs/fsUtils";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
};

export interface StaticServer {
  /** `http://127.0.0.1:<port>` — no trailing slash. */
  origin: string;
  close(): Promise<void>;
}

function safeDecode(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

/**
 * Serve a built Slidev presentation (`rootDir`) under its `--base` path on an
 * ephemeral loopback port, with an SPA fallback to `index.html` (Slidev uses
 * the history router). Only used to screenshot the deck: GET/HEAD only, never
 * serves anything outside `rootDir`.
 */
export function serveStatic(rootDir: string, basePath: string): Promise<StaticServer> {
  const root = path.resolve(rootDir);
  const base = safeDecode(basePath.endsWith("/") ? basePath : `${basePath}/`) ?? "/";

  const server = http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    const pathname = safeDecode(new URL(req.url ?? "/", "http://localhost").pathname);
    if (pathname === undefined || !`${pathname}/`.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    let file = path.resolve(root, `.${pathname.slice(base.length - 1)}`);
    if (!isInside(root, file)) {
      res.writeHead(404).end();
      return;
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      // Directory or client-side route (`/1`, `/print`…) → the SPA entry.
      // A missing asset (has an extension) is a real 404.
      if (path.extname(file) && file !== root) {
        res.writeHead(404).end();
        return;
      }
      file = path.join(root, "index.html");
    }
    res.writeHead(200, { "Content-Type": CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(file).on("error", () => res.destroy()).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}
