import fs from "node:fs";
import matter from "gray-matter";
import { log } from "../shared/logger";
import type { PresentationLevel } from "../domain/types";

type ColorSchema = "dark" | "light" | "auto";
const VALID_COLOR_SCHEMAS: ColorSchema[] = ["dark", "light", "auto"];

const VALID_LEVELS: PresentationLevel[] = ["beginner", "intermediate", "advanced"];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * gray-matter options used for EVERY frontmatter parse in the plugin.
 *
 * gray-matter ships a `javascript` engine that `eval`s front-matter written as
 * `---js` / `---javascript`: a Markdown file would execute arbitrary code in
 * the Docusaurus process. Both engines are replaced by one that refuses to run.
 */
function refuseJsEngine(): never {
  throw new Error("JavaScript front-matter (---js) is not supported for security reasons");
}
export const SAFE_MATTER_OPTIONS = {
  engines: {
    js: refuseJsEngine,
    javascript: refuseJsEngine,
  },
};

/** Parse frontmatter with the hardened engine set (no `---js` evaluation). */
export function parseFrontmatter(content: string): { data: Record<string, unknown>; content: string } {
  return matter(content, SAFE_MATTER_OPTIONS);
}

export interface ValidatedFields {
  title?: string;
  description?: string;
  author?: string;
  theme?: string;
  addons?: string[];
  tags?: string[];
  date?: string;
  position?: number;
  owner?: string;
  level?: PresentationLevel;
  duration?: number;
  lastReviewed?: string;
  deprecated?: boolean;
  colorSchema?: ColorSchema;
  withoutNotes?: boolean;
  playlist?: string[];
}

/**
 * Validates and sanitizes Slidev frontmatter fields.
 * Logs a warning for each invalid value; returns undefined for that field.
 */
export class FrontmatterValidator {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  validate(fm: Record<string, unknown>): ValidatedFields {
    return {
      title:        this.validateNonEmptyString("title", fm.title),
      description:  this.validateString("description", fm.description),
      author:       this.validateString("author", fm.author),
      theme:        this.validateNonEmptyString("theme", fm.theme),
      addons:       this.validateAddons(fm.addons),
      tags:         this.validateTags(fm.tags),
      date:         this.validateDate("date", fm.date),
      position:     this.validatePosition(fm.position),
      owner:        this.validateString("owner", fm.owner),
      level:        this.validateLevel(fm.level),
      duration:     this.validateDuration(fm.duration),
      lastReviewed: this.validateDate("lastReviewed", fm.lastReviewed),
      deprecated:   this.validateBoolean("deprecated", fm.deprecated),
      colorSchema:  this.validateColorSchema(fm.colorSchema),
      withoutNotes: this.validateBoolean("withoutNotes", fm.withoutNotes),
      playlist:     this.validatePlaylist(fm.playlist),
    };
  }

  private validateNonEmptyString(field: string, raw: unknown): string | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    this.warn(`Invalid "${field}": must be a non-empty string`);
    return undefined;
  }

  private validateAddons(raw: unknown): string[] | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (!Array.isArray(raw)) {
      this.warn(`Invalid "addons": must be an array of strings`);
      return undefined;
    }
    const valid: string[] = [];
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) valid.push(item.trim());
      else this.warn(`Invalid addon item: each addon must be a non-empty string, got ${typeof item}`);
    }
    return valid.length > 0 ? [...new Set(valid)] : undefined;
  }

  private validateTags(raw: unknown): string[] | undefined {
    if (raw === undefined) return undefined;
    if (!Array.isArray(raw)) {
      this.warn(`Invalid "tags": must be an array of strings`);
      return undefined;
    }
    const valid: string[] = [];
    for (const item of raw) {
      if (typeof item === "string") {
        const normalized = item.trim().toLowerCase();
        if (normalized) valid.push(normalized);
      } else {
        this.warn(`Invalid tag item: each tag must be a string, got ${typeof item}`);
      }
    }
    const deduped = [...new Set(valid)];
    return deduped.length > 0 ? deduped : undefined;
  }

  // Handles both "date" and "lastReviewed" — gray-matter parses bare YAML dates into Date objects.
  private validateDate(field: string, raw: unknown): string | undefined {
    if (raw === undefined) return undefined;
    const coerced = raw instanceof Date ? raw.toISOString().slice(0, 10) : raw;
    if (typeof coerced === "string" && ISO_DATE_RE.test(coerced)) return coerced;
    this.warn(`Invalid "${field}": must be an ISO date string (YYYY-MM-DD)`);
    return undefined;
  }

  private validatePosition(raw: unknown): number | undefined {
    if (raw === undefined) return undefined;
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
    this.warn(`Invalid "position": must be a non-negative number`);
    return undefined;
  }

  private validateString(field: string, raw: unknown): string | undefined {
    if (raw === undefined) return undefined;
    if (typeof raw === "string") return raw;
    this.warn(`Invalid "${field}": must be a string`);
    return undefined;
  }

  private validateLevel(raw: unknown): PresentationLevel | undefined {
    if (raw === undefined) return undefined;
    if (typeof raw === "string" && (VALID_LEVELS as string[]).includes(raw)) {
      return raw as PresentationLevel;
    }
    this.warn(`Invalid "level": must be one of ${VALID_LEVELS.join(", ")}`);
    return undefined;
  }

  private validateDuration(raw: unknown): number | undefined {
    if (raw === undefined) return undefined;
    if (typeof raw === "number" && raw > 0 && Number.isFinite(raw)) return raw;
    this.warn(`Invalid "duration": must be a positive number (minutes)`);
    return undefined;
  }

  private validateBoolean(field: string, raw: unknown): boolean | undefined {
    if (raw === undefined) return undefined;
    if (typeof raw === "boolean") return raw;
    this.warn(`Invalid "${field}": must be a boolean`);
    return undefined;
  }

  private validateColorSchema(raw: unknown): ColorSchema | undefined {
    if (raw === undefined) return undefined;
    if ((VALID_COLOR_SCHEMAS as unknown[]).includes(raw)) return raw as ColorSchema;
    this.warn(`Invalid "colorSchema": must be one of ${VALID_COLOR_SCHEMAS.join(", ")}`);
    return undefined;
  }

  private validatePlaylist(raw: unknown): string[] | undefined {
    if (raw === undefined) return undefined;
    const items: unknown[] = Array.isArray(raw) ? raw : [raw];
    const names: string[] = [];
    for (const item of items) {
      if (typeof item === "string" && item.trim()) {
        names.push(item.trim());
      } else {
        this.warn(`Invalid "playlist" entry: each playlist name must be a non-empty string`);
      }
    }
    return names.length > 0 ? names : undefined;
  }

  private warn(message: string): void {
    log.warn(`${message} in ${log.path(this.filePath)}`);
  }
}

/**
 * Write the resolved addon list into a Slidev markdown file's frontmatter.
 * Slidev reads addons from frontmatter, not CLI flags — this patch ensures
 * the isolated source file used during build has the full merged addon list.
 *
 * The list REPLACES the raw frontmatter value: `addons` already contains the
 * presentation addons (after `transformFrontmatter` / `onPresentationScanned`)
 * merged with the global ones, resolved to full package names — keeping the raw
 * shorthands would load the same addon twice.
 */
export function patchFrontmatterAddons(filePath: string, addons: string[]): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = parseFrontmatter(content);
  parsed.data.addons = [...new Set(addons)];
  const newContent = matter.stringify(parsed.content, parsed.data);
  if (newContent !== content) fs.writeFileSync(filePath, newContent, "utf-8");
}

/**
 * Set the theme in a Slidev markdown file's frontmatter.
 * Used in batch builds to inject the global theme without the --theme CLI flag
 * (which would apply uniformly to all files in the batch).
 *
 * @param force - Overwrite an existing `theme` (used when the theme comes from
 *   the presentation metadata AFTER `transformFrontmatter` / `onPresentationScanned`,
 *   which may differ from the raw file). Otherwise only fills a missing theme.
 */
export function patchFrontmatterTheme(filePath: string, theme: string, force = false): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = parseFrontmatter(content);
  if (force ? parsed.data.theme !== theme : !parsed.data.theme) {
    parsed.data.theme = theme;
    fs.writeFileSync(filePath, matter.stringify(parsed.content, parsed.data), "utf-8");
  }
}
