import React, { useRef, useEffect, useState } from "react";
import { PresentationIcon, AuthorIcon, ClockIcon, StarIcon, PresenterIcon, DownloadIcon, PlaylistIcon } from "../icons";
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
  readonly isDev: boolean;
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
// so it uses a dedicated render path. The `data-slidev-ui-theme` attribute
// is still applied for user CSS overrides.
function SlidevCardMinimal({ presentation, isDev, uiTheme }: { presentation: Presentation; isDev: boolean; uiTheme: UITheme }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const linkProps = isDev
    ? { href: presentation.url }
    : { href: presentation.url, target: "_blank", rel: "noopener noreferrer" };

  return (
    <a {...linkProps} className={styles.cardMinimal} data-slidev-ui-theme={uiTheme}>
      <PresentationIcon className={styles.minimalIcon} width={16} height={16} />
      <span className={styles.minimalTitle}>
        {presentation.title}
        {isDev && <span className={`${styles.metaBadge} ${styles.unavailableBadge}`}>Build Required</span>}
      </span>
      <div className={styles.minimalBadges}>
        {presentation.deprecated && (
          <span className={`${styles.metaBadge} ${styles.badgeDeprecated}`}>Deprecated</span>
        )}
        {presentation.level && (
          <span className={`${styles.metaBadge} ${LEVEL_CLASS[presentation.level] ?? ""}`}>
            {LEVEL_LABELS[presentation.level] ?? presentation.level}
          </span>
        )}
        {presentation.playlist && presentation.playlist.length > 0 && (
          <span className={`${styles.metaBadge} ${styles.badgePlaylist}`}>
            <PlaylistIcon width={8} height={8} />
            {presentation.playlist[0]}
            {presentation.playlist.length > 1 && ` +${presentation.playlist.length - 1}`}
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
        className={`${styles.minimalFavoriteBtn} ${isFavorite(presentation.id) ? styles.favoriteBtnActive : ""}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(presentation.id); }}
        aria-label={isFavorite(presentation.id) ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={isFavorite(presentation.id)}
      >
        <StarIcon filled={isFavorite(presentation.id)} width={13} height={13} />
      </button>
    </a>
  );
}

export default function SlidevCard({ presentation, isDev, horizontal = false, uiTheme = "default" }: Props) {
  // Minimal: fundamentally different DOM (no preview, row layout) → dedicated path
  if (uiTheme === "minimal") {
    return <SlidevCardMinimal presentation={presentation} isDev={isDev} uiTheme={uiTheme} />;
  }

  const previewRef = useRef<HTMLDivElement>(null);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [previewLoaded, setPreviewLoaded] = useState(isDev);
  const [thumbnailError, setThumbnailError] = useState(false);

  // Scale the iframe/thumbnail preview to the card width via CSS custom property.
  useEffect(() => {
    if (isDev || !previewRef.current) return;
    const el = previewRef.current;
    const observer = new ResizeObserver(([entry]) => {
      const scale = entry.contentRect.width / SLIDE_NATIVE_WIDTH;
      el.style.setProperty("--preview-scale", String(scale));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isDev]);

  const cardClass = [
    styles.card,
    horizontal ? styles.cardHorizontal : "",
  ].filter(Boolean).join(" ");

  const linkProps = isDev
    ? { href: presentation.url }
    : { href: presentation.url, target: "_blank", rel: "noopener noreferrer" };

  return (
    // data-slidev-ui-theme drives all visual variants via CSS attribute selectors.
    // This is the public CSS API: users can target [data-slidev-ui-theme="my-brand"]
    // in their custom.css without swizzling the component.
    <a {...linkProps} className={cardClass} data-slidev-ui-theme={uiTheme}>
      <div className={`${styles.preview} ${previewLoaded ? "" : styles.previewLoading}`} ref={previewRef}>
        {isDev ? (
          <PresentationIcon className={styles.previewIcon} />
        ) : presentation.thumbnailUrl && !thumbnailError ? (
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
          <iframe
            src={presentation.url}
            title={`${presentation.title} preview`}
            className={styles.previewIframe}
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
            tabIndex={-1}
            aria-hidden="true"
            onLoad={() => setPreviewLoaded(true)}
          />
        )}
        {!isDev && (
          <div className={styles.overlayActions}>
            <a
              href={`${presentation.url}presenter/`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.presenterBtn}
              onClick={(e) => e.stopPropagation()}
              aria-label="Open presenter view"
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
                onClick={(e) => e.stopPropagation()}
                aria-label={`Download ${exportLabel(exportUrl)}`}
              >
                <DownloadIcon width={11} height={11} />
                <span>{exportLabel(exportUrl)}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Favorite button lives OUTSIDE .preview so CSS variants can reposition
          it without needing to toggle its visibility separately. */}
      <button
        type="button"
        className={`${styles.favoriteBtn} ${isFavorite(presentation.id) ? styles.favoriteBtnActive : ""}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(presentation.id); }}
        aria-label={isFavorite(presentation.id) ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={isFavorite(presentation.id)}
      >
        <StarIcon filled={isFavorite(presentation.id)} width={14} height={14} />
      </button>

      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{presentation.title}</h3>
          {isDev && (
            <span className={`${styles.badge} ${styles.unavailableBadge}`}>
              Build Required
            </span>
          )}
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
        {(presentation.level !== undefined || presentation.deprecated === true || (presentation.playlist && presentation.playlist.length > 0)) && (
          <div className={styles.metaBadges}>
            {presentation.deprecated && (
              <span className={`${styles.metaBadge} ${styles.badgeDeprecated}`}>Deprecated</span>
            )}
            {presentation.level && (
              <span className={`${styles.metaBadge} ${LEVEL_CLASS[presentation.level] ?? ""}`}>
                {LEVEL_LABELS[presentation.level] ?? presentation.level}
              </span>
            )}
            {presentation.playlist && presentation.playlist.length > 0 && (
              <span className={`${styles.metaBadge} ${styles.badgePlaylist}`} title={presentation.playlist.join(", ")}>
                <PlaylistIcon width={9} height={9} />
                {presentation.playlist[0]}
                {presentation.playlist.length > 1 && ` +${presentation.playlist.length - 1}`}
              </span>
            )}
          </div>
        )}
      </div>
    </a>
  );
}
