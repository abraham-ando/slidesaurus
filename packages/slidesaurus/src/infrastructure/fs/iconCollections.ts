/**
 * Iconify collections made resolvable from the isolated build directory.
 *
 * Why: Slidev resolves icon collections (`@iconify-json/<name>`) from its
 * roots in this order — the deck directory, the addons, the theme, then
 * `@slidev/client`. `@iconify/utils` does not cache a collection that is not
 * found, so EVERY icon lookup walks up `node_modules` from the deck directory
 * (deep, below `.docusaurus/`) for each collection that only `@slidev/client`
 * provides — or that nobody provides (`vscode-icons` code-title icons…).
 * Measured: ~190 000 `stat` calls, ~20 s of a ~40 s `slidev build` on Windows.
 *
 * What: in `{isolatedDir}/node_modules/@iconify-json/`, for each collection
 * resolved by NONE of the earlier roots (site, addons, theme):
 *   - a link to the package `@slidev/client` resolves — the one Slidev would
 *     end up loading anyway;
 *   - otherwise an empty collection (the icons render nothing, exactly as
 *     when the collection is missing).
 * A collection resolvable from the site, an addon or the theme is never
 * shadowed. The output is therefore unchanged; only the lookups are faster.
 */
import fs from "node:fs";
import path from "node:path";
import { TREE_WALK_MAX_DEPTH } from "../../domain/constants";
import { walkUpTree } from "../../shared/utils";

const SCOPE = "@iconify-json";
/** `i-<collection>:<icon>` (UnoCSS colon syntax) in the Slidev client sources. */
const COLON_ICON_RE = /\bi-([a-z0-9]+(?:-[a-z0-9]+)*):[a-z0-9]/g;
const COLLECTION_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SCAN_EXTENSIONS = new Set([".vue", ".ts", ".js", ".mjs", ".md"]);

/** Package directory of `name` resolved like Node from `fromDir` (walking up), or undefined. */
export function findPackageDir(
  fromDir: string,
  name: string,
): string | undefined {
  return walkUpTree(fromDir, TREE_WALK_MAX_DEPTH * 2, (dir) => {
    const candidate = path.join(dir, "node_modules", ...name.split("/"));
    return fs.existsSync(path.join(candidate, "package.json"))
      ? fs.realpathSync(candidate)
      : undefined;
  });
}

/** Collections installed next to a package (its `node_modules` scopes, walking up). */
function installedCollections(packageDir: string): string[] {
  const names = new Set<string>();
  walkUpTree(packageDir, TREE_WALK_MAX_DEPTH * 2, (dir) => {
    const scopeDir = path.join(dir, "node_modules", SCOPE);
    try {
      for (const entry of fs.readdirSync(scopeDir))
        if (COLLECTION_NAME_RE.test(entry)) names.add(entry);
    } catch {
      // no such scope here
    }
    return undefined;
  });
  return [...names];
}

const clientScanCache = new Map<string, string[]>();

/** Collections referenced with the colon syntax by the `@slidev/client` sources (memoized). */
function referencedCollections(clientDir: string): string[] {
  const cached = clientScanCache.get(clientDir);
  if (cached) return cached;
  const names = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (
        entry.name === "node_modules" ||
        (entry.name.startsWith(".") && entry.name !== ".generated")
      )
        continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
        for (const m of fs.readFileSync(full, "utf-8").matchAll(COLON_ICON_RE))
          names.add(m[1]);
      }
    }
  };
  try {
    walk(clientDir);
  } catch {
    // best effort
  }
  const result = [...names];
  clientScanCache.set(clientDir, result);
  return result;
}

/** True when `@iconify-json/<name>` is resolvable from `fromDir`. */
function resolvable(fromDir: string, name: string): boolean {
  return findPackageDir(fromDir, `${SCOPE}/${name}`) !== undefined;
}

export interface IconCollectionRoots {
  /** Site directory — every ancestor of the isolated deck directory (user root). */
  siteDir: string;
  /** Package directories of the deck's addons and theme (Slidev roots), any order. */
  packageDirs: string[];
  /** Package directory of `@slidev/client`. */
  clientDir: string;
}

/**
 * Create the links / empty collections in `{isolatedDir}/node_modules/@iconify-json/`.
 * Best effort: any failure leaves Slidev's normal (slow) resolution.
 * @returns `{ linked, stubbed }` collection names — for logs and tests.
 */
export function prepareIconCollections(
  isolatedDir: string,
  roots: IconCollectionRoots,
): { linked: string[]; stubbed: string[] } {
  const linked: string[] = [];
  const stubbed: string[] = [];
  const scopeDir = path.join(isolatedDir, "node_modules", SCOPE);
  const names = new Set([
    ...installedCollections(roots.clientDir),
    ...referencedCollections(roots.clientDir),
  ]);
  for (const name of names) {
    // Found before the client by Slidev's own order: leave it alone.
    if (
      [roots.siteDir, ...roots.packageDirs].some((dir) => resolvable(dir, name))
    )
      continue;
    const target = path.join(scopeDir, name);
    try {
      fs.mkdirSync(scopeDir, { recursive: true });
      const fromClient = findPackageDir(roots.clientDir, `${SCOPE}/${name}`);
      if (fromClient) {
        // A junction needs no privilege on Windows; a plain dir symlink elsewhere.
        fs.symlinkSync(
          fromClient,
          target,
          process.platform === "win32" ? "junction" : "dir",
        );
        linked.push(name);
      } else {
        fs.mkdirSync(target, { recursive: true });
        fs.writeFileSync(
          path.join(target, "package.json"),
          JSON.stringify({
            name: `${SCOPE}/${name}`,
            version: "0.0.0",
            private: true,
          }),
        );
        fs.writeFileSync(
          path.join(target, "icons.json"),
          JSON.stringify({ prefix: name, icons: {} }),
        );
        stubbed.push(name);
      }
    } catch {
      // Unsupported link / read-only FS: Slidev resolves as usual.
    }
  }
  return { linked, stubbed };
}

/** Reset the client scan memo — for tests only. */
export function _resetIconCollectionCache(): void {
  clientScanCache.clear();
}
