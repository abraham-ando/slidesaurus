import path from "node:path";
import fs from "node:fs";
import prompts from "prompts";
import pc from "picocolors";
import { loadPluginOptions, resolveOptions } from "../config";
import { renderTemplate, TEMPLATE_NAMES, type TemplateName } from "../templates";
import { cliLogger } from "../output";
const { success, error, info } = cliLogger;
import type { PluginOptions } from "../../domain/types";
import { normalizeRoutePath, validatePackageName } from "../../shared/utils";

interface NewOptions {
  category?: string;
  theme?: string;
  template?: string;
  force?: boolean;
  pluginId: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Exit code used when the user cancels a prompt (Ctrl+C), by shell convention. */
const EXIT_CANCELLED = 130;

/**
 * Derive relative path and ID from the name arg (may include category/name).
 * A trailing ".md" is stripped (so "foo.md" → "foo", not "foo-md").
 * Throws when the name or category reduces to nothing.
 */
function resolveName(
  rawName: string,
  categoryFlag: string | undefined,
): { relativePath: string; id: string } {
  const segments = rawName.replace(/\\/g, "/").split("/").map((s) => s.trim()).filter(Boolean);
  const last = (segments.pop() ?? "").replace(/\.md$/i, "");
  const fileName = slugify(last);
  if (!fileName) {
    throw new Error(`Invalid presentation name "${rawName}": it must contain at least one letter or digit.`);
  }

  let categoryParts: string[];
  if (categoryFlag !== undefined) {
    categoryParts = categoryFlag.replace(/\\/g, "/").split("/").map(slugify).filter(Boolean);
    if (categoryParts.length === 0) {
      throw new Error(`Invalid category "${categoryFlag}": it must contain at least one letter or digit.`);
    }
  } else {
    categoryParts = segments.map(slugify).filter(Boolean);
  }

  const id = [...categoryParts, fileName].join("/");
  return { relativePath: `${id}.md`, id };
}

/** Human-readable title derived from the last path segment of the name argument. */
function deriveTitle(rawName: string): string {
  const last = rawName.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? rawName;
  return last
    .replace(/\.md$/i, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function runNew(rawName: string | undefined, opts: NewOptions): Promise<void> {
  const cwd = process.cwd();
  const { options: pluginOpts, configFile } = loadPluginOptions(cwd, opts.pluginId);
  const options: PluginOptions & { path: string; routeBasePath: string } = resolveOptions(pluginOpts, opts.pluginId) as PluginOptions & { path: string; routeBasePath: string };

  // ── Interactive prompts for missing args ──────────────────────────────────
  const answers = await prompts(
    [
      {
        type: rawName ? null : "text",
        name: "name",
        message: "Presentation name (e.g. intro/getting-started)",
        validate: (v: string) => v.trim().length > 0 || "Name is required",
      },
      {
        type: !opts.template ? "select" : null,
        name: "template",
        message: "Template",
        choices: TEMPLATE_NAMES.map((t) => ({ title: t, value: t })),
        initial: 0,
      },
      {
        type: !opts.theme ? "text" : null,
        name: "theme",
        message: "Theme",
        initial: options.theme ?? "seriph",
      },
    ],
    { onCancel: () => process.exit(EXIT_CANCELLED) },
  );

  const name: string | undefined = rawName ?? answers.name;
  if (!name?.trim()) {
    error("A presentation name is required.");
    process.exit(1);
  }
  const template = (opts.template ?? answers.template ?? "basic") as TemplateName;
  const theme = opts.theme ?? answers.theme ?? options.theme ?? "seriph";

  if (!TEMPLATE_NAMES.includes(template)) {
    error(`Unknown template "${template}". Choose one of: ${TEMPLATE_NAMES.join(", ")}`);
    process.exit(1);
  }

  try {
    validatePackageName(theme);
  } catch (err) {
    error(`Invalid theme "${theme}": ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  let resolved: { relativePath: string; id: string };
  try {
    resolved = resolveName(name, opts.category);
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
  const { relativePath, id } = resolved;
  const slidevDir = path.resolve(cwd, options.path ?? "./slidev");
  const targetPath = path.join(slidevDir, relativePath);

  // Defense-in-depth: ensure targetPath is still inside slidevDir
  // (slugify already blocks ".." but this guard catches any future regression)
  const relToSlidev = path.relative(slidevDir, targetPath);
  if (relToSlidev.startsWith("..") || path.isAbsolute(relToSlidev)) {
    error(`Invalid presentation name: path traversal detected.`);
    process.exit(1);
  }

  if (fs.existsSync(targetPath) && !opts.force) {
    error(`File already exists: ${pc.cyan(relativePath)}`);
    info("Use --force to overwrite.");
    process.exit(1);
  }

  const title = deriveTitle(name);

  const content = renderTemplate(template, { title, theme });

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf-8");

  const routeBase = normalizeRoutePath(options.routeBasePath ?? "/slidev");
  const expectedUrl = `${routeBase}/${id}/`;

  success(`Created ${pc.cyan(relativePath)}`);
  console.log(`  ${pc.dim("Template:")} ${template}`);
  console.log(`  ${pc.dim("File:")}     ${targetPath}`);
  console.log(`  ${pc.dim("URL:")}      ${expectedUrl}`);
  if (configFile) {
    console.log(`  ${pc.dim("Config:")}   ${path.relative(cwd, configFile)}`);
  }
}
