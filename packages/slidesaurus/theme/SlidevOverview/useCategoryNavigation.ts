import { useMemo } from "react";
import { useLocation } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";
import type { Category } from "../types";
import { sortCategories } from "../filterUtils";

export interface CategoryNavigation {
  /** Route base path including the site's baseUrl (no trailing slash). */
  basePath: string;
  /** Category path of the current page ("" on the overview root). */
  currentCategory: string;
  isInCategory: boolean;
  currentCategoryMeta: Category | null | undefined;
  /** Direct children of the current category. */
  childCategories: Category[];
  /** Top-level categories (sidebar entries). */
  topLevelCategories: Category[];
  /** URL of the parent page, or null on the overview root. */
  backUrl: string | null;
}

/** Derives the current category and the category tree slices from the URL. */
export function useCategoryNavigation(routeBasePath: string, categories: Category[]): CategoryNavigation {
  const location = useLocation();
  const basePath = useBaseUrl(routeBasePath).replace(/\/$/, "");

  const currentCategory = useMemo(() => {
    const currentPath = location.pathname.replace(/\/$/, "");
    if (currentPath === basePath || !currentPath.startsWith(basePath + "/")) return "";
    return currentPath.slice(basePath.length + 1);
  }, [location.pathname, basePath]);

  const currentCategoryMeta = useMemo(
    () => (!currentCategory ? null : categories.find((cat) => cat.path === currentCategory)),
    [currentCategory, categories],
  );

  const childCategories = useMemo(() => {
    const currentParts = currentCategory ? currentCategory.split("/") : [];
    return categories.filter((cat) => {
      const catParts = cat.path.split("/");
      if (catParts.length !== currentParts.length + 1) return false;
      if (currentCategory) return cat.path.startsWith(currentCategory + "/");
      return catParts.length === 1;
    });
  }, [categories, currentCategory]);

  const topLevelCategories = useMemo(
    () => sortCategories(categories.filter((cat) => !cat.path.includes("/")), "asc"),
    [categories],
  );

  const backUrl = useMemo(() => {
    if (!currentCategory) return null;
    const parts = currentCategory.split("/");
    return parts.length === 1 ? basePath : `${basePath}/${parts.slice(0, -1).join("/")}`;
  }, [currentCategory, basePath]);

  return {
    basePath,
    currentCategory,
    isInCategory: currentCategory !== "",
    currentCategoryMeta,
    childCategories,
    topLevelCategories,
    backUrl,
  };
}
