import React from "react";
import SlidevCard from "../SlidevCard";
import SlidevCategoryCard from "../SlidevCategoryCard";
import type { Category, Presentation, UITheme } from "../types";
import styles from "./styles.module.css";

interface OverviewGridProps {
  readonly categories: readonly Category[];
  readonly presentations: readonly Presentation[];
  readonly uiTheme: UITheme;
}

/** Card grid: categories first, then presentations. */
export default function OverviewGrid({ categories, presentations, uiTheme }: OverviewGridProps) {
  return (
    <div className={styles.grid}>
      {categories.map((category) => (
        <SlidevCategoryCard key={`cat-${category.path}`} category={category} uiTheme={uiTheme} />
      ))}
      {presentations.map((presentation) => (
        <SlidevCard key={presentation.id} presentation={presentation} uiTheme={uiTheme} />
      ))}
    </div>
  );
}
