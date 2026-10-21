import { useState, useEffect, useCallback } from "react";
import { readUrlParams, buildSearch } from "./urlParams";

export interface UrlFiltersState {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedLevel: string;
  setSelectedLevel: (value: string) => void;
  selectedAuthor: string;
  setSelectedAuthor: (value: string) => void;
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  hideDeprecated: boolean;
  setHideDeprecated: (
    value: boolean | ((previous: boolean) => boolean),
  ) => void;
  selectedPlaylist: string;
  setSelectedPlaylist: (value: string) => void;
  /** Clears every URL-backed filter. */
  resetUrlFilters: () => void;
}

/**
 * Search/filter state mirrored in the page URL. Initialised empty (SSR-safe),
 * hydrated from `window.location.search` after mount, then written back with
 * `history.replaceState` (no new history entry).
 */
export function useUrlFilters(): UrlFiltersState {
  const [hydrated, setHydrated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedAuthor, setSelectedAuthor] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [hideDeprecated, setHideDeprecated] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState("");

  useEffect(() => {
    const params = readUrlParams(window.location.search);
    setSearchQuery(params.q);
    setSelectedLevel(params.level);
    setSelectedAuthor(params.author);
    setSelectedTags(params.tags);
    setHideDeprecated(params.hideDeprecated);
    setSelectedPlaylist(params.playlist);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const search = buildSearch({
      q: searchQuery,
      level: selectedLevel,
      author: selectedAuthor,
      tags: selectedTags,
      hideDeprecated,
      playlist: selectedPlaylist,
    });
    window.history.replaceState(
      null,
      "",
      window.location.pathname + search + window.location.hash,
    );
  }, [
    hydrated,
    searchQuery,
    selectedLevel,
    selectedAuthor,
    selectedTags,
    hideDeprecated,
    selectedPlaylist,
  ]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const resetUrlFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedLevel("");
    setSelectedAuthor("");
    setSelectedTags([]);
    setHideDeprecated(false);
    setSelectedPlaylist("");
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    selectedLevel,
    setSelectedLevel,
    selectedAuthor,
    setSelectedAuthor,
    selectedTags,
    toggleTag,
    hideDeprecated,
    setHideDeprecated,
    selectedPlaylist,
    setSelectedPlaylist,
    resetUrlFilters,
  };
}
