import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("../../../shared/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    path: (p: string) => p,
    code: (c: string) => c,
  },
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, execFile: vi.fn() };
});

import { execFile } from "node:child_process";
import {
  buildInstallArgs,
  ensureThemeAvailable,
  getInstalledPackageVersion,
  installPackage,
  resolvePmCommand,
  _resetPackageResolverCaches,
  resolveThemePackageName,
  resolveAddonPackageName,
  isPackageInstalled,
  checkPackageAvailable,
  detectPackageManager,
} from "../../packages/packageResolver";

describe("resolveThemePackageName", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-resolver-"));
  });

  it("returns local path as-is", () => {
    expect(resolveThemePackageName("./my-theme", tmpDir)).toBe("./my-theme");
    expect(resolveThemePackageName("/abs/theme", tmpDir)).toBe("/abs/theme");
  });

  it("returns scoped package as-is", () => {
    expect(resolveThemePackageName("@slidev/theme-seriph", tmpDir)).toBe("@slidev/theme-seriph");
  });

  it("returns community full name as-is", () => {
    expect(resolveThemePackageName("slidev-theme-unicorn", tmpDir)).toBe("slidev-theme-unicorn");
  });

  it("resolves shorthand to official prefix when nothing installed", () => {
    // Neither official nor community is installed → defaults to official
    expect(resolveThemePackageName("seriph", tmpDir)).toBe("@slidev/theme-seriph");
  });

  it("resolves shorthand to community when community is installed", () => {
    // Create a fake community theme in node_modules
    const pkgDir = path.join(tmpDir, "node_modules", "slidev-theme-unicorn");
    fs.mkdirSync(pkgDir, { recursive: true });

    expect(resolveThemePackageName("unicorn", tmpDir)).toBe("slidev-theme-unicorn");
  });
});

describe("resolveAddonPackageName", () => {
  it("returns local path as-is", () => {
    expect(resolveAddonPackageName("./my-addon")).toBe("./my-addon");
  });

  it("returns scoped package as-is", () => {
    expect(resolveAddonPackageName("@org/addon")).toBe("@org/addon");
  });

  it("returns community full name as-is", () => {
    expect(resolveAddonPackageName("slidev-addon-foo")).toBe("slidev-addon-foo");
  });

  it("resolves shorthand to community prefix", () => {
    expect(resolveAddonPackageName("foo")).toBe("slidev-addon-foo");
  });
});

describe("isPackageInstalled", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-installed-"));
  });

  it("returns true when package exists in node_modules", () => {
    const pkgDir = path.join(tmpDir, "node_modules", "some-pkg");
    fs.mkdirSync(pkgDir, { recursive: true });

    expect(isPackageInstalled("some-pkg", tmpDir)).toBe(true);
  });

  it("returns false when package does not exist", () => {
    expect(isPackageInstalled("nonexistent-pkg", tmpDir)).toBe(false);
  });

  it("finds scoped packages", () => {
    const pkgDir = path.join(tmpDir, "node_modules", "@slidev", "theme-seriph");
    fs.mkdirSync(pkgDir, { recursive: true });

    expect(isPackageInstalled("@slidev/theme-seriph", tmpDir)).toBe(true);
  });

  it("walks up directory tree for monorepo", () => {
    const child = path.join(tmpDir, "packages", "app");
    fs.mkdirSync(child, { recursive: true });
    const pkgDir = path.join(tmpDir, "node_modules", "hoisted-pkg");
    fs.mkdirSync(pkgDir, { recursive: true });

    expect(isPackageInstalled("hoisted-pkg", child)).toBe(true);
  });
});

describe("checkPackageAvailable", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-available-"));
  });

  it("returns installed for existing package", () => {
    const pkgDir = path.join(tmpDir, "node_modules", "my-pkg");
    fs.mkdirSync(pkgDir, { recursive: true });

    const result = checkPackageAvailable("my-pkg", tmpDir);
    expect(result.installed).toBe(true);
  });

  it("returns not installed with error for missing package", () => {
    const result = checkPackageAvailable("missing-pkg", tmpDir);
    expect(result.installed).toBe(false);
    expect(result.error).toContain("missing-pkg");
  });

  it("checks local path existence", () => {
    const localDir = path.join(tmpDir, "local-theme");
    fs.mkdirSync(localDir, { recursive: true });

    const result = checkPackageAvailable("./local-theme", tmpDir);
    expect(result.installed).toBe(true);
  });

  it("returns not installed for missing local path", () => {
    const result = checkPackageAvailable("./nonexistent", tmpDir);
    expect(result.installed).toBe(false);
    expect(result.error).toContain("Local path not found");
  });

  it("checks package.json dependencies as fallback", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ dependencies: { "some-dep": "^1.0.0" } }),
    );
    const result = checkPackageAvailable("some-dep", tmpDir);
    expect(result.installed).toBe(true);
  });
});

describe("detectPackageManager", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "detect-pm-"));
  });

  it("detects pnpm from lock file", () => {
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(tmpDir)).toBe("pnpm");
  });

  it("detects yarn from lock file", () => {
    fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "");
    expect(detectPackageManager(tmpDir)).toBe("yarn");
  });

  it("detects npm from lock file", () => {
    fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}");
    expect(detectPackageManager(tmpDir)).toBe("npm");
  });

  it("defaults to npm when no lock file found", () => {
    expect(detectPackageManager(tmpDir)).toBe("npm");
  });

  it("walks up directory tree to find lock file", () => {
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    const child = path.join(tmpDir, "packages", "app");
    fs.mkdirSync(child, { recursive: true });
    expect(detectPackageManager(child)).toBe("pnpm");
  });
});

// ── Hardening: shell-free package manager invocation ─────────────────────────

function setPlatform(value: NodeJS.Platform): () => void {
  const original = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { value });
  return () => Object.defineProperty(process, "platform", original);
}

describe("resolvePmCommand", () => {
  let tmpDir: string;
  let restorePlatform: (() => void) | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pm-cmd-"));
  });

  afterEach(() => {
    restorePlatform?.();
    restorePlatform = undefined;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses node + npm_execpath when it points to the detected package manager", () => {
    const entry = path.join(tmpDir, "pnpm.cjs");
    fs.writeFileSync(entry, "");
    expect(resolvePmCommand("pnpm", { npm_execpath: entry, PATH: "" })).toEqual({
      file: process.execPath,
      args: [entry],
    });
  });

  it("ignores npm_execpath of another package manager", () => {
    const entry = path.join(tmpDir, "npm-cli.js");
    fs.writeFileSync(entry, "");
    expect(resolvePmCommand("pnpm", { npm_execpath: entry, PATH: "" })).toBeUndefined();
  });

  it("on Windows, runs the JS entry next to a .cmd shim with node (never the .cmd itself)", () => {
    restorePlatform = setPlatform("win32");
    fs.writeFileSync(path.join(tmpDir, "pnpm.cmd"), "");
    const entry = path.join(tmpDir, "node_modules", "pnpm", "bin", "pnpm.cjs");
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.writeFileSync(entry, "");
    expect(resolvePmCommand("pnpm", { PATH: tmpDir })).toEqual({ file: process.execPath, args: [entry] });
  });

  it("on Windows, runs a native .exe directly", () => {
    restorePlatform = setPlatform("win32");
    const exe = path.join(tmpDir, "pnpm.exe");
    fs.writeFileSync(exe, "");
    expect(resolvePmCommand("pnpm", { PATH: tmpDir })).toEqual({ file: exe, args: [] });
  });

  it("on Windows, returns undefined when only a .cmd shim exists", () => {
    restorePlatform = setPlatform("win32");
    fs.writeFileSync(path.join(tmpDir, "npm.cmd"), "");
    expect(resolvePmCommand("npm", { PATH: tmpDir })).toBeUndefined();
  });

  it("on POSIX, runs the binary found in PATH", () => {
    restorePlatform = setPlatform("linux");
    const bin = path.join(tmpDir, "npm");
    fs.writeFileSync(bin, "");
    expect(resolvePmCommand("npm", { PATH: tmpDir })).toEqual({ file: bin, args: [] });
  });
});

describe("buildInstallArgs", () => {
  it("always disables lifecycle scripts", () => {
    expect(buildInstallArgs("npm", "slidev-theme-x", false)).toEqual(["install", "slidev-theme-x", "--ignore-scripts"]);
    expect(buildInstallArgs("pnpm", "slidev-theme-x", false)).toEqual(["add", "slidev-theme-x", "--ignore-scripts"]);
    expect(buildInstallArgs("yarn", "slidev-theme-x", false)).toEqual(["add", "slidev-theme-x", "--ignore-scripts"]);
  });

  it("does not pass the unsupported flag to Yarn Berry (scripts disabled through env)", () => {
    expect(buildInstallArgs("yarn", "slidev-theme-x", true)).toEqual(["add", "slidev-theme-x"]);
  });
});

describe("installPackage", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pm-install-"));
    _resetPackageResolverCaches();
    vi.mocked(execFile).mockReset();
    vi.mocked(execFile).mockImplementation(((...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: Error | null, out: { stdout: string; stderr: string }) => void;
      cb(null, { stdout: "", stderr: "" });
    }) as never);
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    const entry = path.join(tmpDir, "pnpm.cjs");
    fs.writeFileSync(entry, "");
    vi.stubEnv("npm_execpath", entry);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("runs the package manager without a shell, with --ignore-scripts and a timeout", async () => {
    await expect(installPackage("slidev-theme-unicorn", tmpDir, "theme")).resolves.toBe(true);
    const [file, args, opts] = vi.mocked(execFile).mock.calls[0] as unknown as [
      string, string[], { shell: boolean; timeout: number; env: Record<string, string>; cwd: string },
    ];
    expect(file).toBe(process.execPath);
    expect(args).toEqual([path.join(tmpDir, "pnpm.cjs"), "add", "slidev-theme-unicorn", "--ignore-scripts"]);
    expect(opts.shell).toBe(false);
    expect(opts.timeout).toBeGreaterThan(0);
    expect(opts.cwd).toBe(tmpDir);
    expect(opts.env.npm_config_ignore_scripts).toBe("true");
  });

  it("refuses to install a package that is not a Slidev theme / addon", async () => {
    await expect(installPackage("lodash", tmpDir, "theme")).resolves.toBe(false);
    await expect(installPackage("@org/addon", tmpDir, "addon")).resolves.toBe(false);
    expect(execFile).not.toHaveBeenCalled();
  });

  it("returns false when the package manager fails", async () => {
    vi.mocked(execFile).mockImplementation(((...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: Error | null) => void;
      cb(new Error("ETIMEDOUT"));
    }) as never);
    await expect(installPackage("slidev-addon-qrcode", tmpDir, "addon")).resolves.toBe(false);
  });
});

describe("ensureThemeAvailable — name validation", () => {
  it("rejects a scoped package that is not a Slidev theme", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ensure-theme-"));
    await expect(ensureThemeAvailable("@evil/pkg", tmpDir, true)).rejects.toThrow(/Invalid Slidev theme/);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("isPackageInstalled — negative cache TTL", () => {
  afterEach(() => vi.useRealTimers());

  it("re-checks the filesystem once the negative entry expired", () => {
    _resetPackageResolverCaches();
    vi.useFakeTimers({ toFake: ["Date"] });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-ttl-"));
    expect(isPackageInstalled("slidev-theme-late", tmpDir)).toBe(false);

    fs.mkdirSync(path.join(tmpDir, "node_modules", "slidev-theme-late"), { recursive: true });
    // Still memoized as "not installed" within the TTL
    expect(isPackageInstalled("slidev-theme-late", tmpDir)).toBe(false);

    vi.setSystemTime(Date.now() + 31_000);
    expect(isPackageInstalled("slidev-theme-late", tmpDir)).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("getInstalledPackageVersion", () => {
  it("reads the version of an installed package and undefined otherwise", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-version-"));
    const dir = path.join(tmpDir, "node_modules", "@slidev", "theme-seriph");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ version: "0.25.0" }));
    expect(getInstalledPackageVersion("@slidev/theme-seriph", tmpDir)).toBe("0.25.0");
    expect(getInstalledPackageVersion("slidev-theme-none", tmpDir)).toBeUndefined();
    expect(getInstalledPackageVersion("./local", tmpDir)).toBeUndefined();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
