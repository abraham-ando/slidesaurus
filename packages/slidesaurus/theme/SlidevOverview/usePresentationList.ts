import { useMemo } from "react";
import type {
  Category,
  PlaylistData,
  Presentation,
  PresentationLevel,
} from "../types";
import {
  applyFilters,
  sortCategories,
  sortPresentations,
} from "../filterUtils";
import { useFavorites } from "../useFavorites";
import type { UrlFiltersState } from "./useUrlFilters";
import type { SortOrder } from "./useOverviewPreferences";

interface PresentationListInput {
  readonly presentations: Presentation[];
  readonly playlists: PlaylistData[];
  readonly currentCategory: string;
  readonly childCategories: Category[];
  readonly filters: UrlFiltersState;
  readonly showFavoritesOnly: boolean;
  readonly sortOrder: SortOrder;
}

/**
 * Presentations and categories of the current page: the ones that belong to it
 * (`inCategory`/`childCategories`), the filter options they offer (`available*`)
 * and what remains visible once search and filters are applied, sorted.
 */
export function usePresentationList({
  presentations,
  playlists,
  currentCategory,
  childCategories,
  filters,
  showFavoritesOnly,
  sortOrder,
}: PresentationListInput) {
  const { isFavorite } = useFavorites();
  const {
    searchQuery,
    selectedLevel,
    selectedAuthor,
    selectedTags,
    hideDeprecated,
    selectedPlaylist,
  } = filters;

  const inCategory = useMemo(
    () => presentations.filter((p) => (p.category || "") === currentCategory),
    [presentations, currentCategory],
  );

  const availableAuthors = useMemo(
    () =>
      [
        ...new Set(
          inCategory
            .map((p) => p.author)
            .filter((a): a is string => Boolean(a)),
        ),
      ].sort(),
    [inCategory],
  );
  const availableLevels = useMemo(
    () => [
      ...new Set(
        inCategory
          .map((p) => p.level)
          .filter((l): l is PresentationLevel => Boolean(l)),
      ),
    ],
    [inCategory],
  );
  const availableTags = useMemo(
    () => [...new Set(inCategory.flatMap((p) => p.tags ?? []))].sort(),
    [inCategory],
  );
  const availablePlaylists = useMemo(
    () =>
      playlists.filter((pl) =>
        pl.items.some((id) => inCategory.some((p) => p.id === id)),
      ),
    [playlists, inCategory],
  );
  const hasDeprecated = useMemo(
    () => inCategory.some((p) => p.deprecated === true),
    [inCategory],
  );

  // `isFavorite` changes identity whenever the favorites change.
  const visiblePresentations = useMemo(
    () =>
      applyFilters(inCategory, {
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
    [
      inCategory,
      searchQuery,
      selectedLevel,
      selectedAuthor,
      selectedTags,
      hideDeprecated,
      showFavoritesOnly,
      isFavorite,
      selectedPlaylist,
      playlists,
    ],
  );

  const sortedPresentations = useMemo(
    () =>
      sortPresentations(
        visiblePresentations,
        sortOrder,
        selectedPlaylist
          ? playlists.find((p) => p.id === selectedPlaylist)
          : undefined,
      ),
    [visiblePresentations, sortOrder, selectedPlaylist, playlists],
  );

  const sortedCategories = useMemo(
    () => sortCategories(childCategories, sortOrder),
    [childCategories, sortOrder],
  );

  return {
    inCategory,
    availableAuthors,
    availableLevels,
    availableTags,
    availablePlaylists,
    hasDeprecated,
    sortedPresentations,
    sortedCategories,
  };
}
