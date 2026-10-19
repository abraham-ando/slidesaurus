export type TemplateName = "basic" | "tutorial" | "talk";

export interface TemplateVars {
  title: string;
  theme: string;
  author?: string;
}

const SEPARATOR = "\n---\n\n";

const PLAIN_YAML_SCALAR = /^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/;
/** Plain scalars that YAML would parse as a non-string (bool / null / number). */
const YAML_RESERVED = /^(true|false|yes|no|on|off|null|~|[-+]?\d[\d_]*(\.\d*)?([eE][-+]?\d+)?|0x[0-9a-fA-F]+|0o[0-7]+)$/i;

/**
 * Serialise a string as a safe YAML scalar: left plain when unambiguous,
 * otherwise emitted as a double-quoted string (JSON strings are valid YAML),
 * which neutralises `: `, ` #`, leading `@`/`*`/`&`, quotes and newlines.
 */
export function yamlScalar(value: string): string {
  if (value !== "" && value === value.trim() && PLAIN_YAML_SCALAR.test(value) && !YAML_RESERVED.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

const FRONTMATTER = (vars: TemplateVars, extra: Record<string, unknown> = {}) => {
  const lines = [
    "---",
    `title: ${yamlScalar(vars.title)}`,
    `description: `,
    `author: ${vars.author ? yamlScalar(vars.author) : ""}`,
    `theme: ${yamlScalar(vars.theme)}`,
    `tags: []`,
    ...Object.entries(extra).map(([k, v]) => `${k}: ${v}`),
    "---",
  ];
  return lines.join("\n");
};

const TEMPLATES: Record<TemplateName, (vars: TemplateVars) => string> = {
  basic: (vars) =>
    [
      FRONTMATTER(vars),
      `# ${vars.title}\n\nA new Slidev presentation`,
      `## Overview\n\n- Key point 1\n- Key point 2\n- Key point 3`,
      `## Details\n\nExpand on your topic here.`,
      `## Thank you!\n\n> Questions?`,
    ].join(SEPARATOR),

  tutorial: (vars) =>
    [
      FRONTMATTER(vars, { level: "beginner", duration: 30 }),
      `# ${vars.title}\n\nA step-by-step guide`,
      `## Prerequisites\n\n- Item 1\n- Item 2`,
      `## Step 1 — Getting Started\n\nDescribe the first step here.`,
      `## Step 2 — Going Further\n\nDescribe the next step here.`,
      `## Step 3 — Wrapping Up\n\nDescribe the final step here.`,
      `## Summary\n\nWhat we covered:\n\n1. Step 1\n2. Step 2\n3. Step 3`,
    ].join(SEPARATOR),

  talk: (vars) =>
    [
      FRONTMATTER(vars, { level: "intermediate", duration: 45 }),
      `# ${vars.title}`,
      `## Agenda\n\n1. Problem\n2. Solution\n3. Demo\n4. Q&A`,
      `## The Problem\n\nDescribe what you are solving.`,
      `## The Solution\n\nPresent your approach.`,
      `## Demo\n\n> Live demonstration`,
      `## Takeaways\n\n- Point 1\n- Point 2\n- Point 3`,
      `## Q&A\n\nThank you! Reach me at …`,
    ].join(SEPARATOR),
};

export function renderTemplate(name: TemplateName, vars: TemplateVars): string {
  return TEMPLATES[name](vars);
}

export const TEMPLATE_NAMES: TemplateName[] = ["basic", "tutorial", "talk"];
