import React from "react";
import Link from "@docusaurus/Link";
import type { Category, PlaylistData } from "../types";
import { FolderIcon, GridViewIcon, PlaylistIcon } from "../icons";
import styles from "./styles.module.css";

interface OverviewSidebarProps {
  readonly basePath: string;
  readonly currentCategory: string;
  readonly totalCount: number;
  readonly topLevelCategories: readonly Category[];
  readonly playlists: readonly PlaylistData[];
  readonly selectedPlaylist: string;
  readonly onPlaylistChange: (id: string) => void;
}

/** Category and playlist navigation shown beside the presentation grid. */
export default function OverviewSidebar({
  basePath,
  currentCategory,
  totalCount,
  topLevelCategories,
  playlists,
  selectedPlaylist,
  onPlaylistChange,
}: OverviewSidebarProps) {
  return (
    <nav className={styles.sidebar} aria-label="Categories">
      <Link
        to={basePath}
        className={`${styles.sidebarItem} ${!currentCategory ? styles.sidebarItemActive : ""}`}
      >
        <GridViewIcon width={14} height={14} />
        <span>All Presentations</span>
        <span className={styles.sidebarCount}>{totalCount}</span>
      </Link>
      <div className={styles.sidebarDivider} />
      <div className={styles.sidebarSectionLabel}>Categories</div>
      {topLevelCategories.map((cat) => (
        <Link
          key={cat.path}
          to={cat.url}
          className={`${styles.sidebarItem} ${currentCategory === cat.path || currentCategory.startsWith(cat.path + "/") ? styles.sidebarItemActive : ""}`}
        >
          <FolderIcon width={14} height={14} />
          <span className={styles.sidebarLabel}>{cat.label}</span>
          <span className={styles.sidebarCount}>{cat.count}</span>
        </Link>
      ))}
      {playlists.length > 0 && (
        <>
          <div className={styles.sidebarDivider} />
          <div className={styles.sidebarSectionLabel}>Playlists</div>
          {playlists.map((pl) => {
            const isActive = selectedPlaylist === pl.id;
            return (
              <button
                key={pl.id}
                type="button"
                className={`${styles.sidebarItem} ${styles.sidebarItemBtn} ${isActive ? styles.sidebarItemActive : ""}`}
                onClick={() => onPlaylistChange(isActive ? "" : pl.id)}
                aria-label={`${pl.title}${isActive ? " (active filter)" : ""}`}
              >
                <PlaylistIcon width={14} height={14} />
                <span className={styles.sidebarLabel}>{pl.title}</span>
                <span className={styles.sidebarCount}>{pl.items.length}</span>
              </button>
            );
          })}
        </>
      )}
    </nav>
  );
}
