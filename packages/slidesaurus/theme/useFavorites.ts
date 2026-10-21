import { useState, useEffect, useCallback } from "react";

const FAVORITES_KEY = "slidev-favorites";
const CHANGE_EVENT = "slidev-favorites-changed";

function readFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function writeFavorites(favs: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
  } catch {
    // storage unavailable or full: the in-memory state still updates via the event below
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useFavorites(): {
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
} {
  // Start empty so the first client render matches the server-rendered HTML;
  // the stored favorites are loaded right after mount.
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const onChanged = () => setFavorites(readFavorites());
    onChanged();
    window.addEventListener(CHANGE_EVENT, onChanged);
    // Keep several tabs in sync
    window.addEventListener("storage", onChanged);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChanged);
      window.removeEventListener("storage", onChanged);
    };
  }, []);

  // Side effects (localStorage write + event) live here, not in a setState updater,
  // which React may invoke twice in StrictMode.
  const toggleFavorite = useCallback((id: string) => {
    const next = readFavorites();
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    writeFavorites(next);
  }, []);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}
