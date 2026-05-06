import path from "node:path";
import fs from "node:fs";
import prompts from "prompts";
import pc from "picocolors";
import { loadPluginOptions, resolveOptions } from "../config";
import { renderTemplate, TEMPLATE_NAMES, type TemplateName } from "../templates";
import { cliLogger } from "../output";
const { success, error, info } = cliLogger;
import type { PluginOptions } from "../../domain/types";
import { normalizeRoutePath } from "../../shared/utils";

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
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Derive relative path and ID from the name arg (may include category/name). */
function resolveName(
  rawName: string,
  categoryFlag: string | undefined,
): { relativePath: string; id: string } {
  const parts = rawName.replace(/\\/g, "/").split("/").map(slugify);
  const fileName = parts.pop()!;
  const category = categoryFlag ? slugify(categoryFlag) : parts.join("/");
  const segments = category ? [category, fileName] : [fileName];
  const id = segments.join("/");
  const relativePath = `${id}.md`;
  return { relativePath, id };
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
    { onCancel: () => process.exit(0) },
  );

  const name = rawName ?? answers.name;
  const template = (opts.template ?? answers.template ?? "basic") as TemplateName;
  const theme = opts.theme ?? answers.theme ?? options.theme ?? "seriph";

  if (!TEMPLATE_NAMES.includes(template)) {
    error(`Unknown template "${template}". Choose one of: ${TEMPLATE_NAMES.join(", ")}`);
    process.exit(1);
  }

  const { relativePath, id } = resolveName(name, opts.category);
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

  const title = path.basename(name, ".md")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

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
