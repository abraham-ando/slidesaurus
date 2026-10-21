import React from "react";
import type { PlaylistData, PresentationLevel } from "../types";
import { LEVEL_LABELS } from "../types";
import { SearchIcon, CloseIcon, StarIcon, PlaylistIcon } from "../icons";
import styles from "./styles.module.css";

interface OverviewFilterBarProps {
  readonly searchQuery: string;
  readonly onSearchChange: (value: string) => void;
  readonly availableLevels: readonly PresentationLevel[];
  readonly selectedLevel: string;
  readonly onLevelChange: (value: string) => void;
  readonly availableAuthors: readonly string[];
  readonly selectedAuthor: string;
  readonly onAuthorChange: (value: string) => void;
  readonly availableTags: readonly string[];
  readonly selectedTags: readonly string[];
  readonly onToggleTag: (tag: string) => void;
  readonly availablePlaylists: readonly PlaylistData[];
  readonly selectedPlaylist: string;
  readonly onPlaylistChange: (id: string) => void;
  readonly showFavoritesOnly: boolean;
  readonly onToggleFavorites: () => void;
  readonly hasDeprecated: boolean;
  readonly hideDeprecated: boolean;
  readonly onToggleHideDeprecated: () => void;
  readonly isFilterActive: boolean;
  readonly onReset: () => void;
}

/** Search input and filter chips shown above the presentation list. */
export default function OverviewFilterBar(props: OverviewFilterBarProps) {
  const {
    searchQuery,
    availableLevels,
    availableAuthors,
    availableTags,
    availablePlaylists,
    selectedLevel,
    selectedAuthor,
    selectedTags,
    selectedPlaylist,
    showFavoritesOnly,
    hasDeprecated,
    hideDeprecated,
    isFilterActive,
  } = props;

  const hasFilters =
    availableLevels.length > 0 ||
    availableAuthors.length > 0 ||
    availableTags.length > 0 ||
    hasDeprecated;

  return (
    <div className={styles.searchFilterBar}>
      <div className={styles.searchInputWrapper}>
        <SearchIcon className={styles.searchIcon} width={18} height={18} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search by title, description, author or tag…"
          value={searchQuery}
          onChange={(e) => props.onSearchChange(e.target.value)}
          aria-label="Search presentations"
        />
        {searchQuery && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => props.onSearchChange("")}
            aria-label="Clear search"
          >
            <CloseIcon width={14} height={14} />
          </button>
        )}
      </div>

      {hasFilters && (
        <div className={styles.filterRow}>
          {availableLevels.length > 0 && (
            <select
              className={`${styles.filterSelect} ${selectedLevel ? styles.filterSelectActive : ""}`}
              value={selectedLevel}
              onChange={(e) => props.onLevelChange(e.target.value)}
              aria-label="Filter by level"
            >
              <option value="">All levels</option>
              {availableLevels.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l] ?? l}
                </option>
              ))}
            </select>
          )}

          {availableAuthors.length > 0 && (
            <select
              className={`${styles.filterSelect} ${selectedAuthor ? styles.filterSelectActive : ""}`}
              value={selectedAuthor}
              onChange={(e) => props.onAuthorChange(e.target.value)}
              aria-label="Filter by author"
            >
              <option value="">All authors</option>
              {availableAuthors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}

          {availableTags.length > 0 && (
            <div
              className={styles.tagChips}
              role="group"
              aria-label="Filter by tag"
            >
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`${styles.tagChip} ${selectedTags.includes(tag) ? styles.tagChipActive : ""}`}
                  onClick={() => props.onToggleTag(tag)}
                  aria-label={
                    selectedTags.includes(tag) ? `${tag} (active)` : tag
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {availablePlaylists.length > 0 && (
            <div
              className={styles.tagChips}
              role="group"
              aria-label="Filter by playlist"
            >
              {availablePlaylists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  className={`${styles.tagChip} ${styles.playlistChip} ${selectedPlaylist === pl.id ? styles.tagChipActive : ""}`}
                  onClick={() =>
                    props.onPlaylistChange(
                      selectedPlaylist === pl.id ? "" : pl.id,
                    )
                  }
                  aria-label={
                    selectedPlaylist === pl.id
                      ? `${pl.title} playlist (active)`
                      : `${pl.title} playlist`
                  }
                >
                  <PlaylistIcon width={10} height={10} /> {pl.title}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className={`${styles.tagChip} ${showFavoritesOnly ? styles.tagChipActive : ""}`}
            onClick={props.onToggleFavorites}
            aria-label={showFavoritesOnly ? "Favorites (active)" : "Favorites"}
          >
            <StarIcon width={12} height={12} filled={showFavoritesOnly} />{" "}
            Favorites
          </button>

          {hasDeprecated && (
            <button
              type="button"
              className={`${styles.tagChip} ${hideDeprecated ? styles.tagChipActive : ""}`}
              onClick={props.onToggleHideDeprecated}
              aria-label={
                hideDeprecated ? "Hide deprecated (active)" : "Hide deprecated"
              }
            >
              Hide deprecated
            </button>
          )}

          {isFilterActive && (
            <button
              type="button"
              className={styles.resetButton}
              onClick={props.onReset}
              aria-label="Reset all filters"
            >
              <CloseIcon width={12} height={12} />
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
