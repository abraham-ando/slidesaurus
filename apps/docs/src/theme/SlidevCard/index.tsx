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
import OriginalSlidevCard from "@theme-original/SlidevCard";
import type { SlidevPresentation } from "../../declarations";
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
  const presentation = props.presentation as SlidevPresentation;
  const showNew = isNewPresentation(presentation.date);
  const showFeatured = !showNew && isFeaturedPresentation(presentation.tags);

  return (
    // `display: contents` makes the wrapper invisible to CSS Grid/Flexbox
    // so card sizing is unchanged. Ribbons use absolute positioning relative
    // to the wrapper, which is promoted to a containing block via `position:
    // relative` (CSS Containment keeps stacking order correct).
    <div className={styles.wrapper}>
      {showNew && (
        <span className={styles.ribbonNew} aria-label="New presentation">
          ✨ New
        </span>
      )}
      {showFeatured && (
        <span className={styles.ribbonFeatured} aria-label="Featured presentation">
          ★ Featured
        </span>
      )}
      <OriginalSlidevCard {...props} />
    </div>
  );
}
