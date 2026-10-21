import React from "react";
import SlidevCard from "../SlidevCard";
import SlidevListItem from "../SlidevListItem";
import type { Category, Presentation, UITheme } from "../types";
import styles from "./styles.module.css";

interface OverviewListProps {
  readonly categories: readonly Category[];
  readonly presentations: readonly Presentation[];
  readonly uiTheme: UITheme;
}

/** Row list: categories first, then presentations. */
export default function OverviewList({ categories, presentations, uiTheme }: OverviewListProps) {
  return (
    <div className={styles.list}>
      {categories.map((category) => (
        <SlidevListItem key={`cat-${category.path}`} type="category" category={category} uiTheme={uiTheme} />
      ))}
      {presentations.map((presentation) =>
        uiTheme === "minimal" ? (
          // Minimal: pure text row using SlidevListItem (no thumbnail at all)
          <SlidevListItem key={presentation.id} type="presentation" presentation={presentation} uiTheme={uiTheme} />
        ) : (
          // Default / compact: horizontal card (thumbnail on left)
          <SlidevCard key={presentation.id} presentation={presentation} horizontal uiTheme={uiTheme} />
        ),
      )}
    </div>
  );
}
