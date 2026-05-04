import { describe, it, expect } from "vitest";
import { matchesSearch, applyFilters } from "../filterUtils";
import type { Presentation } from "../types";
import type { FilterOptions } from "../filterUtils";

function makePresentation(overrides: Partial<Presentation> = {}): Presentation {
  return {
    id: "talk",
    title: "My Talk",
    sourcePath: "slidev/talk.md",
    url: "/slidev/talk/",
    previewUrl: "/slidev/talk/",
    thumbnailUrl: "/slidev/talk/thumbnail.png",
    category: "",
    ...overrides,
  };
}

const noopFilters: FilterOptions = {
  searchQuery: "",
  selectedLevel: "",
  selectedAuthor: "",
  selectedTags: [],
  hideDeprecated: false,
  showFavoritesOnly: false,
  selectedPlaylist: "",
  playlists: [],
  isFavorite: () => false,
};

describe("matchesSearch", () => {
  it("matches by title (case-insensitive)", () => {
    const p = makePresentation({ title: "Introduction to React" });
    expect(matchesSearch("react", p)).toBe(true);
    expect(matchesSearch("REACT", p)).toBe(true);
    expect(matchesSearch("vue", p)).toBe(false);
  });

  it("matches by description", () => {
    const p = makePresentation({ description: "Learn TypeScript deeply" });
    expect(matchesSearch("typescript", p)).toBe(true);
    expect(matchesSearch("python", p)).toBe(false);
  });

  it("matches by author", () => {
    const p = makePresentation({ author: "Alice Smith" });
    expect(matchesSearch("alice", p)).toBe(true);
    expect(matchesSearch("bob", p)).toBe(false);
  });

  it("matches by owner", () => {
    const p = makePresentation({ owner: "platform-team" });
    expect(matchesSearch("platform", p)).toBe(true);
  });

  it("matches by tag", () => {
    const p = makePresentation({ tags: ["typescript", "testing"] });
    expect(matchesSearch("testing", p)).toBe(true);
    expect(matchesSearch("docker", p)).toBe(false);
  });

  it("returns false when all fields are absent", () => {
    const p = makePresentation({ title: "Something" });
    expect(matchesSearch("zzz", p)).toBe(false);
  });
});

describe("applyFilters", () => {
  const presentations = [
    makePresentation({ id: "a", title: "Alpha", level: "beginner", author: "Alice", tags: ["ts"], deprecated: false }),
    makePresentation({ id: "b", title: "Beta", level: "intermediate", author: "Bob", tags: ["ts", "react"] }),
    makePresentation({ id: "c", title: "Gamma", level: "advanced", author: "Alice", tags: ["docker"], deprecated: true }),
  ];

  it("returns all presentations when no filters active", () => {
    const result = applyFilters(presentations, noopFilters);
    expect(result).toHaveLength(3);
  });

  it("filters by search query", () => {
    const result = applyFilters(presentations, { ...noopFilters, searchQuery: "alpha" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by level", () => {
    const result = applyFilters(presentations, { ...noopFilters, selectedLevel: "beginner" });
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by author", () => {
    const result = applyFilters(presentations, { ...noopFilters, selectedAuthor: "Alice" });
    expect(result.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("filters by single tag", () => {
    const result = applyFilters(presentations, { ...noopFilters, selectedTags: ["ts"] });
    expect(result.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("requires all selected tags (AND logic)", () => {
    const result = applyFilters(presentations, { ...noopFilters, selectedTags: ["ts", "react"] });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  it("hides deprecated when hideDeprecated is true", () => {
    const result = applyFilters(presentations, { ...noopFilters, hideDeprecated: true });
    expect(result.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("shows only favorites when showFavoritesOnly is true", () => {
    const result = applyFilters(presentations, {
      ...noopFilters,
      showFavoritesOnly: true,
      isFavorite: (id) => id === "b",
    });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  it("returns empty when no favorites and showFavoritesOnly is true", () => {
    const result = applyFilters(presentations, { ...noopFilters, showFavoritesOnly: true });
    expect(result).toHaveLength(0);
  });

  it("filters by playlist id", () => {
    const playlists = [{ id: "track-1", title: "Track 1", items: ["a", "c"] }];
    const result = applyFilters(presentations, { ...noopFilters, selectedPlaylist: "track-1", playlists });
    expect(result.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("returns all presentations when selected playlist id is not found (graceful fallback)", () => {
    const result = applyFilters(presentations, { ...noopFilters, selectedPlaylist: "unknown", playlists: [] });
    expect(result).toHaveLength(3);
  });

  it("combines multiple filters (level + tag)", () => {
    const result = applyFilters(presentations, {
      ...noopFilters,
      selectedLevel: "intermediate",
      selectedTags: ["react"],
    });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  it("combines search and author", () => {
    const result = applyFilters(presentations, {
      ...noopFilters,
      searchQuery: "a",
      selectedAuthor: "Alice",
    });
    // "Alpha" + "Gamma" both match "a" by title; both by Alice
    expect(result.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("playlist filter shows all when unknown playlist id selected (graceful fallback)", () => {
    const playlists = [{ id: "track-x", title: "X", items: ["a"] }];
    const result = applyFilters(presentations, { ...noopFilters, selectedPlaylist: "track-z", playlists });
    expect(result).toHaveLength(3);
  });
});
