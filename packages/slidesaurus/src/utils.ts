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
  return segment.replace(/^\//, "").replace(/\/$/, "");
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
 * Allows scoped packages (@scope/name), regular names (my-pkg),
 * and local paths (./local or /absolute).
 */
const SAFE_NPM_PKG = /^(@[a-zA-Z0-9_-]+\/)?[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * Validate a resolved npm package name to prevent shell injection.
 * Local paths (starting with . / \) are passed through unchanged.
 * Throws an Error if the name contains disallowed characters.
 */
export function validatePackageName(name: string): string {
  // Local paths are controlled by the developer and not user-facing input
  if (name.startsWith(".") || name.startsWith("/") || name.startsWith("\\")) {
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
