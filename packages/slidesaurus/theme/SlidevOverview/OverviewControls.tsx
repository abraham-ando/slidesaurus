import React from "react";
import type { SortOrder, ViewMode } from "./useOverviewPreferences";
import {
  SortAscIcon,
  SortDescIcon,
  GridViewIcon,
  DetailsViewIcon,
} from "../icons";
import styles from "./styles.module.css";

interface OverviewControlsProps {
  readonly sortOrder: SortOrder;
  readonly onToggleSort: () => void;
  readonly viewMode: ViewMode;
  readonly onToggleView: () => void;
}

/** Sort and grid/list toggle buttons in the page banner. */
export default function OverviewControls({
  sortOrder,
  onToggleSort,
  viewMode,
  onToggleView,
}: OverviewControlsProps) {
  return (
    <div className={styles.controls} role="toolbar" aria-label="View controls">
      <button
        type="button"
        className={styles.controlButton}
        onClick={onToggleSort}
        aria-label={sortOrder === "asc" ? "Sort descending" : "Sort ascending"}
        title={sortOrder === "asc" ? "Sort Z-A" : "Sort A-Z"}
      >
        {sortOrder === "asc" ? (
          <SortAscIcon width={20} height={20} />
        ) : (
          <SortDescIcon width={20} height={20} />
        )}
      </button>
      <button
        type="button"
        className={styles.controlButton}
        onClick={onToggleView}
        aria-label={
          viewMode === "grid" ? "Switch to list view" : "Switch to grid view"
        }
        title={viewMode === "grid" ? "Switch to List" : "Switch to Grid"}
      >
        {viewMode === "grid" ? (
          <DetailsViewIcon width={20} height={20} />
        ) : (
          <GridViewIcon width={20} height={20} />
        )}
      </button>
    </div>
  );
}
