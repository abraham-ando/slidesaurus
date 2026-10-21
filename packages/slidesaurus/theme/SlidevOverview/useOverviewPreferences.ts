import { useState, useEffect } from "react";

const STORAGE_KEYS = {
  viewMode: "slidev-plugin-view-mode",
  sortOrder: "slidev-plugin-sort-order",
  showFavoritesOnly: "slidev-plugin-show-favorites",
};

export type ViewMode = "grid" | "list";
export type SortOrder = "asc" | "desc";

export interface OverviewPreferences {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (value: boolean | ((previous: boolean) => boolean)) => void;
}

/**
 * View mode, sort order and "favorites only" toggle, persisted in localStorage.
 *
 * State starts with SSR-safe defaults and is hydrated after mount, so the first
 * client render matches the static HTML. Values are written back only once
 * hydrated, otherwise the defaults would overwrite the stored values before
 * they are read.
 */
export function useOverviewPreferences(): OverviewPreferences {
  const [hydrated, setHydrated] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    try {
      setShowFavoritesOnly(localStorage.getItem(STORAGE_KEYS.showFavoritesOnly) === "1");
      setViewMode(localStorage.getItem(STORAGE_KEYS.viewMode) === "list" ? "list" : "grid");
      setSortOrder(localStorage.getItem(STORAGE_KEYS.sortOrder) === "desc" ? "desc" : "asc");
    } catch {
      // localStorage unavailable (private mode, blocked storage): keep defaults
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEYS.viewMode, viewMode);
      localStorage.setItem(STORAGE_KEYS.sortOrder, sortOrder);
      localStorage.setItem(STORAGE_KEYS.showFavoritesOnly, showFavoritesOnly ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [hydrated, viewMode, sortOrder, showFavoritesOnly]);

  return { viewMode, setViewMode, sortOrder, setSortOrder, showFavoritesOnly, setShowFavoritesOnly };
}
