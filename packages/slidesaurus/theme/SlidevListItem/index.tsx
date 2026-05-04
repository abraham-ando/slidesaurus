import React from "react";
import Link from "@docusaurus/Link";
import { PresentationIcon, FolderIcon, AuthorIcon, ClockIcon, StarIcon, PresenterIcon, DownloadIcon, PlaylistIcon } from "../icons";
import type { Presentation, Category } from "../types";
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

type Props =
  | { type: "presentation"; presentation: Presentation; isDev: boolean }
  | { type: "category"; category: Category };

export default function SlidevListItem(props: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();

  if (props.type === "category") {
    const { category } = props;
    return (
      <Link to={category.url} className={`${styles.listItem} ${styles.categoryItem}`}>
        <div className={styles.titleSection}>
          <FolderIcon className={styles.icon} width={18} height={18} />
          <span className={styles.title}>{category.label}</span>
        </div>
        <div className={styles.descriptionSection}>
          {category.description || "—"}
        </div>
        <div className={styles.metaSection}>
          <span className={styles.badge}>
            {category.count === 1 ? "1 presentation" : `${category.count} presentations`}
          </span>
        </div>
      </Link>
    );
  }

  const { presentation, isDev } = props;
  const content = (
    <>
      <div className={styles.titleSection}>
        <PresentationIcon className={styles.icon} width={18} height={18} />
        <span className={styles.title}>{presentation.title}</span>
        {isDev && <span className={styles.devBadge}>Build Required</span>}
      </div>
      <div className={styles.descriptionSection}>
        {presentation.description || "—"}
      </div>
      <div className={styles.metaSection}>
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
        {presentation.duration !== undefined && (
          <div className={styles.author}>
            <ClockIcon className={styles.authorIcon} width={13} height={13} />
            <span>{presentation.duration} min</span>
          </div>
        )}
        {presentation.author && (
          <div className={styles.author}>
            <AuthorIcon className={styles.authorIcon} width={14} height={14} />
            <span>{presentation.author}</span>
          </div>
        )}
        {!isDev && presentation.exportUrls?.map((exportUrl) => (
          <a
            key={exportUrl}
            href={exportUrl}
            download
            className={styles.downloadBtn}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Download ${exportLabel(exportUrl)}`}
          >
            <DownloadIcon width={12} height={12} />
            <span>{exportLabel(exportUrl)}</span>
          </a>
        ))}
        {!isDev && (
          <a
            href={`${presentation.url}presenter/`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.presenterBtn}
            onClick={(e) => e.stopPropagation()}
            aria-label="Open presenter view"
          >
            <PresenterIcon width={12} height={12} />
            <span>Present</span>
          </a>
        )}
        <button
          type="button"
          className={`${styles.favoriteBtn} ${isFavorite(presentation.id) ? styles.favoriteBtnActive : ""}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(presentation.id); }}
          aria-label={isFavorite(presentation.id) ? "Remove from favorites" : "Add to favorites"}
        >
          <StarIcon filled={isFavorite(presentation.id)} width={15} height={15} />
        </button>
      </div>
      {!isDev && presentation.thumbnailUrl && (
        <div className={styles.hoverPreview} aria-hidden="true">
          <img src={presentation.thumbnailUrl} alt="" className={styles.hoverPreviewImg} />
        </div>
      )}
    </>
  );

  if (isDev) {
    return <a href={presentation.url} className={styles.listItem}>{content}</a>;
  }
  return (
    <a href={presentation.url} className={styles.listItem} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  );
}
