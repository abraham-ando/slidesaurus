import type { Presentation, PlaylistData, Category } from "./types";

export function matchesSearch(query: string, p: Presentation): boolean {
  const q = query.toLowerCase();
  return (
    p.title.toLowerCase().includes(q) ||
    (p.description !== undefined && p.description.toLowerCase().includes(q)) ||
    (p.author !== undefined && p.author.toLowerCase().includes(q)) ||
    (p.owner !== undefined && p.owner.toLowerCase().includes(q)) ||
    (p.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
  );
}

export interface FilterOptions {
  searchQuery: string;
  selectedLevel: string;
  selectedAuthor: string;
  selectedTags: string[];
  hideDeprecated: boolean;
  showFavoritesOnly: boolean;
  selectedPlaylist: string;
  playlists: PlaylistData[];
  isFavorite: (id: string) => boolean;
}

export function applyFilters(
  presentations: Presentation[],
  opts: FilterOptions,
): Presentation[] {
  let result = presentations;
  if (opts.searchQuery.trim())
    result = result.filter((p) => matchesSearch(opts.searchQuery, p));
  if (opts.selectedLevel)
    result = result.filter((p) => p.level === opts.selectedLevel);
  if (opts.selectedAuthor)
    result = result.filter((p) => p.author === opts.selectedAuthor);
  if (opts.selectedTags.length > 0)
    result = result.filter((p) =>
      opts.selectedTags.every((tag) => p.tags?.includes(tag)),
    );
  if (opts.hideDeprecated) result = result.filter((p) => p.deprecated !== true);
  if (opts.showFavoritesOnly)
    result = result.filter((p) => opts.isFavorite(p.id));
  if (opts.selectedPlaylist) {
    const pl = opts.playlists.find((p) => p.id === opts.selectedPlaylist);
    if (pl) result = result.filter((p) => pl.items.includes(p.id));
  }
  return result;
}

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/** Locale-aware comparison where "Part 2" sorts before "Part 10". */
export const naturalCompare = (a: string, b: string): number =>
  naturalCollator.compare(a, b);

/**
 * Orders presentations: by playlist order when a playlist is selected,
 * otherwise by `position`, then source path, then title (reversed when `desc`).
 */
export function sortPresentations(
  presentations: Presentation[],
  sortOrder: "asc" | "desc",
  playlist?: PlaylistData,
): Presentation[] {
  const sorted = [...presentations];
  if (playlist) {
    const order = playlist.items;
    return sorted.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }
  const direction = sortOrder === "asc" ? 1 : -1;
  return sorted.sort((a, b) => {
    const aPos = a.position ?? Infinity;
    const bPos = b.position ?? Infinity;
    if (aPos !== bPos) return direction * (aPos - bPos);
    const pathCmp = naturalCompare(a.sourcePath, b.sourcePath);
    if (pathCmp !== 0) return direction * pathCmp;
    return direction * naturalCompare(a.title, b.title);
  });
}

/** Orders categories by `position`, then label (reversed when `desc`). */
export function sortCategories(
  categories: Category[],
  sortOrder: "asc" | "desc",
): Category[] {
  const direction = sortOrder === "asc" ? 1 : -1;
  return [...categories].sort((a, b) => {
    const posCmp = a.position - b.position;
    if (posCmp !== 0) return direction * posCmp;
    return direction * naturalCompare(a.label, b.label);
  });
}
