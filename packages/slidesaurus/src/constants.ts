import pkg from "../package.json";

/** Plugin name derived from package.json — single source of truth. */
export const PLUGIN_NAME: string = pkg.name;

// Process management
export const SIGKILL_DELAY_MS = 5_000;

// Memory caps for child process stderr capture
export const STDERR_MAX_BYTES = 100 * 1024;
export const DEV_STDERR_MAX_BYTES = 50 * 1024;

// Dev server port allocation
export const MAX_PORT_RETRIES = 20;

// Dev server readiness polling
export const DEV_SERVER_PORT_PROBE_TIMEOUT_MS = 300;
export const DEV_SERVER_POLL_INTERVAL_MS = 500;

// Export / thumbnail timeouts
export const THUMBNAIL_TIMEOUT_CAP_MS = 60_000;
export const EXPORT_TIMEOUT_CAP_MS = 120_000;
export const EXPORT_GRACE_MS = 15_000;

// Directory tree traversal — supports monorepos up to 10 levels deep
export const TREE_WALK_MAX_DEPTH = 10;

// Build concurrency
export const DEFAULT_MAX_PARALLEL_BUILDS = 4;
