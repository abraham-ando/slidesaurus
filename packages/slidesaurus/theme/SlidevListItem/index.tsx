import React from "react";
import Link from "@docusaurus/Link";
import {
  PresentationIcon,
  FolderIcon,
  AuthorIcon,
  ClockIcon,
  StarIcon,
  PresenterIcon,
  DownloadIcon,
  PlaylistIcon,
} from "../icons";
import type { Presentation, Category, UITheme } from "../types";
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
  | { type: "presentation"; presentation: Presentation; uiTheme?: UITheme }
  | { type: "category"; category: Category; uiTheme?: UITheme };

export default function SlidevListItem(props: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const uiTheme = props.uiTheme ?? "default";

  if (props.type === "category") {
    const { category } = props;
    return (
      <Link
        to={category.url}
        className={`${styles.listItem} ${styles.categoryItem}`}
        data-slidev-ui-theme={uiTheme}
      >
        <div className={styles.titleSection}>
          <FolderIcon className={styles.icon} width={18} height={18} />
          <span className={styles.title}>{category.label}</span>
        </div>
        <div className={styles.descriptionSection}>
          {category.description || "—"}
        </div>
        <div className={styles.metaSection}>
          <span className={styles.badge}>
            {category.count === 1
              ? "1 presentation"
              : `${category.count} presentations`}
          </span>
        </div>
      </Link>
    );
  }

  const { presentation } = props;
  const favorite = isFavorite(presentation.id);

  // "Card link" pattern: the row is a <div>; the title <a> is stretched over the
  // whole row by ::after. Download/presenter links and the favorite button are
  // siblings placed above it, so no interactive element is nested in an <a>.
  return (
    <div className={styles.listItem} data-slidev-ui-theme={uiTheme}>
      <div className={styles.titleSection}>
        <PresentationIcon className={styles.icon} width={18} height={18} />
        <span className={styles.title}>
          <a
            href={presentation.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cardLink}
          >
            {presentation.title}
          </a>
        </span>
      </div>
      <div className={styles.descriptionSection}>
        {presentation.description || "—"}
      </div>
      <div className={styles.metaSection}>
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
        {presentation.exportUrls?.map((exportUrl) => (
          <a
            key={exportUrl}
            href={exportUrl}
            download
            className={styles.downloadBtn}
            aria-label={`Download ${exportLabel(exportUrl)} of ${presentation.title}`}
          >
            <DownloadIcon width={12} height={12} />
            <span>{exportLabel(exportUrl)}</span>
          </a>
        ))}
        <a
          href={`${presentation.url}presenter/`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.presenterBtn}
          aria-label={`Open presenter view for ${presentation.title}`}
        >
          <PresenterIcon width={12} height={12} />
          <span>Present</span>
        </a>
        <button
          type="button"
          className={`${styles.favoriteBtn} ${favorite ? styles.favoriteBtnActive : ""}`}
          onClick={() => toggleFavorite(presentation.id)}
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={favorite}
        >
          <StarIcon filled={favorite} width={15} height={15} />
        </button>
      </div>
      {presentation.thumbnailUrl && (
        <div className={styles.hoverPreview} aria-hidden="true">
          <img
            src={presentation.thumbnailUrl}
            alt=""
            className={styles.hoverPreviewImg}
          />
        </div>
      )}
    </div>
  );
}
