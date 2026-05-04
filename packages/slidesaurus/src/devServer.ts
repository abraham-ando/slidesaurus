import type { PresentationMetadata, PluginOptions } from "./types";
import { DevServerManager } from "./devServerManager";

// Module-level reference to the active manager. A second call to
// allocateDevPorts() (e.g. on Docusaurus hot-reload) stops the previous
// manager's processes before creating a new one, preventing orphaned Slidev
// processes from accumulating.
let currentManager: DevServerManager | null = null;

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
  currentManager?.stopAll();
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
