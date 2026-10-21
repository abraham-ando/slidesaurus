/** Filters that are mirrored in the page URL (`?q=…&level=…`). */
export interface UrlFilters {
  q: string;
  level: string;
  author: string;
  tags: string[];
  hideDeprecated: boolean;
  playlist: string;
}

const EMPTY_URL_FILTERS: UrlFilters = {
  q: "",
  level: "",
  author: "",
  tags: [],
  hideDeprecated: false,
  playlist: "",
};

export function readUrlParams(search: string): UrlFilters {
  if (typeof window === "undefined") return EMPTY_URL_FILTERS;
  const params = new URLSearchParams(search);
  return {
    q: params.get("q") ?? "",
    level: params.get("level") ?? "",
    author: params.get("author") ?? "",
    tags: (params.get("tags") ?? "").split(",").filter(Boolean),
    hideDeprecated: params.get("hide_deprecated") === "1",
    playlist: params.get("playlist") ?? "",
  };
}

/** Serialises the filters to a query string ("" when nothing is set, else "?a=b"). */
export function buildSearch(filters: UrlFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.level) params.set("level", filters.level);
  if (filters.author) params.set("author", filters.author);
  if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
  if (filters.hideDeprecated) params.set("hide_deprecated", "1");
  if (filters.playlist) params.set("playlist", filters.playlist);
  const str = params.toString();
  return str ? `?${str}` : "";
}
