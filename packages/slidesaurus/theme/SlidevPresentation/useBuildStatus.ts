import { useEffect, useState } from "react";
// Type-only: erased at compile time, the published theme never loads `src/`.
import type { BuildStatusFile, PresentationBuildStatus } from "../../src/domain/types";

/** Poll interval while the presentation is queued or building. */
const BUSY_POLL_MS = 1500;
/** Poll interval once it is ready or failed — catches rebuilds after a file save. */
const IDLE_POLL_MS = 3000;

/**
 * Follows the dev build status of one presentation (`docusaurus start`).
 *
 * @param statusUrl - `PluginData.buildStatusUrl`; undefined in production.
 * @returns
 *  - `undefined` when there is no status to follow (production build): the
 *    output is always there, render the presentation directly;
 *  - `null` until the first status has been read;
 *  - the presentation's status otherwise (`pending` when not listed yet).
 *
 * Polling pauses while the tab is hidden.
 */
export function useBuildStatus(
  statusUrl: string | undefined,
  presentationId: string | undefined,
): PresentationBuildStatus | null | undefined {
  const [status, setStatus] = useState<PresentationBuildStatus | null>(null);

  useEffect(() => {
    if (!statusUrl || !presentationId) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setStatus(null);

    const poll = async (): Promise<void> => {
      let next: PresentationBuildStatus | undefined;
      if (document.visibilityState !== "hidden") {
        try {
          // `Accept: application/json` bypasses the dev server's SPA (HTML) fallback.
          const res = await fetch(statusUrl, { cache: "no-cache", headers: { Accept: "application/json" } });
          if (res.ok) {
            const file = (await res.json()) as BuildStatusFile;
            next = file.presentations?.[presentationId] ?? { state: "pending", hasOutput: false };
          } else if (res.status === 404) {
            // No status written yet: the first build run has not started.
            next = { state: "pending", hasOutput: false };
          }
        } catch {
          // Dev server restarting — keep the last known status.
        }
      }
      if (cancelled) return;
      if (next) {
        const value = next;
        setStatus((prev) =>
          prev &&
          prev.state === value.state &&
          prev.hasOutput === value.hasOutput &&
          prev.builtAt === value.builtAt &&
          prev.error === value.error
            ? prev
            : value,
        );
      }
      const busy = !next || next.state === "pending" || next.state === "building";
      timer = setTimeout(poll, busy ? BUSY_POLL_MS : IDLE_POLL_MS);
    };
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [statusUrl, presentationId]);

  return statusUrl ? status : undefined;
}
