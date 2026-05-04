import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { usePluginData } from "@docusaurus/useGlobalData";
import { useLocation } from "@docusaurus/router";
import SlidevCard from "../SlidevCard";
import SlidevCategoryCard from "../SlidevCategoryCard";
import SlidevListItem from "../SlidevListItem";
import type { PluginData, Presentation, PresentationLevel } from "../types";
import { PLUGIN_NAME, LEVEL_LABELS } from "../types";
import { matchesSearch, applyFilters } from "../../src/filterUtils";
import { useFavorites } from "../useFavorites";
import {
  FolderIcon,
  BackIcon,
  SortAscIcon,
  SortDescIcon,
  GridViewIcon,
  DetailsViewIcon,
  WarningIcon,
  EmptyPresentationIcon,
  SearchIcon,
  CloseIcon,
  StarIcon,
  PlaylistIcon,
} from "../icons";
import styles from "./styles.module.css";

const STORAGE_KEYS = {
  viewMode: "slidev-plugin-view-mode",
  sortOrder: "slidev-plugin-sort-order",
  showFavoritesOnly: "slidev-plugin-show-favorites",
};


const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const naturalCompare = (a: string, b: string) => naturalCollator.compare(a, b);


function readUrlParams(search: string): {
  q: string;
  level: string;
  author: string;
  tags: string[];
  hideDeprecated: boolean;
  playlist: string;
} {
  if (typeof window === "undefined") return { q: "", level: "", author: "", tags: [], hideDeprecated: false, playlist: "" };
  const params = new URLSearchParams(search);
  return {
    q: params.get("q") ?? "",
    level: params.get("level") ?? "",
    author: params.get("author") ?? "",
    tags: params.get("tags") ? (params.get("tags") as string).split(",").filter(Boolean) : [],
    hideDeprecated: params.get("hide_deprecated") === "1",
    playlist: params.get("playlist") ?? "",
  };
}

function buildSearch(q: string, level: string, author: string, tags: string[], hideDeprecated: boolean, playlist: string): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (level) params.set("level", level);
  if (author) params.set("author", author);
  if (tags.length > 0) params.set("tags", tags.join(","));
  if (hideDeprecated) params.set("hide_deprecated", "1");
  if (playlist) params.set("playlist", playlist);
  const str = params.toString();
  return str ? `?${str}` : "";
}

export default function SlidevOverview({ pluginId = "default" }: { readonly pluginId?: string }) {
  const { presentations, categories, playlists, config, isDev } = usePluginData(
    PLUGIN_NAME,
    pluginId,
  ) as PluginData;
  const location = useLocation();

  const initialParams = useMemo(() => readUrlParams(location.search), []);

  const [searchQuery, setSearchQuery] = useState(initialParams.q);
  const [selectedLevel, setSelectedLevel] = useState(initialParams.level);
  const [selectedAuthor, setSelectedAuthor] = useState(initialParams.author);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialParams.tags);
  const [hideDeprecated, setHideDeprecated] = useState(initialParams.hideDeprecated);
  const [selectedPlaylist, setSelectedPlaylist] = useState(initialParams.playlist);

  const { favorites, isFavorite } = useFavorites();

  const [showFavoritesOnly, setShowFavoritesOnly] = useState(() => {
    if (globalThis.window !== undefined) {
      return localStorage.getItem(STORAGE_KEYS.showFavoritesOnly) === "1";
    }
    return false;
  });

  const [viewMode, setViewMode] = useState(() => {
    if (globalThis.window !== undefined) {
      return localStorage.getItem(STORAGE_KEYS.viewMode) || "grid";
    }
    return "grid";
  });

  const [sortOrder, setSortOrder] = useState(() => {
    if (globalThis.window !== undefined) {
      return localStorage.getItem(STORAGE_KEYS.sortOrder) || "asc";
    }
    return "asc";
  });

  useEffect(() => {
    if (globalThis.window !== undefined) localStorage.setItem(STORAGE_KEYS.viewMode, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (globalThis.window !== undefined) localStorage.setItem(STORAGE_KEYS.sortOrder, sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    if (globalThis.window !== undefined)
      localStorage.setItem(STORAGE_KEYS.showFavoritesOnly, showFavoritesOnly ? "1" : "0");
  }, [showFavoritesOnly]);

  // Sync filter state to URL (replace, no new history entry)
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    if (typeof window === "undefined") return;
    const search = buildSearch(searchQuery, selectedLevel, selectedAuthor, selectedTags, hideDeprecated, selectedPlaylist);
    window.history.replaceState(null, "", window.location.pathname + search);
  }, [searchQuery, selectedLevel, selectedAuthor, selectedTags, hideDeprecated, selectedPlaylist]);

  const currentCategory = useMemo(() => {
    const basePath = config.routeBasePath.replace(/\/$/, "");
    const currentPath = location.pathname.replace(/\/$/, "");
    if (currentPath === basePath) return "";
    return currentPath.replace(basePath + "/", "");
  }, [location.pathname, config.routeBasePath]);

  const isInCategory = currentCategory !== "";

  const parentCategoryPath = useMemo(() => {
    if (!currentCategory) return null;
    const parts = currentCategory.split("/");
    return parts.length === 1 ? "" : parts.slice(0, -1).join("/");
  }, [currentCategory]);

  const currentCategoryMeta = useMemo(
    () => (!currentCategory ? null : categories.find((cat) => cat.path === currentCategory)),
    [currentCategory, categories],
  );

  const filteredPresentations = useMemo(
    () => presentations.filter((p) => (p.category || "") === currentCategory),
    [presentations, currentCategory],
  );

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const catParts = cat.path.split("/");
      const currentParts = currentCategory ? currentCategory.split("/") : [];
      if (catParts.length !== currentParts.length + 1) return false;
      if (currentCategory) return cat.path.startsWith(currentCategory + "/");
      return catParts.length === 1;
    });
  }, [categories, currentCategory]);

  // Available filter options derived from current category
  const availableAuthors = useMemo(
    () =>
      [...new Set(filteredPresentations.map((p) => p.author).filter((a): a is string => Boolean(a)))].sort(),
    [filteredPresentations],
  );
  const availableLevels = useMemo(
    () => [...new Set(filteredPresentations.map((p) => p.level).filter((l): l is PresentationLevel => Boolean(l)))],
    [filteredPresentations],
  );
  const availableTags = useMemo(
    () => [...new Set(filteredPresentations.flatMap((p) => p.tags ?? []))].sort(),
    [filteredPresentations],
  );

  const availablePlaylists = useMemo(
    () => playlists.filter((pl) => pl.items.some((id) => filteredPresentations.some((p) => p.id === id))),
    [playlists, filteredPresentations],
  );

  const hasDeprecated = useMemo(
    () => filteredPresentations.some((p) => p.deprecated === true),
    [filteredPresentations],
  );

  const isFilterActive =
    searchQuery !== "" || selectedLevel !== "" || selectedAuthor !== "" || selectedTags.length > 0 || hideDeprecated || showFavoritesOnly || selectedPlaylist !== "";

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedLevel("");
    setSelectedAuthor("");
    setSelectedTags([]);
    setHideDeprecated(false);
    setShowFavoritesOnly(false);
    setSelectedPlaylist("");
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  // Apply search + filters
  const visiblePresentations = useMemo(
    () =>
      applyFilters(filteredPresentations, {
        searchQuery,
        selectedLevel,
        selectedAuthor,
        selectedTags,
        hideDeprecated,
        showFavoritesOnly,
        selectedPlaylist,
        playlists,
        isFavorite,
      }),
    [filteredPresentations, searchQuery, selectedLevel, selectedAuthor, selectedTags, hideDeprecated, showFavoritesOnly, favorites, selectedPlaylist, playlists],
  );

  const sortedPresentations = useMemo(() => {
    if (selectedPlaylist) {
      const pl = playlists.find((p) => p.id === selectedPlaylist);
      if (pl) {
        const order = pl.items;
        return [...visiblePresentations].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      }
    }
    const sorted = [...visiblePresentations];
    return sorted.sort((a, b) => {
      const aPos = a.position ?? Infinity;
      const bPos = b.position ?? Infinity;
      if (aPos !== bPos) {
        const cmp = aPos - bPos;
        return sortOrder === "asc" ? cmp : -cmp;
      }
      const pathCmp = naturalCompare(a.sourcePath, b.sourcePath);
      if (pathCmp !== 0) return sortOrder === "asc" ? pathCmp : -pathCmp;
      return sortOrder === "asc" ? naturalCompare(a.title, b.title) : naturalCompare(b.title, a.title);
    });
  }, [visiblePresentations, sortOrder, selectedPlaylist, playlists]);

  const sortedCategories = useMemo(() => {
    const sorted = [...filteredCategories];
    return sorted.sort((a, b) => {
      const posCmp = a.position - b.position;
      if (posCmp !== 0) return sortOrder === "asc" ? posCmp : -posCmp;
      return sortOrder === "asc" ? naturalCompare(a.label, b.label) : naturalCompare(b.label, a.label);
    });
  }, [filteredCategories, sortOrder]);

  const toggleSort = () => setSortOrder(sortOrder === "asc" ? "desc" : "asc");
  const toggleView = () => setViewMode(viewMode === "grid" ? "list" : "grid");

  const topLevelCategories = useMemo(
    () =>
      categories
        .filter((cat) => !cat.path.includes("/"))
        .sort((a, b) => {
          const posCmp = a.position - b.position;
          return posCmp !== 0 ? posCmp : naturalCompare(a.label, b.label);
        }),
    [categories],
  );

  const hasSidebar = topLevelCategories.length > 0;

  const title = currentCategoryMeta?.label || config.pageTitle || "Slidev Presentations";
  const tagline = currentCategoryMeta?.description || config.pageTagline || "Interactive presentation overview";

  const backUrl = useMemo(() => {
    if (parentCategoryPath === null) return null;
    const basePath = config.routeBasePath.replace(/\/$/, "");
    return parentCategoryPath ? `${basePath}/${parentCategoryPath}` : basePath;
  }, [parentCategoryPath, config.routeBasePath]);

  const hasContent = filteredPresentations.length > 0 || filteredCategories.length > 0;
  const showSearchBar = hasContent || isFilterActive;
  const noResults = isFilterActive && sortedPresentations.length === 0 && sortedCategories.length === 0;
  const sourceDir = config.path || "./slidev";

  const basePath = config.routeBasePath.replace(/\/$/, "");

  const mainContent = (
    <>
      {showSearchBar && (
        <div className={styles.searchFilterBar}>
          <div className={styles.searchInputWrapper}>
            <SearchIcon className={styles.searchIcon} width={18} height={18} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search by title, description, author or tag…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search presentations"
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <CloseIcon width={14} height={14} />
              </button>
            )}
          </div>

          {(availableLevels.length > 0 || availableAuthors.length > 0 || availableTags.length > 0 || hasDeprecated) && (
            <div className={styles.filterRow}>
              {availableLevels.length > 0 && (
                <select
                  className={`${styles.filterSelect} ${selectedLevel ? styles.filterSelectActive : ""}`}
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  aria-label="Filter by level"
                >
                  <option value="">All levels</option>
                  {availableLevels.map((l) => (
                    <option key={l} value={l}>{LEVEL_LABELS[l] ?? l}</option>
                  ))}
                </select>
              )}

              {availableAuthors.length > 0 && (
                <select
                  className={`${styles.filterSelect} ${selectedAuthor ? styles.filterSelectActive : ""}`}
                  value={selectedAuthor}
                  onChange={(e) => setSelectedAuthor(e.target.value)}
                  aria-label="Filter by author"
                >
                  <option value="">All authors</option>
                  {availableAuthors.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              )}

              {availableTags.length > 0 && (
                <div className={styles.tagChips} role="group" aria-label="Filter by tag">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`${styles.tagChip} ${selectedTags.includes(tag) ? styles.tagChipActive : ""}`}
                      onClick={() => toggleTag(tag)}
                      aria-label={selectedTags.includes(tag) ? `${tag} (active)` : tag}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {availablePlaylists.length > 0 && (
                <div className={styles.tagChips} role="group" aria-label="Filter by playlist">
                  {availablePlaylists.map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      className={`${styles.tagChip} ${styles.playlistChip} ${selectedPlaylist === pl.id ? styles.tagChipActive : ""}`}
                      onClick={() => setSelectedPlaylist(selectedPlaylist === pl.id ? "" : pl.id)}
                      aria-label={selectedPlaylist === pl.id ? `${pl.title} playlist (active)` : `${pl.title} playlist`}
                    >
                      <PlaylistIcon width={10} height={10} />
                      {" "}{pl.title}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                className={`${styles.tagChip} ${showFavoritesOnly ? styles.tagChipActive : ""}`}
                onClick={() => setShowFavoritesOnly((v) => !v)}
                aria-label={showFavoritesOnly ? "Favorites (active)" : "Favorites"}
              >
                <StarIcon width={12} height={12} filled={showFavoritesOnly} />
                {" "}Favorites
              </button>

              {hasDeprecated && (
                <button
                  type="button"
                  className={`${styles.tagChip} ${hideDeprecated ? styles.tagChipActive : ""}`}
                  onClick={() => setHideDeprecated((v) => !v)}
                  aria-label={hideDeprecated ? "Hide deprecated (active)" : "Hide deprecated"}
                >
                  Hide deprecated
                </button>
              )}

              {isFilterActive && (
                <button type="button" className={styles.resetButton} onClick={resetFilters} aria-label="Reset all filters">
                  <CloseIcon width={12} height={12} />
                  Reset
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isDev && (
        <div className={styles.devModeWarning}>
          <div className={styles.warningTitle}>
            <WarningIcon className={styles.warningIcon} />
            Development Mode
          </div>
          <p className={styles.warningText}>
            Slidev presentations are only available after building the site.
            <br />
            Run <code>npm run build</code> to generate presentations, then <code>npm run serve</code> to view them.
          </p>
        </div>
      )}

      <div className={styles.contentContainer}>
        {!hasContent && !isInCategory && (
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
        )}

        {!hasContent && isInCategory && (
          <div className={styles.emptyState}>
            <FolderIcon className={styles.emptyStateIcon} width={64} height={64} />
            <h2 className={styles.emptyStateTitle}>Empty Category</h2>
            <p className={styles.emptyStateText}>
              This category doesn&apos;t contain any presentations yet.
            </p>
          </div>
        )}

        {noResults && (
          <div className={styles.emptyState}>
            <SearchIcon className={styles.emptyStateIcon} width={64} height={64} />
            <h2 className={styles.emptyStateTitle}>No Results Found</h2>
            <p className={styles.emptyStateText}>
              Try adjusting your search or filters.
            </p>
            <button type="button" className={styles.resetButton} onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        )}

        {hasContent && !noResults && viewMode === "grid" && (
          <div className={styles.grid}>
            {sortedCategories.map((category) => (
              <SlidevCategoryCard key={`cat-${category.path}`} category={category} />
            ))}
            {sortedPresentations.map((presentation) => (
              <SlidevCard key={presentation.id} presentation={presentation} isDev={isDev} />
            ))}
          </div>
        )}

        {hasContent && !noResults && viewMode === "list" && (
          <div className={styles.list}>
            {sortedCategories.map((category) => (
              <SlidevListItem key={`cat-${category.path}`} type="category" category={category} />
            ))}
            {sortedPresentations.map((presentation) => (
              // Horizontal SlidevCard in list view: thumbnail on left, metadata on right.
              // More informative than a plain text row when thumbnails are available.
              <SlidevCard key={presentation.id} presentation={presentation} isDev={isDev} horizontal />
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <Layout title={title} description={tagline}>
      <div className={styles.container}>
        <div className={styles.bannerWrapper}>
          {isInCategory && backUrl !== null && (
            <Link to={backUrl} className={styles.backButton} aria-label="Go back">
              <BackIcon width={24} height={24} />
            </Link>
          )}
          <div className={styles.banner}>
            <h1 className={styles.title}>
              {isInCategory && <FolderIcon className={styles.titleIcon} width={50} height={50} />}
              <span>{title}</span>
            </h1>
            <p className={styles.subtitle}>{tagline}</p>
          </div>
          {(hasContent || isInCategory) && (
            <div className={styles.controls} role="toolbar" aria-label="View controls">
              <button
                type="button"
                className={styles.controlButton}
                onClick={toggleSort}
                aria-label={sortOrder === "asc" ? "Sort descending" : "Sort ascending"}
                title={sortOrder === "asc" ? "Sort Z-A" : "Sort A-Z"}
              >
                {sortOrder === "asc" ? <SortAscIcon width={20} height={20} /> : <SortDescIcon width={20} height={20} />}
              </button>
              <button
                type="button"
                className={styles.controlButton}
                onClick={toggleView}
                aria-label={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
                title={viewMode === "grid" ? "Switch to List" : "Switch to Grid"}
              >
                {viewMode === "grid" ? <DetailsViewIcon width={20} height={20} /> : <GridViewIcon width={20} height={20} />}
              </button>
            </div>
          )}
        </div>

        {hasSidebar ? (
          <div className={styles.pageLayout}>
            <nav className={styles.sidebar} aria-label="Categories">
              <Link
                to={basePath}
                className={`${styles.sidebarItem} ${!currentCategory ? styles.sidebarItemActive : ""}`}
              >
                <GridViewIcon width={14} height={14} />
                <span>All Presentations</span>
                <span className={styles.sidebarCount}>{presentations.length}</span>
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
                        onClick={() => setSelectedPlaylist(isActive ? "" : pl.id)}
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
            <div className={styles.mainContent}>
              {mainContent}
            </div>
          </div>
        ) : (
          mainContent
        )}
      </div>
    </Layout>
  );
}
