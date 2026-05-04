import { useState, useEffect, useRef, useMemo } from "react";
import Layout from "@theme/Layout";
import Head from "@docusaurus/Head";
import { usePluginData } from "@docusaurus/useGlobalData";
import { useLocation } from "@docusaurus/router";
import type { PluginData, Presentation, PlaylistData } from "../types";
import { PLUGIN_NAME } from "../types";
import { PlaylistIcon, DownloadIcon } from "../icons";

function exportLabel(url: string): string {
  const ext = url.split(".").pop()?.toUpperCase() ?? "FILE";
  return ["PDF", "PPTX"].includes(ext) ? ext : "FILE";
}
import styles from "./styles.module.css";

function buildJsonLd(p: Presentation): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: p.title,
  };
  if (p.description) ld.description = p.description;
  if (p.author) ld.author = { "@type": "Person", name: p.author };
  if (p.level) ld.educationalLevel = p.level;
  if (p.duration) ld.timeRequired = `PT${p.duration}M`;
  if (p.lastReviewed) ld.dateModified = p.lastReviewed;
  if (p.tags?.length) ld.keywords = p.tags.join(", ");
  return ld;
}

function PresentationHead({ p, url }: { p: Presentation; url: string }) {
  return (
    <Head>
      <meta property="og:type" content="article" />
      <meta property="og:title" content={p.title} />
      {p.description && <meta property="og:description" content={p.description} />}
      <meta property="og:url" content={url} />
      {p.thumbnailUrl && <meta property="og:image" content={p.thumbnailUrl} />}
      <meta name="twitter:card" content={p.thumbnailUrl ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={p.title} />
      {p.description && <meta name="twitter:description" content={p.description} />}
      {p.thumbnailUrl && <meta name="twitter:image" content={p.thumbnailUrl} />}
      <script type="application/ld+json">{JSON.stringify(buildJsonLd(p))}</script>
    </Head>
  );
}

export default function SlidevPresentation({ pluginId = "default" }: { readonly pluginId?: string }) {
  const { presentations, playlists } = usePluginData(PLUGIN_NAME, pluginId) as PluginData;
  const location = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [resumeSlide, setResumeSlide] = useState<number | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string>("");
  const [showResumeBar, setShowResumeBar] = useState(false);

  const presentation = presentations.find((p) => {
    const normalizedUrl = p.url.replace(/\/$/, "");
    const normalizedPath = location.pathname.replace(/\/$/, "");
    return normalizedUrl === normalizedPath;
  });

  // Find the first playlist this presentation belongs to, and its prev/next neighbours.
  const playlistNav = useMemo((): {
    playlist: PlaylistData;
    prev: Presentation | null;
    next: Presentation | null;
    index: number;
  } | null => {
    if (!presentation) return null;
    const playlist = playlists.find((pl) => pl.items.includes(presentation.id));
    if (!playlist) return null;
    const index = playlist.items.indexOf(presentation.id);
    const prevId = index > 0 ? playlist.items[index - 1] : null;
    const nextId = index < playlist.items.length - 1 ? playlist.items[index + 1] : null;
    return {
      playlist,
      prev: prevId ? (presentations.find((p) => p.id === prevId) ?? null) : null,
      next: nextId ? (presentations.find((p) => p.id === nextId) ?? null) : null,
      index,
    };
  }, [presentation?.id, playlists, presentations]);

  // ── Dev mode: lazy server start + open in new tab ────────────────────────
  useEffect(() => {
    // Dev mode now uses the same static build output as production —
    // no Slidev dev servers, no proxy. Just load the iframe.
    if (!presentation) return;

    setIframeSrc(presentation.url);

    const storageKey = `slidev-resume-${presentation.id}`;
    const stored = localStorage.getItem(storageKey);
    const slide = stored ? parseInt(stored, 10) : NaN;
    if (!isNaN(slide) && slide > 1) {
      setResumeSlide(slide);
      setShowResumeBar(true);
    }
  }, [presentation?.id]);

  useEffect(() => {
    if (!presentation) return;
    const storageKey = `slidev-resume-${presentation.id}`;

    const onUnload = () => {
      try {
        const hash = iframeRef.current?.contentWindow?.location.hash;
        const slide = hash ? parseInt(hash.replace("#", ""), 10) : NaN;
        if (!isNaN(slide) && slide > 1) {
          localStorage.setItem(storageKey, String(slide));
        }
      } catch {
        // cross-origin: silently ignore
      }
    };

    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [presentation?.id]);

  if (!presentation) {
    return (
      <Layout title="Presentation Not Found">
        <div className={styles.container}>
          <div className={styles.errorState}>
            <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 4h1m4 0h13M4 4v10a2 2 0 0 0 2 2h10m3.42-.592c.359-.362.58-.859.58-1.408V4m-8 12v4m-3 0h6m-7-8l2-2m4 0l2-2M3 3l18 18"
              />
            </svg>
            <h1 className={styles.errorTitle}>Presentation Not Found</h1>
            <p className={styles.errorText}>
              The presentation at <code>{location.pathname}</code> could not be found.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const handleResume = () => {
    setIframeSrc(`${presentation.url}#${resumeSlide}`);
    setShowResumeBar(false);
  };

  const handleDismiss = () => {
    localStorage.removeItem(`slidev-resume-${presentation.id}`);
    setShowResumeBar(false);
  };

  const resumeBar = showResumeBar && resumeSlide !== null && (
    <div className={styles.resumeBar} role="status">
      <span>You left off at slide {resumeSlide}</span>
      <div className={styles.resumeActions}>
        <button className={styles.resumeBtn} onClick={handleResume} type="button">
          Resume from slide {resumeSlide}
        </button>
        <button className={styles.resumeBtnSecondary} onClick={handleDismiss} type="button">
          Start from beginning
        </button>
      </div>
    </div>
  );

  const playlistBar = playlistNav && (
    <div className={styles.playlistBar}>
      <div className={styles.playlistInfo}>
        <PlaylistIcon width={13} height={13} />
        <span className={styles.playlistTitle}>{playlistNav.playlist.title}</span>
        <span className={styles.playlistProgress}>
          {playlistNav.index + 1} / {playlistNav.playlist.items.length}
        </span>
      </div>
      <div className={styles.playlistActions}>
        {playlistNav.prev ? (
          <a href={playlistNav.prev.url} className={styles.playlistNavBtn} aria-label="Previous in playlist">
            ← {playlistNav.prev.title}
          </a>
        ) : (
          <span className={styles.playlistNavBtnDisabled}>← First</span>
        )}
        {playlistNav.next ? (
          <a href={playlistNav.next.url} className={styles.playlistNavBtn} aria-label="Next in playlist">
            {playlistNav.next.title} →
          </a>
        ) : (
          <span className={styles.playlistNavBtnDisabled}>Last →</span>
        )}
      </div>
    </div>
  );

  return (
    <Layout title={presentation.title} description={presentation.description}>
      <PresentationHead p={presentation} url={presentation.url} />
      <div className={styles.presentationContainer}>
        <div className={styles.presenterLinkBar}>
          {presentation.exportUrls?.map((exportUrl) => (
            <a key={exportUrl} href={exportUrl} download className={styles.downloadLink} aria-label={`Download ${exportLabel(exportUrl)}`}>
              <DownloadIcon width={13} height={13} />
              {exportLabel(exportUrl)}
            </a>
          ))}
          <a
            href={`${presentation.url}presenter/`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.presenterLink}
          >
            Presenter View
          </a>
        </div>
        {resumeBar}
        {playlistBar}
        <iframe
          ref={iframeRef}
          src={iframeSrc || presentation.url}
          className={styles.presentationIframe}
          title={presentation.title}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allowFullScreen
        />
      </div>
    </Layout>
  );
}
