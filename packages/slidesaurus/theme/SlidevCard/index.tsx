import React, { useRef, useEffect, useState } from "react";
import SlidevIframe from "../SlidevIframe";
import {
  PresentationIcon,
  AuthorIcon,
  ClockIcon,
  StarIcon,
  PresenterIcon,
  DownloadIcon,
  PlaylistIcon,
} from "../icons";
import type { Presentation, UITheme } from "../types";
import { LEVEL_LABELS } from "../types";
import { useFavorites } from "../useFavorites";
import styles from "./styles.module.css";

function exportLabel(url: string): string {
  const ext = url.split(".").pop()?.toUpperCase() ?? "FILE";
  return ["PDF", "PPTX"].includes(ext) ? ext : "FILE";
}

/** Native Slidev slide width in pixels. The iframe renders at this width and
 *  is scaled down via CSS transform to fit the card preview area. */
const SLIDE_NATIVE_WIDTH = 980;

const LEVEL_CLASS: Record<string, string> = {
  beginner: styles.levelBeginner,
  intermediate: styles.levelIntermediate,
  advanced: styles.levelAdvanced,
};

interface Props {
  readonly presentation: Presentation;
  /** When true, renders image on the left and content on the right (list view). */
  readonly horizontal?: boolean;
  /**
   * Visual layout variant — set via the plugin's `uiTheme` option.
   * Applied as `data-slidev-ui-theme` on the root element so custom CSS
   * can target `[data-slidev-ui-theme="my-theme"] .card { ... }`.
   * Built-in: `"default"` | `"compact"` | `"minimal"`.
   */
  readonly uiTheme?: UITheme;
}

// ── Minimal variant — text-only row, fundamentally different DOM structure ──
// Cannot be expressed via CSS alone (row layout with no preview zone),
// so it uses a dedicated component. The `data-slidev-ui-theme` attribute
// is still applied for user CSS overrides.
//
// Accessibility: the row is a <div>; the title <a> is stretched over the whole
// row with a ::after pseudo-element ("card link" pattern), so the favorite
// <button> is a sibling of the link rather than nested inside it (nesting
// interactive content in <a> is invalid HTML).
function SlidevCardMinimal({
  presentation,
  uiTheme,
}: {
  readonly presentation: Presentation;
  readonly uiTheme: UITheme;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(presentation.id);

  return (
    <div className={styles.cardMinimal} data-slidev-ui-theme={uiTheme}>
      <PresentationIcon className={styles.minimalIcon} width={16} height={16} />
      <span className={styles.minimalTitle}>
        <a
          href={presentation.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.cardLink}
        >
          {presentation.title}
        </a>
      </span>
      <div className={styles.minimalBadges}>
        {presentation.deprecated && (
          <span className={`${styles.metaBadge} ${styles.badgeDeprecated}`}>
            Deprecated
          </span>
        )}
        {presentation.level && (
          <span
            className={`${styles.metaBadge} ${LEVEL_CLASS[presentation.level] ?? ""}`}
          >
            {LEVEL_LABELS[presentation.level] ?? presentation.level}
          </span>
        )}
        {presentation.playlist && presentation.playlist.length > 0 && (
          <span className={`${styles.metaBadge} ${styles.badgePlaylist}`}>
            <PlaylistIcon width={8} height={8} />
            {presentation.playlist[0]}
            {presentation.playlist.length > 1 &&
              ` +${presentation.playlist.length - 1}`}
          </span>
        )}
      </div>
      <div className={styles.minimalMeta}>
        {presentation.author && (
          <span className={styles.minimalMetaItem}>
            <AuthorIcon width={11} height={11} />
            {presentation.author}
          </span>
        )}
        {presentation.duration !== undefined && (
          <span className={styles.minimalMetaItem}>
            <ClockIcon width={11} height={11} />
            {presentation.duration} min
          </span>
        )}
      </div>
      <button
        type="button"
        className={`${styles.minimalFavoriteBtn} ${favorite ? styles.favoriteBtnActive : ""}`}
        onClick={() => toggleFavorite(presentation.id)}
        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={favorite}
      >
        <StarIcon filled={favorite} width={13} height={13} />
      </button>
    </div>
  );
}

function SlidevCardFull({
  presentation,
  horizontal,
  uiTheme,
}: {
  readonly presentation: Presentation;
  readonly horizontal: boolean;
  readonly uiTheme: UITheme;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const favorite = isFavorite(presentation.id);

  // Scale the iframe/thumbnail preview to the card width via CSS custom property.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const scale = entry.contentRect.width / SLIDE_NATIVE_WIDTH;
      el.style.setProperty("--preview-scale", String(scale));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cardClass = [styles.card, horizontal ? styles.cardHorizontal : ""]
    .filter(Boolean)
    .join(" ");

  return (
    // data-slidev-ui-theme drives all visual variants via CSS attribute selectors.
    // This is the public CSS API: users can target [data-slidev-ui-theme="my-brand"]
    // in their custom.css without swizzling the component.
    //
    // "Card link" pattern: the root is a <div>; the title <a> is stretched over the
    // whole card by a ::after pseudo-element. Presenter/download links and the
    // favorite button are siblings of that link and sit above it (z-index), so no
    // interactive element is nested inside another one.
    <div className={cardClass} data-slidev-ui-theme={uiTheme}>
      <div
        className={`${styles.preview} ${previewLoaded ? "" : styles.previewLoading}`}
        ref={previewRef}
      >
        {presentation.thumbnailUrl && !thumbnailError ? (
          <img
            src={presentation.thumbnailUrl}
            alt=""
            className={styles.previewThumbnail}
            loading="lazy"
            aria-hidden="true"
            onLoad={() => setPreviewLoaded(true)}
            onError={() => setThumbnailError(true)}
          />
        ) : (
          <SlidevIframe
            src={presentation.previewUrl || presentation.url}
            title={`${presentation.title} preview`}
            className={styles.previewIframe}
            loading="lazy"
            decorative
            onLoad={() => setPreviewLoaded(true)}
          />
        )}
        <div className={styles.overlayActions}>
          <a
            href={`${presentation.url}presenter/`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.presenterBtn}
            aria-label={`Open presenter view for ${presentation.title}`}
          >
            <PresenterIcon width={11} height={11} />
            <span>Present</span>
          </a>
          {presentation.exportUrls?.map((exportUrl) => (
            <a
              key={exportUrl}
              href={exportUrl}
              download
              className={styles.downloadBtn}
              aria-label={`Download ${exportLabel(exportUrl)} of ${presentation.title}`}
            >
              <DownloadIcon width={11} height={11} />
              <span>{exportLabel(exportUrl)}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Favorite button lives OUTSIDE .preview so CSS variants can reposition
          it without needing to toggle its visibility separately. */}
      <button
        type="button"
        className={`${styles.favoriteBtn} ${favorite ? styles.favoriteBtnActive : ""}`}
        onClick={() => toggleFavorite(presentation.id)}
        aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={favorite}
      >
        <StarIcon filled={favorite} width={14} height={14} />
      </button>

      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            <a
              href={presentation.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.cardLink}
            >
              {presentation.title}
            </a>
          </h3>
        </div>
        {presentation.description && (
          <p className={styles.description}>{presentation.description}</p>
        )}
        <div className={styles.metadata}>
          {presentation.author && (
            <div className={styles.metadataItem}>
              <AuthorIcon className={styles.icon} />
              <span>{presentation.author}</span>
            </div>
          )}
          {presentation.duration !== undefined && (
            <div className={styles.metadataItem}>
              <ClockIcon className={styles.icon} />
              <span>{presentation.duration} min</span>
            </div>
          )}
        </div>
        {(presentation.level !== undefined ||
          presentation.deprecated === true ||
          (presentation.playlist && presentation.playlist.length > 0)) && (
          <div className={styles.metaBadges}>
            {presentation.deprecated && (
              <span className={`${styles.metaBadge} ${styles.badgeDeprecated}`}>
                Deprecated
              </span>
            )}
            {presentation.level && (
              <span
                className={`${styles.metaBadge} ${LEVEL_CLASS[presentation.level] ?? ""}`}
              >
                {LEVEL_LABELS[presentation.level] ?? presentation.level}
              </span>
            )}
            {presentation.playlist && presentation.playlist.length > 0 && (
              <span
                className={`${styles.metaBadge} ${styles.badgePlaylist}`}
                title={presentation.playlist.join(", ")}
              >
                <PlaylistIcon width={9} height={9} />
                {presentation.playlist[0]}
                {presentation.playlist.length > 1 &&
                  ` +${presentation.playlist.length - 1}`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SlidevCard({
  presentation,
  horizontal = false,
  uiTheme = "default",
}: Props) {
  // Minimal: fundamentally different DOM (no preview, row layout) → dedicated component.
  // Each variant is its own component (not an early return before hooks here), so the
  // rules of hooks are respected.
  if (uiTheme === "minimal") {
    return <SlidevCardMinimal presentation={presentation} uiTheme={uiTheme} />;
  }
  return (
    <SlidevCardFull
      presentation={presentation}
      horizontal={horizontal}
      uiTheme={uiTheme}
    />
  );
}
