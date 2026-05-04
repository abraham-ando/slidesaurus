import React, { useRef, useEffect, useState } from "react";
import { PresentationIcon, AuthorIcon, ClockIcon, StarIcon, PresenterIcon, DownloadIcon, PlaylistIcon } from "../icons";
import type { Presentation } from "../types";
import { LEVEL_LABELS } from "../types";
import { useFavorites } from "../useFavorites";
import styles from "./styles.module.css";

function exportLabel(url: string): string {
  const ext = url.split(".").pop()?.toUpperCase() ?? "FILE";
  return ["PDF", "PPTX"].includes(ext) ? ext : "FILE";
}

const LEVEL_CLASS: Record<string, string> = {
  beginner: styles.levelBeginner,
  intermediate: styles.levelIntermediate,
  advanced: styles.levelAdvanced,
};

/** Native Slidev slide width in pixels. The iframe renders at this width and
 *  is scaled down via CSS transform to fit the card preview area. */
const SLIDE_NATIVE_WIDTH = 980;

interface Props {
  readonly presentation: Presentation;
  readonly isDev: boolean;
  /** When true, renders image on the left and content on the right (list view). */
  readonly horizontal?: boolean;
}

export default function SlidevCard({ presentation, isDev, horizontal = false }: Props) {
  const previewRef = useRef<HTMLDivElement>(null);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [previewLoaded, setPreviewLoaded] = useState(isDev);
  // Fall back to iframe preview when the thumbnail PNG fails to load (e.g. not generated yet).
  const [thumbnailError, setThumbnailError] = useState(false);

  // Compute scale = preview-container-width / native-slide-width.
  // Updates on resize so the thumbnail stays sharp at any card width.
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

  const cardContent = (
    <>
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
        <button
          type="button"
          className={`${styles.favoriteBtn} ${isFavorite(presentation.id) ? styles.favoriteBtnActive : ""}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(presentation.id); }}
          aria-label={isFavorite(presentation.id) ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={isFavorite(presentation.id)}
        >
          <StarIcon filled={isFavorite(presentation.id)} width={14} height={14} />
        </button>
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
    </>
  );

  const cardClass = `${styles.card}${horizontal ? ` ${styles.cardHorizontal}` : ""}`;

  if (isDev) {
    return <a href={presentation.url} className={cardClass}>{cardContent}</a>;
  }

  return (
    <a href={presentation.url} className={cardClass} target="_blank" rel="noopener noreferrer">
      {cardContent}
    </a>
  );
}
