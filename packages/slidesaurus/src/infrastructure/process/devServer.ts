import type { PresentationMetadata, PluginOptions } from "../../domain/types";
import { DevServerManager } from "./devServerManager";

/**
 * Module-level singleton for the active DevServerManager.
 *
 * In Docusaurus dev mode, ES modules are NOT re-evaluated on hot-reload:
 * `currentManager` persists across successive `loadContent()` / `assignDevPorts()`
 * invocations. `assignDevPorts()` stops the previous manager before creating a
 * new one to prevent orphaned Slidev processes from accumulating.
 *
 * Port release note: `stopAll()` sends SIGTERM synchronously but ports are
 * freed asynchronously by the OS. Race conditions are handled by the
 * pre-spawn `net.createServer` port check inside `DevServerManager.startOne()`.
 */
let currentManager: DevServerManager | null = null;

/** @internal — Reset module state between tests to ensure isolation. */
export function resetManagerForTesting(): void {
  currentManager?.stopAll();
  currentManager = null;
}

/**
 * Synchronously pre-assign ports (basePort + index) for eligible presentations.
 * No HTTP probing — fast, instant. Returns a map of presentationId → port.
 * If a port is occupied when the server actually starts, the start fails once
 * and is not retried (failedStarts guard prevents infinite restart loops).
 */
export function assignDevPorts(
  presentations: PresentationMetadata[],
  options: PluginOptions,
  siteDir: string,
): Map<string, number> {
  if (currentManager) currentManager.stopAll();
  currentManager = new DevServerManager(siteDir, options);
  return currentManager.preAssignPorts(presentations);
}

/**
 * Return the URL of a running Slidev dev server, starting it on first call.
 * Returns undefined if the presentation is not eligible or port allocation failed.
 */
export async function getOrStartDevServer(
  id: string,
  presentations: PresentationMetadata[],
): Promise<string | undefined> {
  return currentManager?.getOrStart(id, presentations);
}

/**
 * Stop all running Slidev dev servers and clear the module-level reference.
 */
export function stopAllDevServers(): void {
  currentManager?.stopAll();
  currentManager = null;
}
