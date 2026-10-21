import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import { usePluginData } from "@docusaurus/useGlobalData";
import type { PluginData } from "../types";
import { PLUGIN_NAME } from "../types";
import { FolderIcon, BackIcon } from "../icons";
import OverviewControls from "./OverviewControls";
import { EmptyCategoryState, NoPresentationsState, NoResultsState } from "./OverviewEmptyState";
import OverviewFilterBar from "./OverviewFilterBar";
import OverviewGrid from "./OverviewGrid";
import OverviewList from "./OverviewList";
import OverviewSidebar from "./OverviewSidebar";
import { useCategoryNavigation } from "./useCategoryNavigation";
import { useOverviewPreferences } from "./useOverviewPreferences";
import { usePresentationList } from "./usePresentationList";
import { useUrlFilters } from "./useUrlFilters";
import styles from "./styles.module.css";

interface SlidevOverviewProps {
  readonly pluginId?: string;
  /**
   * Optional content rendered inside the page `<Layout>` (below the navbar),
   * above the overview. Lets swizzle wrappers inject a banner without
   * rendering a second `<Layout>`.
   */
  readonly children?: React.ReactNode;
}

export default function SlidevOverview({ pluginId = "default", children }: SlidevOverviewProps) {
  const { presentations, categories, playlists, config } = usePluginData(
    PLUGIN_NAME,
    pluginId,
  ) as PluginData;
  const uiTheme = config.uiTheme ?? "default";

  const nav = useCategoryNavigation(config.routeBasePath, categories);
  const { basePath, currentCategory, isInCategory, currentCategoryMeta, topLevelCategories, backUrl } = nav;

  const filters = useUrlFilters();
  const { viewMode, sortOrder, setViewMode, setSortOrder, showFavoritesOnly, setShowFavoritesOnly } =
    useOverviewPreferences();
  const list = usePresentationList({
    presentations,
    playlists,
    currentCategory,
    childCategories: nav.childCategories,
    filters,
    showFavoritesOnly,
    sortOrder,
  });

  const isFilterActive =
    filters.searchQuery !== "" ||
    filters.selectedLevel !== "" ||
    filters.selectedAuthor !== "" ||
    filters.selectedTags.length > 0 ||
    filters.hideDeprecated ||
    showFavoritesOnly ||
    filters.selectedPlaylist !== "";

  const resetFilters = () => {
    filters.resetUrlFilters();
    setShowFavoritesOnly(false);
  };

  // Minimal theme forces list view (no grid) and has no sidebar: categories
  // are visible in the main list.
  const isMinimal = uiTheme === "minimal";
  const effectiveViewMode = isMinimal ? "list" : viewMode;
  const hasSidebar = topLevelCategories.length > 0 && !isMinimal;

  const title = currentCategoryMeta?.label || config.pageTitle || "Slidev Presentations";
  const tagline = currentCategoryMeta?.description || config.pageTagline || "Interactive presentation overview";

  const hasContent = list.inCategory.length > 0 || nav.childCategories.length > 0;
  const noResults = isFilterActive && list.sortedPresentations.length === 0 && list.sortedCategories.length === 0;
  const sourceDir = config.path || "./slidev";

  const mainContent = (
    <>
      {(hasContent || isFilterActive) && (
        <OverviewFilterBar
          searchQuery={filters.searchQuery}
          onSearchChange={filters.setSearchQuery}
          availableLevels={list.availableLevels}
          selectedLevel={filters.selectedLevel}
          onLevelChange={filters.setSelectedLevel}
          availableAuthors={list.availableAuthors}
          selectedAuthor={filters.selectedAuthor}
          onAuthorChange={filters.setSelectedAuthor}
          availableTags={list.availableTags}
          selectedTags={filters.selectedTags}
          onToggleTag={filters.toggleTag}
          availablePlaylists={list.availablePlaylists}
          selectedPlaylist={filters.selectedPlaylist}
          onPlaylistChange={filters.setSelectedPlaylist}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavorites={() => setShowFavoritesOnly((v) => !v)}
          hasDeprecated={list.hasDeprecated}
          hideDeprecated={filters.hideDeprecated}
          onToggleHideDeprecated={() => filters.setHideDeprecated((v) => !v)}
          isFilterActive={isFilterActive}
          onReset={resetFilters}
        />
      )}

      <div className={styles.contentContainer}>
        {!hasContent && !isInCategory && <NoPresentationsState sourceDir={sourceDir} />}
        {!hasContent && isInCategory && <EmptyCategoryState />}
        {noResults && <NoResultsState onReset={resetFilters} />}
        {hasContent && !noResults && effectiveViewMode === "grid" && (
          <OverviewGrid categories={list.sortedCategories} presentations={list.sortedPresentations} uiTheme={uiTheme} />
        )}
        {hasContent && !noResults && effectiveViewMode === "list" && (
          <OverviewList categories={list.sortedCategories} presentations={list.sortedPresentations} uiTheme={uiTheme} />
        )}
      </div>
    </>
  );

  return (
    <Layout title={title} description={tagline}>
      {children}
      <div className={styles.container} data-slidev-ui-theme={uiTheme}>
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
          {(hasContent || isInCategory) && !isMinimal && (
            <OverviewControls
              sortOrder={sortOrder}
              onToggleSort={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              viewMode={effectiveViewMode}
              onToggleView={() => setViewMode(effectiveViewMode === "grid" ? "list" : "grid")}
            />
          )}
        </div>

        {hasSidebar ? (
          <div className={styles.pageLayout}>
            <OverviewSidebar
              basePath={basePath}
              currentCategory={currentCategory}
              totalCount={presentations.length}
              topLevelCategories={topLevelCategories}
              playlists={playlists}
              selectedPlaylist={filters.selectedPlaylist}
              onPlaylistChange={filters.setSelectedPlaylist}
            />
            <div className={styles.mainContent}>{mainContent}</div>
          </div>
        ) : (
          mainContent
        )}
      </div>
    </Layout>
  );
}
