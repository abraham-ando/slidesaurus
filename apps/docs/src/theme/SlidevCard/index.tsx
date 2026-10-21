/**
 * Swizzle wrapper — SlidevCard
 * ─────────────────────────────────────────────────────────────────────────────
 * Enhances every card with two optional ribbons:
 *
 *   • "New"      — shown when `date` is within the last 30 days
 *   • "Featured" — shown when `tags` includes "featured"
 *                  (only if the card isn't already "New")
 *
 * All rendering is delegated to the original component. The wrapper adds a
 * thin `position: relative` container so ribbons can be absolutely positioned
 * without touching the card's own DOM or CSS.
 *
 * ── How it works ────────────────────────────────────────────────────────────
 * Docusaurus resolves `@theme-original/SlidevCard` to the plugin's built-in
 * implementation. This file receives the same props the original expects and
 * passes them through unchanged — pure decoration.
 *
 * ── Customising ─────────────────────────────────────────────────────────────
 * • Change the age threshold (30 days) in `isNewPresentation`.
 * • Change "featured" to any tag string in `isFeaturedPresentation`.
 * • Edit `styles.module.css` to restyle the ribbons.
 * • Add more overlays here (e.g. a "Draft" badge when `deprecated === true`).
 */
import { useEffect, useState } from "react";
import OriginalSlidevCard from "@theme-original/SlidevCard";
import styles from "./styles.module.css";

/** Age (in days) below which a presentation is considered "new". */
const NEW_THRESHOLD_DAYS = 30;

function isNewPresentation(date?: string): boolean {
  if (!date) return false;
  const published = new Date(date).getTime();
  if (Number.isNaN(published)) return false;
  const ageMs = Date.now() - published;
  return ageMs >= 0 && ageMs < NEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
}

function isFeaturedPresentation(tags?: string[]): boolean {
  return tags?.includes("featured") ?? false;
}

type Props = React.ComponentProps<typeof OriginalSlidevCard>;

export default function SlidevCard(props: Props) {
  const { presentation } = props;
  // "New" depends on the current time: compute it after mount so the server-rendered
  // HTML (built at an arbitrary date) matches the first client render (no hydration mismatch).
  const [isNew, setIsNew] = useState(false);
  useEffect(() => {
    setIsNew(isNewPresentation(presentation.date));
  }, [presentation.date]);
  const showNew = isNew;
  const showFeatured = !showNew && isFeaturedPresentation(presentation.tags);

  return (
    // The wrapper is a real box (`position: relative`, flex column) so the
    // ribbons can be absolutely positioned against it, and it stretches the card
    // to the grid row height. (`display: contents` generates no box, so
    // `position: relative` had no effect on it.)
    <div className={styles.wrapper}>
      {showNew && (
        <span className={styles.ribbonNew} aria-label="New presentation">
          ✨ New
        </span>
      )}
      {showFeatured && (
        <span
          className={styles.ribbonFeatured}
          aria-label="Featured presentation"
        >
          ★ Featured
        </span>
      )}
      <OriginalSlidevCard {...props} />
    </div>
  );
}
