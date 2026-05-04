import type { Presentation, PlaylistData } from "./types";

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

export function applyFilters(presentations: Presentation[], opts: FilterOptions): Presentation[] {
  let result = presentations;
  if (opts.searchQuery.trim()) result = result.filter((p) => matchesSearch(opts.searchQuery, p));
  if (opts.selectedLevel) result = result.filter((p) => p.level === opts.selectedLevel);
  if (opts.selectedAuthor) result = result.filter((p) => p.author === opts.selectedAuthor);
  if (opts.selectedTags.length > 0)
    result = result.filter((p) => opts.selectedTags.every((tag) => p.tags?.includes(tag)));
  if (opts.hideDeprecated) result = result.filter((p) => p.deprecated !== true);
  if (opts.showFavoritesOnly) result = result.filter((p) => opts.isFavorite(p.id));
  if (opts.selectedPlaylist) {
    const pl = opts.playlists.find((p) => p.id === opts.selectedPlaylist);
    if (pl) result = result.filter((p) => pl.items.includes(p.id));
  }
  return result;
}
