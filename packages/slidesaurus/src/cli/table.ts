import pc from "picocolors";

interface Column {
  header: string;
  key: string;
  maxWidth?: number;
}

/** Render a simple ASCII table from an array of record objects. */
export function renderTable(
  rows: Record<string, string>[],
  columns: Column[],
): void {
  if (rows.length === 0) {
    console.log(pc.dim("  (none)"));
    return;
  }

  const widths = columns.map((col) =>
    Math.min(
      col.maxWidth ?? 50,
      Math.max(col.header.length, ...rows.map((r) => (r[col.key] ?? "").length)),
    ),
  );

  const header = columns.map((col, i) => pc.bold(col.header.padEnd(widths[i]))).join("  ");
  const divider = widths.map((w) => "─".repeat(w)).join("  ");

  console.log(`  ${header}`);
  console.log(`  ${divider}`);

  for (const row of rows) {
    const line = columns.map((col, i) =>
      (row[col.key] ?? "").slice(0, widths[i]).padEnd(widths[i]),
    ).join("  ");
    console.log(`  ${line}`);
  }
}
