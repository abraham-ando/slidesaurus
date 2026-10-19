/**
 * Shared utilities for the slidesaurus plugin
 */
import path from "node:path";

/** Remove trailing slash from a base URL. */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

/** Ensure a route path starts with a slash. */
export function normalizeRoutePath(routePath: string): string {
  return routePath.startsWith("/") ? routePath : `/${routePath}`;
}

/** Strip leading and trailing slashes from a path segment. */
export function stripSlashes(segment: string): string {
  return segment.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Join the site `baseUrl` and the plugin `routeBasePath` into the absolute
 * route prefix used by every plugin page — without trailing slash.
 *
 * Examples:
 *   ("/", "/slidev")        → "/slidev"
 *   ("/docs/", "slidev/")   → "/docs/slidev"
 *   ("/", "/")              → ""   (callers use `|| "/"` for the overview route)
 */
export function buildRouteBase(baseUrl: string, routeBasePath: string): string {
  const base = stripSlashes(baseUrl);
  const route = stripSlashes(routeBasePath);
  const parts = [base, route].filter(Boolean);
  return parts.length > 0 ? `/${parts.join("/")}` : "";
}

/**
 * Percent-encode every segment of a slash-separated presentation / category id
 * so it can be embedded in a URL (spaces, `#`, `?`, `%`… are escaped; `/` is kept).
 */
export function encodeIdForUrl(id: string): string {
  return id.split("/").map(encodeURIComponent).join("/");
}

/**
 * Map a presentation id (which may contain `/`) to a single, filesystem-safe
 * path segment. The mapping is injective: every character outside
 * `[A-Za-z0-9-]` (including `_` itself) is escaped as `_<hex>_`, so
 * `a/b` → `a_2f_b` and `a__b` → `a_5f__5f_b` can never collide.
 */
export function toSafeId(id: string): string {
  let out = "";
  for (const ch of id) {
    out += /[A-Za-z0-9-]/.test(ch) ? ch : `_${ch.codePointAt(0)!.toString(16)}_`;
  }
  return out;
}

/** True when a theme/addon reference is a local path rather than an npm package name. */
export function isLocalPath(name: string): boolean {
  return name.startsWith(".") || name.startsWith("/") || name.startsWith("\\") || path.isAbsolute(name);
}

/**
 * Derive URL path segment from the path option.
 * Examples: './slidev' -> 'slidev', './demos/slides' -> 'slides'
 */
export function getUrlPathFromPath(pathOption: string): string {
  const normalized = pathOption.replace(/^\.?\//, "").replace(/\/$/, "");
  const segments = normalized.split("/");
  return segments.at(-1) || "slidev";
}

/**
 * Valid npm package name pattern.
 * Allows scoped packages (@scope/name) and regular names (my-pkg).
 */
const SAFE_NPM_PKG = /^(@[a-zA-Z0-9_-][a-zA-Z0-9._-]*\/)?[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * Validate a resolved npm package name to prevent argument / shell injection.
 * Local paths (starting with . / \) are passed through unchanged.
 * Throws an Error if the name contains disallowed characters.
 */
export function validatePackageName(name: string): string {
  // Local paths are controlled by the developer and not user-facing input
  if (isLocalPath(name)) {
    return name;
  }
  if (!SAFE_NPM_PKG.test(name)) {
    throw new Error(
      `Invalid package name "${name}". Only alphanumeric characters, hyphens, underscores, dots, ` +
        `and scoped prefixes (@scope/) are allowed.`,
    );
  }
  return name;
}

/** Package name patterns accepted for Slidev themes and addons. */
const SLIDEV_PACKAGE_PATTERNS: Record<"theme" | "addon", RegExp> = {
  // slidev-theme-x | @slidev/theme-x | @scope/slidev-theme-x
  theme: /^(?:slidev-theme-[a-z0-9][a-z0-9._-]*|@slidev\/theme-[a-z0-9][a-z0-9._-]*|@[a-z0-9][a-z0-9._-]*\/slidev-theme-[a-z0-9][a-z0-9._-]*)$/i,
  // slidev-addon-x | @slidev/addon-x | @scope/slidev-addon-x
  addon: /^(?:slidev-addon-[a-z0-9][a-z0-9._-]*|@slidev\/addon-[a-z0-9][a-z0-9._-]*|@[a-z0-9][a-z0-9._-]*\/slidev-addon-[a-z0-9][a-z0-9._-]*)$/i,
};

/**
 * Validate a resolved Slidev theme / addon package name.
 *
 * On top of the syntactic check of `validatePackageName`, enforces the Slidev
 * naming convention so `autoInstall` can never be abused to install an
 * arbitrary package (e.g. a typosquatted `lodash`):
 *   - themes: `slidev-theme-*`, `@slidev/theme-*`, `@scope/slidev-theme-*`
 *   - addons: `slidev-addon-*`, `@slidev/addon-*`, `@scope/slidev-addon-*`
 * Local paths are passed through (their containment is checked separately).
 */
export function validateSlidevPackageName(name: string, kind: "theme" | "addon"): string {
  validatePackageName(name);
  if (isLocalPath(name)) return name;
  if (!SLIDEV_PACKAGE_PATTERNS[kind].test(name)) {
    throw new Error(
      `Invalid Slidev ${kind} package "${name}". Expected "slidev-${kind}-*", "@slidev/${kind}-*" ` +
        `or "@scope/slidev-${kind}-*".`,
    );
  }
  return name;
}

/**
 * Serialise a value to JSON with object keys sorted recursively — stable
 * across Node.js versions and property insertion order. Functions and
 * `undefined` values are dropped (same as JSON.stringify).
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    }
    return v;
  });
}

/**
 * Walk up the directory tree from `startDir`, calling `finder` at each level.
 * Returns the first non-undefined result, or undefined if the root is reached.
 * Stops early when the filesystem root is hit (dirname === dir).
 *
 * Used to locate monorepo-hoisted packages, lock files, and binaries.
 */
export function walkUpTree<T>(
  startDir: string,
  maxDepth: number,
  finder: (dir: string) => T | undefined,
): T | undefined {
  let dir = startDir;
  for (let i = 0; i < maxDepth; i++) {
    const result = finder(dir);
    if (result !== undefined) return result;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}
