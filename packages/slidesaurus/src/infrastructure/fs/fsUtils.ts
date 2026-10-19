/**
 * Low-level filesystem helpers shared by the isolated-build, output and asset
 * modules (previously duplicated in each of them).
 */
import fs from "node:fs";
import path from "node:path";

/** Hard-link src to dest; fall back to copyFileSync on cross-device / FAT filesystems. */
export function hardLinkOrCopy(src: string, dest: string): void {
  try {
    fs.linkSync(src, dest);
  } catch {
    fs.copyFileSync(src, dest);
  }
}

/** Recursively copy a directory, skipping symlinks to prevent traversal. */
export function copyDirRecursive(src: string, dest: string): void {
  if (fs.lstatSync(src).isSymbolicLink()) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** True when `child` is `root` itself or located inside it (no `..` escape). */
export function isInside(root: string, child: string): boolean {
  const rel = path.relative(root, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Move a directory, replacing `dest` if it exists. Falls back to copy + delete
 * when `rename` is not possible (cross-device, Windows file locks).
 */
export function replaceDir(src: string, dest: string): void {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.renameSync(src, dest);
  } catch {
    copyDirRecursive(src, dest);
    fs.rmSync(src, { recursive: true, force: true });
  }
}

/** Outcome of `normalizeThumbnailArtifact`. */
export type ThumbnailArtifactState = "file" | "promoted" | "removed" | "absent";

/**
 * Slidev v52 writes PNG exports as a `thumbnail.png/` DIRECTORY containing
 * `1.png` (regardless of export success). Normalise it:
 *   - regular file                → "file"     (nothing to do)
 *   - directory with `1.png`      → "promoted" (moved to a real thumbnail.png file)
 *   - empty / unknown directory   → "removed"  (no broken <img> served)
 *   - missing                     → "absent"
 */
export function normalizeThumbnailArtifact(thumbnailFile: string): ThumbnailArtifactState {
  if (!fs.existsSync(thumbnailFile)) return "absent";
  const stat = fs.statSync(thumbnailFile);
  if (stat.isFile()) return "file";
  const innerPng = path.join(thumbnailFile, "1.png");
  if (fs.existsSync(innerPng)) {
    const tmp = `${thumbnailFile}.tmp.png`;
    fs.copyFileSync(innerPng, tmp);
    fs.rmSync(thumbnailFile, { recursive: true, force: true });
    fs.renameSync(tmp, thumbnailFile);
    return "promoted";
  }
  fs.rmSync(thumbnailFile, { recursive: true, force: true });
  return "removed";
}
