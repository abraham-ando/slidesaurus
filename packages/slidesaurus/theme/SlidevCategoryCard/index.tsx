import React from "react";
import Link from "@docusaurus/Link";
import { FolderIcon } from "../icons";
import type { Category, UITheme } from "../types";
import styles from "./styles.module.css";

interface Props {
  readonly category: Category;
  /** Visual layout variant — inherited from the plugin's `uiTheme` option. */
  readonly uiTheme?: UITheme;
}

export default function SlidevCategoryCard({ category, uiTheme = "default" }: Props) {
  // Minimal variant — simple text row
  if (uiTheme === "minimal") {
    return (
      <Link to={category.url} className={styles.cardMinimal}>
        <FolderIcon className={styles.minimalIcon} width={16} height={16} />
        <span className={styles.minimalTitle}>{category.label}</span>
        <span className={styles.badge}>
          {category.count === 1 ? "1 presentation" : `${category.count} presentations`}
        </span>
      </Link>
    );
  }

  return (
    // data-slidev-ui-theme is the CSS API for custom variants
    <Link to={category.url} className={styles.card} data-slidev-ui-theme={uiTheme}>
      <div className={styles.folderPreview}>
        <FolderIcon className={styles.folderIcon} />
      </div>
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{category.label}</h3>
        </div>
        {category.description && (
          <p className={styles.description}>{category.description}</p>
        )}
        <div className={styles.metadata}>
          <span className={styles.badge}>
            {category.count === 1 ? "1 presentation" : `${category.count} presentations`}
          </span>
        </div>
      </div>
    </Link>
  );
}
