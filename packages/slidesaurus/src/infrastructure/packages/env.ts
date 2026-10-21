/**
 * Shared environment utilities for child process spawning.
 * Centralizes the environment allowlist passed to every child process
 * (Slidev builds/exports, package installs).
 */

/** Safe environment variable keys allowed in child processes */
const ENV_ALLOWLIST = [
  "PATH",
  "PATHEXT",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "TEMP",
  "TMP",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "NODE_ENV",
  // npm_config_registry is intentionally excluded — inheriting a malicious registry
  // from the host environment would allow autoInstall to fetch packages from it.
  // npm_config_cache is also excluded for consistency — child processes use the
  // default npm cache location, preventing a compromised cache path from being injected.
  "PNPM_HOME",
  "NVM_DIR",
  "NVM_HOME",
  "SystemRoot",
  "COMSPEC",
  "windir",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "COMMONPROGRAMFILES",
  // Terminal color control — safe to inherit so Slidev output respects the
  // user's terminal preferences (e.g. FORCE_COLOR=1 in verbose mode).
  "FORCE_COLOR",
  "NO_COLOR",
  // Corporate networks: package installs and Playwright downloads must honour the
  // proxy / custom CA configuration. Matching is case-insensitive, so the
  // lowercase variants (http_proxy, https_proxy, no_proxy) are allowed too.
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "NODE_EXTRA_CA_CERTS",
  // Playwright browser location (thumbnail / PDF export) and CI detection.
  "PLAYWRIGHT_BROWSERS_PATH",
  "CI",
];

/**
 * Filter environment variables to an allowlist of safe keys.
 * Prevents leaking secrets, tokens, or credentials to child processes.
 * @param env - The process environment to filter
 * @param additionalKeys - Extra keys to allow beyond the default allowlist
 */
export function filterEnvAllowlist(
  env: NodeJS.ProcessEnv,
  additionalKeys: string[] = [],
): Record<string, string> {
  const filtered: Record<string, string> = {};
  const allowSet = new Set(
    [...ENV_ALLOWLIST, ...additionalKeys].map((k) => k.toUpperCase()),
  );
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && allowSet.has(key.toUpperCase())) {
      filtered[key] = value;
    }
  }
  return filtered;
}
