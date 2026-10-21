import React from "react";
import { FolderIcon, EmptyPresentationIcon, SearchIcon } from "../icons";
import styles from "./styles.module.css";

/** Shown when the site has no presentation at all. */
export function NoPresentationsState({
  sourceDir,
}: {
  readonly sourceDir: string;
}) {
  return (
    <div className={styles.emptyState}>
      <EmptyPresentationIcon className={styles.emptyStateIcon} />
      <h2 className={styles.emptyStateTitle}>No Presentations Found</h2>
      <p className={styles.emptyStateText}>
        Create a Slidev presentation in the <code>{sourceDir}</code> directory.
      </p>
      <code className={styles.emptyStateCode}>
        echo &quot;# My First Slide&quot; &gt; {sourceDir}/presentation.md
      </code>
    </div>
  );
}

/** Shown on a category page that has neither presentations nor sub-categories. */
export function EmptyCategoryState() {
  return (
    <div className={styles.emptyState}>
      <FolderIcon className={styles.emptyStateIcon} width={64} height={64} />
      <h2 className={styles.emptyStateTitle}>Empty Category</h2>
      <p className={styles.emptyStateText}>
        This category doesn&apos;t contain any presentations yet.
      </p>
    </div>
  );
}

/** Shown when the active search/filters match nothing. */
export function NoResultsState({ onReset }: { readonly onReset: () => void }) {
  return (
    <div className={styles.emptyState}>
      <SearchIcon className={styles.emptyStateIcon} width={64} height={64} />
      <h2 className={styles.emptyStateTitle}>No Results Found</h2>
      <p className={styles.emptyStateText}>
        Try adjusting your search or filters.
      </p>
      <button type="button" className={styles.resetButton} onClick={onReset}>
        Reset filters
      </button>
    </div>
  );
}
