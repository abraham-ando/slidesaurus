/**
 * Dev build status file (`docusaurus start`).
 *
 * Single responsibility: keep `{cacheDir}/status/build-status.json` in sync
 * with the background builds. The file is served statically by the dev
 * server (see `webpackConfig.ts`) and polled by `SlidevPresentation`, which
 * shows a "building" / "failed" state and reloads its iframe when `builtAt`
 * changes. Never used by `docusaurus build`.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  BuildProgressListener,
  BuildResult,
  BuildStatusFile,
  PresentationBuildStatus,
  PresentationMetadata,
} from "../../domain/types";
import { getSlidevCacheDir } from "./fileSystem";
import { isCompleteBuildOutput } from "./outputManager";

/** URL segment (below the presentations route) serving the status directory. */
export const BUILD_STATUS_URL_SEGMENT = "__slidesaurus__";
export const BUILD_STATUS_FILE_NAME = "build-status.json";

/** Directory holding the status file — outside `output/`, so it is never published. */
export function getBuildStatusDir(
  siteDir: string,
  pluginId: string,
  locale?: string,
): string {
  return path.join(getSlidevCacheDir(siteDir, pluginId, locale), "status");
}

/** Modification time of the output's `index.html`, or undefined without a complete output. */
function outputBuiltAt(outputPath: string): number | undefined {
  if (!isCompleteBuildOutput(outputPath)) return undefined;
  try {
    return Math.round(fs.statSync(path.join(outputPath, "index.html")).mtimeMs);
  } catch {
    return undefined;
  }
}

/**
 * In-memory build status, written to disk on every change (a few hundred
 * bytes per presentation — cheap). Writes are atomic (temp file + rename) so
 * a poll never reads a truncated JSON.
 */
export class BuildStatusTracker implements BuildProgressListener {
  private readonly file: string;
  private outputPaths = new Map<string, string>();
  private status: BuildStatusFile = { presentations: {} };

  constructor(statusDir: string) {
    this.file = path.join(statusDir, BUILD_STATUS_FILE_NAME);
  }

  /**
   * Start a new run: every presentation is `pending` (with its previous
   * output, if any, still served) unless `error` marks them all as `failed`
   * (Slidev not installed…). Removed presentations disappear.
   */
  reset(presentations: PresentationMetadata[], error?: string): void {
    this.outputPaths = new Map(presentations.map((p) => [p.id, p.outputPath]));
    const next: Record<string, PresentationBuildStatus> = {};
    for (const p of presentations) {
      const builtAt = outputBuiltAt(p.outputPath);
      next[p.id] = {
        state: error ? "failed" : "pending",
        hasOutput: builtAt !== undefined,
        ...(builtAt !== undefined ? { builtAt } : {}),
        ...(error ? { error } : {}),
      };
    }
    this.status = { presentations: next };
    this.write();
  }

  /** Current status of a presentation — for tests and logging. */
  get(id: string): PresentationBuildStatus | undefined {
    return this.status.presentations[id];
  }

  onBuildStart(id: string): void {
    this.update(id, { state: "building" });
  }

  onOutputReady(id: string): void {
    this.refreshOutput(id, "ready");
  }

  onResult(result: BuildResult): void {
    if (result.success) {
      this.refreshOutput(result.id, "ready");
    } else {
      const error = (result.error ?? "unknown error").split("\n")[0];
      this.refreshOutput(result.id, "failed", error);
    }
  }

  private refreshOutput(
    id: string,
    state: PresentationBuildStatus["state"],
    error?: string,
  ): void {
    const outputPath = this.outputPaths.get(id);
    const builtAt = outputPath ? outputBuiltAt(outputPath) : undefined;
    this.update(id, {
      state,
      hasOutput: builtAt !== undefined,
      builtAt,
      error,
    });
  }

  private update(id: string, patch: Partial<PresentationBuildStatus>): void {
    const current = this.status.presentations[id];
    if (!current) return; // removed by a newer reset()
    const merged: PresentationBuildStatus = { ...current, ...patch };
    if (merged.state !== "failed") delete merged.error;
    if (merged.builtAt === undefined) delete merged.builtAt;
    this.status.presentations[id] = merged;
    this.write();
  }

  private write(): void {
    const json = JSON.stringify(this.status);
    const tmp = `${this.file}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(tmp, json, "utf-8");
      try {
        fs.renameSync(tmp, this.file);
      } catch {
        // Windows: the target may be open by the dev server — write in place.
        fs.writeFileSync(this.file, json, "utf-8");
        fs.rmSync(tmp, { force: true });
      }
    } catch {
      // Status is a dev convenience: never fail a build because of it.
    }
  }
}

/**
 * URL of the status file: `{baseUrl}{routeBasePath}/__slidesaurus__/build-status.json`.
 * `routeBase` is `buildRouteBase(baseUrl, routeBasePath)` (no trailing slash).
 */
export function getBuildStatusUrl(routeBase: string): string {
  return `${routeBase}/${BUILD_STATUS_URL_SEGMENT}/${BUILD_STATUS_FILE_NAME}`;
}
