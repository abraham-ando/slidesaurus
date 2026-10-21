/**
 * Stable identifier used for cache directory naming and plugin registration.
 * Intentionally NOT derived from package.json — renaming or forking the npm
 * package must not silently invalidate all users' incremental build caches.
 */
export const PLUGIN_NAME = "slidesaurus" as const;

// Process management
export const SIGKILL_DELAY_MS = 5_000;

// Memory caps for child process stderr capture
export const STDERR_MAX_BYTES = 100 * 1024;

// Export / thumbnail timeouts
export const THUMBNAIL_TIMEOUT_CAP_MS = 60_000;
export const EXPORT_TIMEOUT_CAP_MS = 120_000;
export const EXPORT_GRACE_MS = 15_000;

// Directory tree traversal — supports monorepos up to 10 levels deep
export const TREE_WALK_MAX_DEPTH = 10;
