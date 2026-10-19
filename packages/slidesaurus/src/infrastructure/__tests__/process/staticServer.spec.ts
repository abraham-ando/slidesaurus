import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { serveStatic, type StaticServer } from "../../process/staticServer";

let tmpDir: string;
let root: string;
let server: StaticServer;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "static-"));
  root = path.join(tmpDir, "deck");
  fs.mkdirSync(path.join(root, "assets"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.html"), "<html>deck</html>");
  fs.writeFileSync(path.join(root, "assets", "app.js"), "console.log(1)");
  fs.writeFileSync(path.join(tmpDir, "secret.txt"), "secret");
  server = await serveStatic(root, "/training/my%20deck/");
});

afterAll(async () => {
  await server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function get(pathname: string, method = "GET"): Promise<{ status: number; type: string | null; body: string }> {
  const res = await fetch(`${server.origin}${pathname}`, { method });
  return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
}

describe("serveStatic", () => {
  it("listens on the loopback interface only", () => {
    expect(server.origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it("serves files under the (encoded) base path with a content type", async () => {
    const res = await get("/training/my%20deck/assets/app.js");
    expect(res).toMatchObject({ status: 200, body: "console.log(1)" });
    expect(res.type).toContain("text/javascript");
  });

  it("falls back to index.html for client-side routes and the base itself", async () => {
    expect((await get("/training/my%20deck/1?print=true")).body).toBe("<html>deck</html>");
    expect((await get("/training/my%20deck/")).body).toBe("<html>deck</html>");
    expect((await get("/training/my%20deck")).body).toBe("<html>deck</html>");
  });

  it("returns 404 for missing assets and paths outside the base", async () => {
    expect((await get("/training/my%20deck/assets/missing.js")).status).toBe(404);
    expect((await get("/other/index.html")).status).toBe(404);
  });

  it("never serves files outside the root", async () => {
    const res = await get("/training/my%20deck/..%2Fsecret.txt");
    expect(res.body).not.toBe("secret");
  });

  it("only accepts GET and HEAD", async () => {
    expect((await get("/training/my%20deck/", "POST")).status).toBe(405);
    expect((await get("/training/my%20deck/", "HEAD")).status).toBe(200);
  });
});
